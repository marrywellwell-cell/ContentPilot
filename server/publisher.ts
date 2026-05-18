/**
 * publisher.ts — 플랫폼별 실제 자동 발행 모듈
 *
 * 지원 플랫폼:
 *  - Instagram (Graph API v21)  — 단일 이미지 / 캐러셀(최대 10장)
 *  - WordPress (REST API)       — Application Password 인증
 *  - Tistory   (Open API v1)    — OAuth 2.0 Bearer token
 */

import { storage } from "./storage";
import type { ContentSet, PlatformConnection } from "@shared/schema";
import * as path from "path";

// canvas는 선택적 — 없어도 텍스트 없이 발행
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
let canvasLib: any = null;
try {
  canvasLib = _require("canvas");
  const fontDir = path.join(process.cwd(), "server", "fonts");
  canvasLib.registerFont(path.join(fontDir, "NotoSansKR-Bold.ttf"), { family: "NotoSansKR", weight: "bold" });
  canvasLib.registerFont(path.join(fontDir, "NotoSansKR-Regular.ttf"), { family: "NotoSansKR" });
  console.log("[publisher] canvas 폰트 등록 완료");
} catch (e) {
  console.warn("[publisher] canvas 로드 실패 (텍스트 없이 발행):", (e as any).message);
}

// http(s) URL을 base64 data URL로 변환
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
  const buf = await res.arrayBuffer();
  const mime = res.headers.get("content-type") || "image/jpeg";
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

// 이미지 위에 슬라이드 텍스트를 합성해 data URL로 반환
// canvas 없거나 실패하면 원본 data URL 반환
async function compositeTextOnImage(
  url: string,
  text: string,
  isCover: boolean
): Promise<string | null> {
  if (!canvasLib) return null;
  try {
    // http URL이면 먼저 data URL로 변환
    const dataUrl = url.startsWith("data:") ? url : await urlToDataUrl(url);
    const { createCanvas, loadImage } = canvasLib;
    const img = await loadImage(dataUrl);
    const SIZE = 1080;
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext("2d");

    const scale = Math.max(SIZE / img.width, SIZE / img.height);
    const sw = SIZE / scale;
    const sh = SIZE / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

    const lines = text.split("\n").filter((l: string) => l.trim());
    const titleLine = lines[0] || "";
    const bodyLines = lines.slice(1).filter((l: string) => l.trim());
    const titleSize = isCover ? 80 : 68;
    const bodySize = 44;
    const lineSpacing = 58;

    // 텍스트 전체 높이 계산
    const totalTextHeight = titleSize + (bodyLines.length > 0 ? titleSize * 0.4 + bodyLines.length * lineSpacing : 0);

    // 중앙 배경 오버레이 (가독성)
    const padV = 60, padH = 80;
    const boxH = totalTextHeight + padV * 2;
    const boxY = (SIZE - boxH) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.beginPath();
    ctx.roundRect(padH / 2, boxY, SIZE - padH, boxH, 20);
    ctx.fill();

    // 텍스트 중앙 배치
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;

    const centerY = SIZE / 2;
    const titleY = bodyLines.length > 0 ? centerY - (bodyLines.length * lineSpacing) / 2 : centerY;

    // 제목
    ctx.font = `bold ${titleSize}px "NotoSansKR", sans-serif`;
    ctx.fillText(titleLine, SIZE / 2, titleY, SIZE * 0.85);

    // 본문 불릿
    if (bodyLines.length > 0) {
      ctx.font = `${bodySize}px "NotoSansKR", sans-serif`;
      ctx.shadowBlur = 6;
      bodyLines.forEach((line: string, i: number) => {
        ctx.fillText(line, SIZE / 2, titleY + titleSize * 0.8 + (i + 1) * lineSpacing, SIZE * 0.82);
      });
    }

    return canvas.toDataURL("image/jpeg", 0.92);
  } catch (err) {
    console.error("[publisher] 텍스트 합성 실패:", (err as any).message);
    return null;
  }
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface PublishResult {
  platform: string;
  success: boolean;
  postUrl?: string;
  postId?: string;
  error?: string;
}

// ─── 유틸: base64 data URL → 공개 URL 변환 ────────────────────────────────────
// Instagram Graph API는 공개 HTTPS URL을 요구합니다.
// 이미지를 서버의 /api/images/temp/:id 엔드포인트로 임시 서빙 후 Instagram에 전달합니다.

const tempImages = new Map<string, { data: string; mimeType: string; expires: number }>();

export function storeTempImage(base64DataUrl: string): string {
  const id = Math.random().toString(36).slice(2);
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");
  tempImages.set(id, {
    data: match[2],
    mimeType: match[1],
    expires: Date.now() + 10 * 60 * 1000, // 10분 TTL
  });
  return id;
}

export function getTempImage(id: string) {
  const img = tempImages.get(id);
  if (!img || img.expires < Date.now()) return null;
  return img;
}

// 만료된 임시 이미지 정리 (10분 주기)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tempImages) {
    if (v.expires < now) tempImages.delete(k);
  }
}, 10 * 60 * 1000);

