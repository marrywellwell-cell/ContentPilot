/**
 * youtube-upload.ts
 * Holy-AI-Creator youtube-upload.ts 기반으로 ContentPilot에 통합
 * YouTube Data API v3를 사용한 영상 업로드
 */
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const OAuth2 = google.auth.OAuth2;

// 메모리 토큰 저장 (프로덕션에서는 DB에 저장 권장)
const userTokens = new Map<string, any>();

function getRedirectUri(req?: any): string {
  const base = process.env.APP_BASE_URL || "https://contentpilot-69x2.onrender.com";
  return `${base}/api/youtube-upload/callback`;
}

function getOAuth2Client(userId: string, req?: any) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("YOUTUBE_CLIENT_ID/SECRET 미설정");

  const client = new OAuth2(clientId, clientSecret, getRedirectUri(req));
  const tokens = userTokens.get(userId);
  if (tokens) client.setCredentials(tokens);
  return client;
}

export function hasYouTubeConfig(): boolean {
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

export function isYouTubeAuthenticated(userId: string): boolean {
  return userTokens.has(userId);
}

export function getAuthUrl(userId: string, req?: any): string {
  const client = getOAuth2Client(userId, req);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    prompt: "consent",
    state: userId,
  });
}

export async function handleCallback(code: string, userId: string, req?: any): Promise<void> {
  const client = getOAuth2Client(userId, req);
  const { tokens } = await client.getToken(code);
  userTokens.set(userId, tokens);
}

export function clearTokens(userId: string): void {
  userTokens.delete(userId);
}

export interface UploadOptions {
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "private" | "public" | "unlisted";
  categoryId?: string;
  madeForKids?: boolean;
}

export interface UploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  error?: string;
}

export async function uploadVideoToYouTube(
  userId: string,
  filePath: string,
  options: UploadOptions
): Promise<UploadResult> {
  if (!isYouTubeAuthenticated(userId)) {
    return { success: false, error: "YouTube 로그인이 필요합니다." };
  }

  try {
    const client = getOAuth2Client(userId);
    const youtube = google.youtube({ version: "v3", auth: client });

    const fileSize = fs.statSync(filePath).size;

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: options.title,
          description: options.description,
          tags: options.tags || [],
          categoryId: options.categoryId || "22", // People & Blogs
        },
        status: {
          privacyStatus: options.privacyStatus || "private",
          selfDeclaredMadeForKids: options.madeForKids || false,
        },
      },
      media: {
        mimeType: "video/mp4",
        body: fs.createReadStream(filePath),
      },
    } as any, {
      onUploadProgress: (evt: any) => {
        const progress = ((evt.bytesRead / fileSize) * 100).toFixed(1);
        console.log(`[YouTube Upload] 진행: ${progress}%`);
      },
    });

    const videoId = response.data.id;
    console.log(`[YouTube Upload] 완료: ${videoId}`);

    return {
      success: true,
      videoId: videoId || undefined,
      videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
    };
  } catch (error: any) {
    console.error("[YouTube Upload] 오류:", error.message);
    if (error.code === 401 || error.message?.includes("invalid_grant")) {
      clearTokens(userId);
      return { success: false, error: "인증이 만료됐습니다. 다시 로그인해주세요." };
    }
    return { success: false, error: error.message };
  }
}

export async function getMyYouTubeChannels(userId: string) {
  if (!isYouTubeAuthenticated(userId)) return [];

  try {
    const client = getOAuth2Client(userId);
    const youtube = google.youtube({ version: "v3", auth: client });
    const response = await youtube.channels.list({ part: ["snippet", "id"], mine: true });
    return (response.data.items || []).map((ch: any) => ({
      id: ch.id,
      title: ch.snippet?.title || "",
      thumbnailUrl: ch.snippet?.thumbnails?.default?.url,
    }));
  } catch (e) {
    return [];
  }
}
