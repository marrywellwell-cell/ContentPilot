/**
 * scripture-extractor.ts
 * Holy-AI-Creator의 youtube.ts 기반으로 적용.
 * yt-dlp를 사용해 유튜브 자막을 추출합니다.
 * yt-dlp 미설치 시 fetch 방식으로 자동 폴백합니다.
 */
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

export interface SubtitleResult {
  success: boolean;
  text?: string;
  error?: string;
  metadata?: VideoMetadata;
}

interface VideoMetadata {
  title: string;
  description: string;
  channel: string;
}

function execYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("yt-dlp timeout (60s)"));
    }, 60000);

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`yt-dlp exited ${code}: ${stderr}`));
    });
    proc.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}

function parseVTT(vttContent: string): string {
  const lines = vttContent.split("\n");
  const textLines: string[] = [];
  let previousLine = "";
  const seenPhrases = new Set<string>();

  for (const line of lines) {
    if (
      line.startsWith("WEBVTT") || line.startsWith("Kind:") || line.startsWith("Language:") ||
      line.includes("-->") || line.match(/^\d{2}:\d{2}/) || line.trim() === "" ||
      line.match(/^NOTE/) || line.match(/^[0-9]+$/) || line.match(/^align:/) || line.match(/^position:/)
    ) continue;

    let cleanLine = line
      .replace(/<[^>]+>/g, "").replace(/\[.*?\]/g, "").replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\{[^}]*\}/g, "").replace(/♪.*?♪/g, "").replace(/\(.*?\)/g, "").trim();

    if (!cleanLine || cleanLine.length < 2) continue;

    const normalized = cleanLine.toLowerCase().replace(/[^\w가-힣]/g, "");
    if (seenPhrases.has(normalized)) continue;
    if (previousLine && isSimilar(cleanLine, previousLine)) {
      if (cleanLine.length > previousLine.length) {
        textLines.pop();
        seenPhrases.delete(previousLine.toLowerCase().replace(/[^\w가-힣]/g, ""));
      } else continue;
    }

    textLines.push(cleanLine);
    seenPhrases.add(normalized);
    previousLine = cleanLine;
  }

  return textLines.join(" ").replace(/\s+/g, " ").replace(/\s([.,!?])/g, "$1").trim();
}

function isSimilar(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  const wa = a.toLowerCase().split(/\s+/);
  const wb = new Set(b.toLowerCase().split(/\s+/));
  if (!wa.length || !wb.size) return false;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.length, wb.size) > 0.7;
}

// fetch 기반 폴백 자막 추출 (yt-dlp 없을 때)
async function extractSubtitlesFetch(url: string): Promise<SubtitleResult> {
  try {
    const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const response = await fetch(url, {
      headers: { "User-Agent": browserUA, "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    if (!response.ok) return { success: false, error: "영상 페이지 접근 실패" };

    const html = await response.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const videoTitle = titleMatch ? titleMatch[1].replace(" - YouTube", "") : "Unknown";

    const captionMatch = html.match(/"captionTracks":\s*\[(.*?)\]/);
    if (captionMatch) {
      try {
        const captionData = JSON.parse(`[${captionMatch[1]}]`);
        const koreanCaption = captionData.find((c: any) =>
          c.languageCode === "ko" || c.languageCode === "ko-KR"
        ) || captionData[0];

        if (koreanCaption?.baseUrl) {
          const captionUrl = koreanCaption.baseUrl.replace(/\\u0026/g, "&");
          const captionResponse = await fetch(captionUrl, { headers: { "User-Agent": browserUA } });
          if (captionResponse.ok) {
            const captionXml = await captionResponse.text();
            const textPattern = /<text[^>]*>(.*?)<\/text>/g;
            const texts: string[] = [];
            let m;
            while ((m = textPattern.exec(captionXml)) !== null) {
              texts.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n/g, " "));
            }
            const transcript = texts.join(" ").trim();
            if (transcript.length > 100) return { success: true, text: transcript };
          }
        }
      } catch {}
    }

    // 메타데이터 폴백
    return {
      success: true,
      text: `영상 제목: ${videoTitle}. 이 영상의 핵심 주제와 메시지를 기반으로 적절한 성경 말씀을 추천해주세요.`,
      metadata: { title: videoTitle, description: "", channel: "" },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function extractYouTubeSubtitles(url: string): Promise<SubtitleResult> {
  // URL 검증
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
  if (!youtubeRegex.test(url)) {
    return { success: false, error: "유효한 유튜브 URL이 아닙니다" };
  }

  const videoIdMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (!videoIdMatch) return { success: false, error: "비디오 ID를 추출할 수 없습니다" };

  const videoId = videoIdMatch[1];

  // yt-dlp 사용 시도
  try {
    const tmpDir = path.join(process.cwd(), "tmp", "subs");
    await fs.mkdir(tmpDir, { recursive: true });

    // 기존 파일 정리
    const existingFiles = await fs.readdir(tmpDir).catch(() => [] as string[]);
    for (const f of existingFiles) {
      if (f.startsWith(videoId)) await fs.unlink(path.join(tmpDir, f)).catch(() => {});
    }

    const outputPath = path.join(tmpDir, videoId);
    const langs = ["ko", "en"];

    for (const lang of langs) {
      try {
        await execYtDlp([
          "--skip-download", "--write-auto-sub",
          "--sub-lang", lang, "--sub-format", "vtt",
          "--no-warnings", "-o", outputPath, url,
        ]);

        const files = await fs.readdir(tmpDir);
        const vttFiles = files.filter((f) => f.startsWith(videoId) && f.endsWith(".vtt"));

        for (const vttFile of vttFiles) {
          const content = await fs.readFile(path.join(tmpDir, vttFile), "utf-8");
          const text = parseVTT(content);
          await fs.unlink(path.join(tmpDir, vttFile)).catch(() => {});
          if (text.length > 100) return { success: true, text };
        }
      } catch { continue; }
    }
  } catch (err: any) {
    // yt-dlp 미설치 or 오류 → fetch 폴백
    if (err.message?.includes("ENOENT") || err.message?.includes("not found")) {
      console.log("[scripture-extractor] yt-dlp 미설치 → fetch 방식으로 폴백");
    } else {
      console.warn("[scripture-extractor] yt-dlp 오류:", err.message);
    }
  }

  // fetch 기반 폴백
  return extractSubtitlesFetch(url);
}