// ─── Instagram Graph API ───────────────────────────────────────────────────────

async function createInstagramMediaContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption?: string,
  isCarouselItem = false
): Promise<string> {
  const params: Record<string, string> = {
    access_token: accessToken,
    image_url: imageUrl,
  };
  if (isCarouselItem) {
    params.is_carousel_item = "true";
  } else if (caption) {
    params.caption = caption;
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }
  );

  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(`Instagram media container error: ${data.error?.message || res.statusText}`);
  }
  return data.id as string;
}

async function createInstagramCarouselContainer(
  igUserId: string,
  accessToken: string,
  children: string[],
  caption: string
): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children: children.join(","),
        caption,
        access_token: accessToken,
      }),
    }
  );

  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(`Instagram carousel container error: ${data.error?.message || res.statusText}`);
  }
  return data.id as string;
}

async function waitForInstagramContainer(
  containerId: string,
  accessToken: string,
  maxWaitMs = 30000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const data = await res.json() as any;
    const status = data.status_code || data.status;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram 미디어 처리 실패: ${status}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

async function publishInstagramContainer(
  igUserId: string,
  accessToken: string,
  containerId: string
): Promise<string> {
  // 미디어 처리 완료 대기
  await waitForInstagramContainer(containerId, accessToken);

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(`Instagram publish error: ${data.error?.message || res.statusText}`);
  }
  return data.id as string;
}

export async function publishToInstagram(
  connection: PlatformConnection,
  contentSet: ContentSet,
  baseUrl: string
): Promise<PublishResult> {
  const { instagramUserId, instagramAccessToken } = connection;

  if (!instagramUserId || !instagramAccessToken) {
    return { platform: "instagram", success: false, error: "Instagram 연결 정보가 없습니다." };
  }

  const imageUrls = contentSet.instagramImageUrls || [];
  const slides = contentSet.instagramSlides || [];
  const caption = [
    contentSet.instagramCaption || "",
    (contentSet.instagramHashtags || []).map((h) => `#${h}`).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    // 슬라이드 텍스트를 이미지에 합성 후 임시 서버 URL로 변환
    const resolvedUrls = await Promise.all(
      imageUrls.map(async (url, i) => {
        const slideText = slides[i] || "";
        const isCover = i === 0;

        // 텍스트 합성 시도
        if (slideText) {
          const composited = await compositeTextOnImage(url, slideText, isCover);
          if (composited) {
            // 합성 성공 → data URL을 임시 서버 URL로 변환
            const id = storeTempImage(composited);
            return `${baseUrl}/api/images/temp/${id}`;
          }
          // 합성 실패 → 원본 fallback
        }

        // 텍스트 없거나 합성 실패 → 원본 처리
        if (url.startsWith("data:")) {
          const id = storeTempImage(url);
          return `${baseUrl}/api/images/temp/${id}`;
        }
        // http URL은 그대로 사용
        return url;
      })
    );

    let mediaId: string;

    if (resolvedUrls.length === 0) {
      return { platform: "instagram", success: false, error: "발행할 이미지가 없습니다." };
    } else if (resolvedUrls.length === 1) {
      // 단일 이미지 발행
      const containerId = await createInstagramMediaContainer(
        instagramUserId,
        instagramAccessToken,
        resolvedUrls[0],
        caption
      );
      mediaId = await publishInstagramContainer(instagramUserId, instagramAccessToken, containerId);
    } else {
      // 캐러셀 발행 (Instagram 최대 10장)
      const carouselUrls = resolvedUrls.slice(0, 10);
      const childIds = await Promise.all(
        carouselUrls.map((url) =>
          createInstagramMediaContainer(instagramUserId, instagramAccessToken, url, undefined, true)
        )
      );
      const carouselId = await createInstagramCarouselContainer(
        instagramUserId,
        instagramAccessToken,
        childIds,
        caption
      );
      mediaId = await publishInstagramContainer(instagramUserId, instagramAccessToken, carouselId);
    }

    const postUrl = `https://www.instagram.com/p/${mediaId}/`;
    return { platform: "instagram", success: true, postId: mediaId, postUrl };
  } catch (error: any) {
    return { platform: "instagram", success: false, error: error.message };
  }
}

// ─── WordPress REST API ────────────────────────────────────────────────────────

export async function publishToWordPress(
  connection: PlatformConnection,
  contentSet: ContentSet
): Promise<PublishResult> {
  const { wordpressUrl, wordpressUsername, wordpressAppPassword } = connection;

  if (!wordpressUrl || !wordpressUsername || !wordpressAppPassword) {
    return { platform: "wordpress", success: false, error: "WordPress 연결 정보가 없습니다." };
  }

  const siteUrl = wordpressUrl.replace(/\/$/, "");
  const credentials = Buffer.from(`${wordpressUsername}:${wordpressAppPassword}`).toString("base64");

  try {
    // 대표 이미지 업로드 (있는 경우)
    let featuredMediaId: number | undefined;
    const thumbImg = contentSet.blogImageUrls?.[0] || contentSet.instagramImageUrls?.[0];
    if (thumbImg && thumbImg.startsWith("data:")) {
      const match = thumbImg.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        const ext = mimeType.split("/")[1] || "png";
        const imgRes = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="thumbnail.${ext}"`,
          },
          body: buffer,
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json() as any;
          featuredMediaId = imgData.id;
        }
      }
    }

    const postBody: Record<string, any> = {
      title: contentSet.blogTitle || contentSet.keyword,
      content: contentSet.blogHtml || contentSet.blogContent || "",
      excerpt: contentSet.blogMetaDescription || "",
      status: "publish",
      tags: (contentSet.blogHashtags || []).slice(0, 10),
    };
    if (featuredMediaId) postBody.featured_media = featuredMediaId;

    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    const data = await res.json() as any;
    if (!res.ok) {
      throw new Error(data.message || res.statusText);
    }

    return {
      platform: "wordpress",
      success: true,
      postId: String(data.id),
      postUrl: data.link,
    };
  } catch (error: any) {
    return { platform: "wordpress", success: false, error: error.message };
  }
}

// ─── Tistory Open API ─────────────────────────────────────────────────────────

export async function publishToTistory(
  connection: PlatformConnection,
  contentSet: ContentSet
): Promise<PublishResult> {
  const { tistoryAccessToken, tistoryBlogName } = connection;

  if (!tistoryAccessToken || !tistoryBlogName) {
    return { platform: "tistory", success: false, error: "Tistory 연결 정보가 없습니다." };
  }

  try {
    const params = new URLSearchParams({
      access_token: tistoryAccessToken,
      output: "json",
      blogName: tistoryBlogName,
      title: contentSet.blogTitle || contentSet.keyword,
      content: contentSet.blogHtml || contentSet.blogContent || "",
      visibility: "3", // 공개
      tag: (contentSet.blogHashtags || []).slice(0, 10).join(","),
    });

    const res = await fetch(`https://www.tistory.com/apis/post/write?${params.toString()}`, {
      method: "POST",
    });

    const data = await res.json() as any;
    if (!res.ok || data.tistory?.status !== "200") {
      throw new Error(data.tistory?.error_message || res.statusText);
    }

    const postId = data.tistory?.postId;
    const postUrl = data.tistory?.url;

    return { platform: "tistory", success: true, postId, postUrl };
  } catch (error: any) {
    return { platform: "tistory", success: false, error: error.message };
  }
}

// ─── 전체 발행 오케스트레이터 ─────────────────────────────────────────────────

export async function publishContentToAllPlatforms(
  contentSet: ContentSet,
  baseUrl: string
): Promise<PublishResult[]> {
  const userId = contentSet.userId;
  if (!userId) return [];

  const platforms = contentSet.platforms || [];
  const results: PublishResult[] = [];

  for (const platform of platforms) {
    const connection = await getPlatformConnection(userId, platform);
    if (!connection) {
      results.push({ platform, success: false, error: `${platform} 연결 정보가 없습니다.` });
      continue;
    }

    let result: PublishResult;
    if (platform === "instagram") {
      result = await publishToInstagram(connection, contentSet, baseUrl);
    } else if (platform === "wordpress") {
      result = await publishToWordPress(connection, contentSet);
    } else if (platform === "tistory") {
      result = await publishToTistory(connection, contentSet);
    } else if (platform === "blog") {
      // "blog" 플랫폼은 WordPress 또는 Tistory 중 연결된 것으로 발행
      const wp = await getPlatformConnection(userId, "wordpress");
      const tistory = await getPlatformConnection(userId, "tistory");
      if (wp) {
        result = await publishToWordPress(wp, contentSet);
        result.platform = "blog(wordpress)";
      } else if (tistory) {
        result = await publishToTistory(tistory, contentSet);
        result.platform = "blog(tistory)";
      } else {
        result = { platform: "blog", success: false, error: "연결된 블로그 플랫폼이 없습니다." };
      }
    } else {
      result = { platform, success: false, error: `지원하지 않는 플랫폼입니다: ${platform}` };
    }

    results.push(result);
  }

  return results;
}

async function getPlatformConnection(
  userId: string,
  platform: string
): Promise<PlatformConnection | null> {
  try {
    return await storage.getPlatformConnection(userId, platform);
  } catch {
    return null;
  }
}
