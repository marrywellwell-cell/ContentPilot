import express from "express";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { generateInstagramContent, generateBlogContent, generateInstagramVisual, generateBlogInfographic, editContentWithChat, generateBrandAnalysis, generateMonthlyPlan, editInventionSlides } from "./ai";
import { insertContentSetSchema, insertBrandAnalysisSchema, insertMonthlyPlanSchema, chatRequestSchema } from "@shared/schema";
import { z } from "zod";
import pLimit from "p-limit";
import { setupAuth, isAuthenticated, isAdmin, isAuthenticatedOrApiKey } from "./auth";

// Sanitize URLs to prevent HTML injection
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface BlogSection {
  heading: string;
  content: string;
  isIntro?: boolean;
  isConclusion?: boolean;
  isFAQ?: boolean;
}

// Parse blog HTML into sections based on H2 tags
function parseBlogSections(html: string): BlogSection[] {
  const sections: BlogSection[] = [];
  
  // Match H2 tags and their content
  const h2Pattern = /<h2[^>]*>(.*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
  let match;
  let lastIndex = 0;
  
  // Check for content before first H2
  const firstH2Match = html.match(/<h2[^>]*>/);
  if (firstH2Match) {
    const firstH2Index = html.indexOf(firstH2Match[0]);
    if (firstH2Index > 0) {
      const introContent = html.substring(0, firstH2Index).trim();
      if (introContent) {
        sections.push({
          heading: "",
          content: introContent,
          isIntro: true,
        });
      }
    }
  }
  
  // Process all H2 sections
  while ((match = h2Pattern.exec(html)) !== null) {
    const heading = match[1].trim();
    const content = match[2].trim();
    
    const isIntro = heading.includes("소개") || heading.includes("개요");
    const isConclusion = heading.includes("결론") || heading.includes("마무리");
    const isFAQ = heading.includes("자주 묻는 질문") || heading.includes("FAQ");
    
    sections.push({
      heading,
      content,
      isIntro,
      isConclusion,
      isFAQ,
    });
  }
  
  return sections;
}

// Extract text summary from HTML content (first 200 characters)
function extractTextSummary(htmlContent: string): string {
  // Remove HTML tags
  const text = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // Return first 200 characters
  return text.substring(0, 200);
}

// Build blog HTML with images above corresponding sections
function buildBlogWithInlineImages(
  sections: BlogSection[],
  imageUrls: string[] = []
): string {
  let html = "";
  let imageIndex = 0;
  
  sections.forEach((section, sectionIndex) => {
    // Skip intro, conclusion, and FAQ for image pairing
    const shouldPairImage = !section.isIntro && !section.isConclusion && !section.isFAQ;
    const hasImage = shouldPairImage && imageIndex < imageUrls.length;
    
    if (hasImage) {
      // Section with image - vertical layout (image on top, text below)
      html += `
        <div style="margin: 2.5rem 0;">
          <div style="margin-bottom: 1.5rem; text-align: center;">
            <img 
              src="${escapeHtml(imageUrls[imageIndex])}" 
              alt="${escapeHtml(section.heading)}" 
              style="max-width: 600px; width: 100%; height: auto; border-radius: 0.75rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
            />
            <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #666; font-style: italic;">
              ${escapeHtml(section.heading)}
            </p>
          </div>
          <div>
            ${section.heading ? `<h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; color: #1a1a1a;">${escapeHtml(section.heading)}</h2>` : ""}
            ${section.content}
          </div>
        </div>
      `;
      
      imageIndex++;
    } else {
      // Section without image - regular layout
      html += `
        <div style="margin: 2.5rem 0;">
          ${section.heading ? `<h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; color: #1a1a1a;">${escapeHtml(section.heading)}</h2>` : ""}
          ${section.content}
        </div>
      `;
    }
  });
  
  return html;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Health check (keepalive ping용 — 인증 불필요)
  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ─── API Key management ───────────────────────────────────────────
  app.get("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const keys = await storage.listApiKeys(userId);
      // Never expose the raw key after creation – mask it
      const masked = keys.map(k => ({ ...k, key: k.key.slice(0, 8) + "..." + k.key.slice(-4) }));
      res.json(masked);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "이름을 입력해주세요" });
      // Generate secure random key with cf_ prefix
      const { randomBytes } = await import("crypto");
      const raw = "cf_" + randomBytes(28).toString("hex");
      const apiKey = await storage.createApiKey(userId, name.trim(), raw);
      // Return the full key ONLY on creation
      res.json({ ...apiKey, key: raw });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const deleted = await storage.deleteApiKey(req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: "API 키를 찾을 수 없습니다" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Token-based image download (bypasses iframe download restrictions)
  const downloadTokens = new Map<string, { buffer: Buffer; mimeType: string; filename: string; expires: number }>();

  // Clean up expired tokens every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of downloadTokens.entries()) {
      if (val.expires < now) downloadTokens.delete(key);
    }
  }, 5 * 60 * 1000);

  app.post("/api/image-download/create", isAuthenticated, async (req: any, res) => {
    try {
      const { data, mimeType = "image/png", filename = "image.png" } = req.body;
      if (!data) return res.status(400).json({ error: "data required" });

      let buffer: Buffer;
      if (typeof data === "string" && data.startsWith("data:")) {
        const base64 = data.split(",")[1];
        buffer = Buffer.from(base64, "base64");
      } else if (typeof data === "string") {
        // External URL - fetch it
        const response = await fetch(data);
        if (!response.ok) throw new Error("Failed to fetch image");
        buffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "Invalid data format" });
      }

      const token = randomUUID();
      downloadTokens.set(token, { buffer, mimeType, filename, expires: Date.now() + 5 * 60 * 1000 });
      res.json({ token });
    } catch (error) {
      console.error("Download create error:", error);
      res.status(500).json({ error: "Failed to prepare download" });
    }
  });

  app.get("/api/image-download/:token", async (req, res) => {
    const entry = downloadTokens.get(req.params.token);
    if (!entry) return res.status(404).json({ error: "Token not found or expired" });
    downloadTokens.delete(req.params.token);
    res.setHeader("Content-Type", entry.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${entry.filename}"`);
    res.send(entry.buffer);
  });

  // Video download: accept raw binary body
  app.post("/api/video-download/create", isAuthenticated, express.raw({ type: "*/*", limit: "500mb" }), async (req: any, res) => {
    try {
      const filename = (req.query.filename as string) || "video.webm";
      const mimeType = req.headers["content-type"] || "video/webm";
      const buffer = req.body as Buffer;
      if (!buffer || buffer.length === 0) return res.status(400).json({ error: "No video data" });
      const token = randomUUID();
      downloadTokens.set(token, { buffer, mimeType, filename, expires: Date.now() + 10 * 60 * 1000 });
      res.json({ token });
    } catch (error) {
      console.error("Video download create error:", error);
      res.status(500).json({ error: "Failed to prepare video download" });
    }
  });

  // TTS: generate Korean narration audio
  app.post("/api/tts/generate", isAuthenticated, async (req: any, res) => {
    const { text, voiceId, referenceAudio, useStoredVoice } = req.body;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
    try {
      const { generateTTS } = await import("./ai");
      const path = await import("path");
      const fs = await import("fs");

      // Normalize: replace trailing ! / ? with . so TTS intonation falls naturally at end
      const normalizedText = text.slice(0, 300).replace(/[!！?？]+$/, ".");

      // If useStoredVoice flag, load the stored user voice file from disk
      let resolvedReference = referenceAudio;
      if (useStoredVoice && !resolvedReference) {
        const voicePath = path.join(process.cwd(), "server/assets/user-voice.m4a");
        if (fs.existsSync(voicePath)) {
          resolvedReference = fs.readFileSync(voicePath).toString("base64");
          console.log("TTS: Using stored user voice as reference");
        }
      }

      const { data, mimeType } = await generateTTS(normalizedText, voiceId, resolvedReference);
      res.json({ audio: data.toString("base64"), mimeType });
    } catch (error: any) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "TTS generation failed: " + (error?.message || "unknown") });
    }
  });

  // Save uploaded voice file to server for persistent voice cloning
  app.post("/api/user-voice/save", isAuthenticated, async (req: any, res) => {
    const { audioBase64 } = req.body;
    if (typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "audioBase64 required" });
    }
    try {
      const path = await import("path");
      const fs = await import("fs");
      const filePath = path.join(process.cwd(), "server/assets/user-voice.m4a");

      // Empty string = delete (reset)
      if (!audioBase64) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.json({ success: true, deleted: true });
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const assetsDir = path.join(process.cwd(), "server/assets");
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(filePath, audioBuffer);
      console.log(`User voice saved: ${audioBuffer.length} bytes`);
      res.json({ success: true, size: audioBuffer.length });
    } catch (error: any) {
      console.error("Voice save error:", error);
      res.status(500).json({ error: "Failed to save voice file" });
    }
  });

  // Check if a stored user voice exists
  app.get("/api/user-voice/status", isAuthenticated, async (req: any, res) => {
    const path = await import("path");
    const fs = await import("fs");
    const filePath = path.join(process.cwd(), "server/assets/user-voice.m4a");
    const exists = fs.existsSync(filePath);
    const size = exists ? fs.statSync(filePath).size : 0;
    res.json({ exists, size });
  });

  // Voice cloning: upload audio sample → create ElevenLabs instant voice → return voice_id
  app.post("/api/voices/clone", isAuthenticated, async (req: any, res) => {
    const { audioBase64, mimeType, voiceName } = req.body;
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "audioBase64 required" });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "ElevenLabs API key not configured" });

    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const ext = (mimeType || "audio/mpeg").includes("mp4") || (mimeType || "").includes("m4a") ? "m4a"
        : (mimeType || "").includes("wav") ? "wav"
        : (mimeType || "").includes("ogg") ? "ogg" : "mp3";

      const formData = new FormData();
      formData.append("name", voiceName || "내 목소리");
      formData.append("description", "사용자 업로드 음성");
      formData.append("files", new Blob([audioBuffer], { type: mimeType || "audio/mpeg" }), `voice.${ext}`);

      const cloneRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: formData,
      });

      if (!cloneRes.ok) {
        const err = await cloneRes.text();
        throw new Error(`ElevenLabs voice clone error ${cloneRes.status}: ${err}`);
      }

      const result = await cloneRes.json() as { voice_id: string };
      res.json({ voiceId: result.voice_id, voiceName: voiceName || "내 목소리" });
    } catch (error: any) {
      console.error("Voice clone error:", error);
      res.status(500).json({ error: error?.message || "Voice cloning failed" });
    }
  });

  // Serve user uploaded voice file
  app.get("/api/user-voice", isAuthenticated, async (req: any, res) => {
    const path = await import("path");
    const fs = await import("fs");
    const filePath = path.join(process.cwd(), "server/assets/user-voice.m4a");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "No user voice file" });
    }
    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
  });

  // ─── Shorts Video: 메모리 + /tmp 이중 저장 (Render 임시 파일시스템 대응) ───
  // 서버 재시작 전까지 메모리에 WebM 유지
  const webmStore = new Map<string, Buffer>();

  app.post("/api/shorts-video/save/:contentId", isAuthenticated, express.raw({ type: "*/*", limit: "500mb" }), async (req: any, res) => {
    try {
      const { contentId } = req.params;
      const buffer = req.body as Buffer;
      if (!buffer || buffer.length === 0) return res.status(400).json({ error: "No video data" });

      // 메모리에 저장 (서버 재시작 전까지 유지)
      webmStore.set(contentId, buffer);

      // /tmp 에도 저장 (메모리 부족 시 폴백)
      const fsSync = await import("fs");
      const pathMod = await import("path");
      const tmpDir = "/tmp/shorts";
      if (!fsSync.existsSync(tmpDir)) fsSync.mkdirSync(tmpDir, { recursive: true });
      const tmpPath = pathMod.join(tmpDir, `${contentId}.webm`);
      fsSync.writeFileSync(tmpPath, buffer);

      await storage.updateInventionContent(contentId, {
        shortsVideoUrl: `/api/shorts-video/stream/${contentId}`,
      } as any);

      console.log(`[shorts] WebM 저장: ${contentId} (${buffer.length} bytes) — 메모리+/tmp`);
      res.json({ success: true, url: `/api/shorts-video/stream/${contentId}` });
    } catch (error) {
      console.error("Shorts video save error:", error);
      res.status(500).json({ error: "Failed to save video" });
    }
  });

  app.get("/api/shorts-video/stream/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      const { contentId } = req.params;

      // 1차: 메모리
      const memBuf = webmStore.get(contentId);
      if (memBuf) {
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : memBuf.length - 1;
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${memBuf.length}`,
            "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Type": "video/webm",
          });
          return res.end(memBuf.slice(start, end + 1));
        }
        res.writeHead(200, { "Content-Length": memBuf.length, "Content-Type": "video/webm", "Accept-Ranges": "bytes" });
        return res.end(memBuf);
      }

      // 2차: /tmp
      const fsSync = await import("fs");
      const pathMod = await import("path");
      const tmpPath = pathMod.join("/tmp/shorts", `${contentId}.webm`);
      if (fsSync.existsSync(tmpPath)) {
        const stat = fsSync.statSync(tmpPath);
        res.writeHead(200, { "Content-Length": stat.size, "Content-Type": "video/webm", "Accept-Ranges": "bytes" });
        return fsSync.createReadStream(tmpPath).pipe(res);
      }

      return res.status(404).json({ error: "영상을 찾을 수 없습니다. 서버가 재시작되어 영상이 초기화됐습니다. 다시 녹화해주세요." });
    } catch (error) {
      console.error("Shorts video stream error:", error);
      res.status(500).json({ error: "Failed to stream video" });
    }
  });

  // Convert saved WebM to MP4 using FFmpeg
  app.post("/api/shorts-video/convert-mp4/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      const { contentId } = req.params;
      const format: "reels" | "feed" = req.body?.format === "feed" ? "feed" : "reels";
      const fsSync = await import("fs");
      const pathMod = await import("path");
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      // WebM 소스: 메모리 → /tmp 순서로 탐색
      const tmpDir = "/tmp/shorts";
      if (!fsSync.existsSync(tmpDir)) fsSync.mkdirSync(tmpDir, { recursive: true });
      const webmPath = pathMod.join(tmpDir, `${contentId}.webm`);

      // 메모리에 있으면 /tmp에 다시 써줌
      const memBuf = webmStore.get(contentId);
      if (memBuf && !fsSync.existsSync(webmPath)) {
        fsSync.writeFileSync(webmPath, memBuf);
      }

      if (!fsSync.existsSync(webmPath)) {
        return res.status(404).json({
          error: "서버 재시작으로 영상 데이터가 사라졌습니다. 영상을 다시 녹화해주세요.",
          needReRecord: true,
        });
      }

      const suffix = format === "feed" ? "-feed" : "";
      const mp4Path = pathMod.join(tmpDir, `${contentId}${suffix}.mp4`);
      const urlPath = format === "feed"
        ? `/api/shorts-video/mp4/${contentId}?format=feed`
        : `/api/shorts-video/mp4/${contentId}`;

      // Return cached MP4 if already converted
      if (fs.existsSync(mp4Path)) {
        return res.json({ success: true, url: urlPath, cached: true });
      }

      const [width, height] = format === "feed" ? [1080, 1350] : [1080, 1920];
      console.log(`Converting ${contentId}.webm → MP4 (${format} ${width}x${height})...`);

      // ffmpeg 설치 여부 확인
      try {
        await execFileAsync("ffmpeg", ["-version"]);
      } catch {
        return res.status(500).json({ error: "ffmpeg가 서버에 설치되어 있지 않습니다. 서버 관리자에게 문의하세요." });
      }

      await execFileAsync("ffmpeg", [
        "-y",
        "-i", webmPath,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-pix_fmt", "yuv420p",
        "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        mp4Path,
      ], { maxBuffer: 1024 * 1024 * 100 });

      console.log(`MP4 conversion done: ${contentId}${suffix}.mp4`);
      res.json({ success: true, url: urlPath });
    } catch (error: any) {
      console.error("MP4 conversion error:", error?.message ?? error);
      res.status(500).json({ error: "Conversion failed", detail: error?.message });
    }
  });

  // Stream converted MP4
  app.get("/api/shorts-video/mp4/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      const { contentId } = req.params;
      const isFeed = req.query.format === "feed";
      const suffix = isFeed ? "-feed" : "";
      const path = await import("path");
      const fs = await import("fs");
      // /tmp/shorts 우선, 폴백으로 server/assets/videos
      const filePath = fs.existsSync(path.join("/tmp/shorts", `${contentId}${suffix}.mp4`))
        ? path.join("/tmp/shorts", `${contentId}${suffix}.mp4`)
        : path.join(process.cwd(), "server/assets/videos", `${contentId}${suffix}.mp4`);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "MP4를 찾을 수 없습니다. 변환을 다시 실행해주세요." });

      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      console.error("MP4 stream error:", error);
      res.status(500).json({ error: "Failed to stream MP4" });
    }
  });

  // Check if MP4 already exists for a content
  app.get("/api/shorts-video/mp4-status/:contentId", isAuthenticated, async (req: any, res) => {
    const { contentId } = req.params;
    const path = await import("path");
    const fs = await import("fs");
    const dir = path.join(process.cwd(), "server/assets/videos");
    const reelsExists = fs.existsSync(path.join(dir, `${contentId}.mp4`));
    const feedExists = fs.existsSync(path.join(dir, `${contentId}-feed.mp4`));
    res.json({ exists: reelsExists, feedExists });
  });

  app.delete("/api/shorts-video/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      const { contentId } = req.params;
      const path = await import("path");
      const fs = await import("fs");
      const videosDir = path.join(process.cwd(), "server/assets/videos");
      const webmPath = path.join(videosDir, `${contentId}.webm`);
      const mp4Path = path.join(videosDir, `${contentId}.mp4`);
      const feedMp4Path = path.join(videosDir, `${contentId}-feed.mp4`);
      if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
      if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
      if (fs.existsSync(feedMp4Path)) fs.unlinkSync(feedMp4Path);
      await storage.updateInventionContent(contentId, { shortsVideoUrl: null } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Shorts video delete error:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // Image proxy for CORS-safe downloads (fallback)
  app.get("/api/proxy/image", isAuthenticated, async (req: any, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url query param required" });
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch image" });
      }
      const contentType = response.headers.get("content-type") || "image/png";
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", "attachment");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).json({ error: "Image proxy failed" });
    }
  });

  // Admin routes - user management
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.listUsers();
      res.json(users);
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ message: "Failed to list users" });
    }
  });

  app.patch("/api/admin/users/:id/admin", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isAdmin: makeAdmin } = req.body;
      
      // Prevent removing admin from self
      if ((req.user as any).id === id && !makeAdmin) {
        return res.status(400).json({ message: "Cannot remove admin status from yourself" });
      }
      
      const user = await storage.updateUserAdmin(id, makeAdmin);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting self
      if ((req.user as any).id === id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Brand Analysis API endpoints
  app.post("/api/brand-analyses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = insertBrandAnalysisSchema.parse({
        ...req.body,
        userId,
      });
      const brandAnalysis = await storage.createBrandAnalysis(validatedData);
      res.status(201).json(brandAnalysis);
    } catch (error) {
      console.error("Error creating brand analysis:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create brand analysis" });
    }
  });

  app.get("/api/brand-analyses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const brandAnalyses = await storage.listBrandAnalyses(userId);
      res.json(brandAnalyses);
    } catch (error) {
      console.error("Error listing brand analyses:", error);
      res.status(500).json({ message: "Failed to list brand analyses" });
    }
  });

  app.get("/api/brand-analyses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).id;
      const brandAnalysis = await storage.getBrandAnalysis(id);
      
      if (!brandAnalysis) {
        return res.status(404).json({ message: "Brand analysis not found" });
      }
      
      // Check ownership
      if (brandAnalysis.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(brandAnalysis);
    } catch (error) {
      console.error("Error fetching brand analysis:", error);
      res.status(500).json({ message: "Failed to fetch brand analysis" });
    }
  });

  app.patch("/api/brand-analyses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).id;
      
      const existing = await storage.getBrandAnalysis(id);
      if (!existing) {
        return res.status(404).json({ message: "Brand analysis not found" });
      }
      
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedBrandAnalysis = await storage.updateBrandAnalysis(id, req.body);
      res.json(updatedBrandAnalysis);
    } catch (error) {
      console.error("Error updating brand analysis:", error);
      res.status(500).json({ message: "Failed to update brand analysis" });
    }
  });

  app.delete("/api/brand-analyses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).id;
      
      const existing = await storage.getBrandAnalysis(id);
      if (!existing) {
        return res.status(404).json({ message: "Brand analysis not found" });
      }
      
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteBrandAnalysis(id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting brand analysis:", error);
      res.status(500).json({ message: "Failed to delete brand analysis" });
    }
  });

  // AI Brand Analysis Generation
  app.post("/api/brand-analyses/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { brandName, productService } = req.body;
      
      if (!brandName || !productService) {
        return res.status(400).json({ message: "Brand name and product/service are required" });
      }
      
      const analysis = await generateBrandAnalysis(brandName, productService);
      res.json(analysis);
    } catch (error) {
      console.error("Error generating brand analysis:", error);
      res.status(500).json({ message: "Failed to generate brand analysis" });
    }
  });

  // Generate content endpoint
  app.post("/api/content/generate", isAuthenticatedOrApiKey, async (req: any, res) => {
    try {
      const { keyword, platforms, brandAnalysisId } = req.body;

      if (!keyword || !platforms || !Array.isArray(platforms)) {
        return res.status(400).json({ error: "Invalid request body" });
      }

      const result: any = {
        keyword,
        platforms,
      };

      // Fetch brand analysis if provided
      let brandContext: string | undefined;
      if (brandAnalysisId && typeof brandAnalysisId === "string" && brandAnalysisId !== "none" && brandAnalysisId.trim() !== "") {
        const brandAnalysis = await storage.getBrandAnalysis(brandAnalysisId);
        if (brandAnalysis) {
          console.log(`Using brand analysis: ${brandAnalysis.brandName} - ${brandAnalysis.productService}`);
          brandContext = `
브랜드: ${brandAnalysis.brandName}
제품/서비스: ${brandAnalysis.productService}
USP: ${brandAnalysis.usp}
고객 페르소나: ${brandAnalysis.customerPersona}
고객 Pain Point: ${brandAnalysis.painPoints}
솔루션: ${brandAnalysis.solution}
          `.trim();
        } else {
          console.warn(`Brand analysis not found for ID: ${brandAnalysisId}`);
        }
      }

      let sharedImages: string[] = [];

      // Generate content for each platform
      if (platforms.includes("instagram")) {
        const instagramContent = await generateInstagramContent(keyword, brandContext);
        result.instagramSlides = instagramContent.slides;
        result.instagramCaption = instagramContent.caption;
        result.instagramHashtags = instagramContent.hashtags;
      }

      if (platforms.includes("blog")) {
        const blogContent = await generateBlogContent(keyword, brandContext);
        result.blogTitle = blogContent.title;
        result.blogContent = blogContent.content;
        result.blogMetaDescription = blogContent.metaDescription;
        result.blogTitles = blogContent.titles;
        result.blogThumbnailTexts = blogContent.thumbnailTexts;
        result.blogImageRecommendations = blogContent.imageRecommendations;
        result.blogInternalLinkTopics = blogContent.internalLinkTopics;
        result.blogHashtags = blogContent.hashtags;
        
        // Check if html field exists
        if (blogContent.html) {
          // Always parse and rebuild blog HTML with improved layout
          const sections = parseBlogSections(blogContent.html);
          
          // Generate infographic images for blog sections (main sections only)
          const mainSections = sections.filter(
            s => !s.isIntro && !s.isConclusion && !s.isFAQ && s.heading
          );
          
          // Limit to 4 images
          const sectionsForImages = mainSections.slice(0, 4);
          
          // Limit concurrent image generation to 3 to avoid rate limits
          const limit = pLimit(3);
          const imagePromises = sectionsForImages.map((section) =>
            limit(async () => {
              const summary = extractTextSummary(section.content);
              return await generateBlogInfographic(keyword, section.heading, summary);
            })
          );
          
          let blogImageUrls: string[] = [];
          try {
            blogImageUrls = await Promise.all(imagePromises);
          } catch (imgErr: any) {
            console.warn("블로그 이미지 생성 실패 (텍스트만 반환):", imgErr?.message?.slice(0, 80));
          }
          result.blogImageUrls = blogImageUrls;
          sharedImages = blogImageUrls;

          // Build with inline images
          const blogHtml = buildBlogWithInlineImages(sections, blogImageUrls);
          
          result.blogHtml = blogHtml;
        } else {
          // Fallback if html is not generated
          result.blogHtml = `<div>${blogContent.content}</div>`;
          result.blogImageUrls = [];
        }
      }

      // Generate Instagram images
      if (platforms.includes("instagram")) {
        const limit = pLimit(3);
        
        if (sharedImages.length > 0) {
          // Generate cover slide + use blog images for content slides
          console.log("Generating Instagram cover + using blog images for content slides");
          
          // First slide is cover
          const coverPromise = generateInstagramVisual(
            keyword, 
            result.instagramSlides[0], 
            true // isCover
          );
          
          const [coverImage] = await Promise.all([coverPromise]);
          
          // Check if we need more images for remaining slides
          const neededImages = result.instagramSlides.length - 1; // -1 for cover
          const availableSharedImages = sharedImages.length;
          
          if (neededImages > availableSharedImages) {
            // Generate additional images for slides beyond shared images
            console.log(`Generating ${neededImages - availableSharedImages} additional Instagram images`);
            const remainingSlides = result.instagramSlides.slice(1 + availableSharedImages);
            const additionalImagePromises = remainingSlides.map((slideHeadline: string) =>
              limit(() => generateInstagramVisual(keyword, slideHeadline, false))
            );
            const additionalImages = await Promise.all(additionalImagePromises);
            
            // Combine: cover + shared blog images + additional images
            result.instagramImageUrls = [coverImage, ...sharedImages, ...additionalImages];
          } else {
            // Enough shared images to cover all slides
            result.instagramImageUrls = [coverImage, ...sharedImages.slice(0, neededImages)];
          }
        } else {
          // Generate all Instagram images separately
          console.log("Generating all Instagram images");
          const imagePromises = result.instagramSlides.map((slideHeadline: string, index: number) =>
            limit(async () => {
              try {
                return await generateInstagramVisual(keyword, slideHeadline, index === 0);
              } catch {
                return null;
              }
            })
          );
          const imageUrls = (await Promise.all(imagePromises)).filter(Boolean);
          result.instagramImageUrls = imageUrls;
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error generating content:", error);
      // Gemini 할당량 초과 시 이미지 없이 텍스트만 반환
      if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.message?.includes("quota")) {
        console.log("Gemini quota exceeded - returning text-only content");
        return res.status(500).json({ error: "이미지 생성 할당량 초과. 텍스트 콘텐츠는 정상 생성됩니다. 잠시 후 다시 시도하거나 Gemini API 키를 교체해주세요." });
      }
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // Create content set
  app.post("/api/content-sets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const body = { ...req.body, userId };

      // base64 이미지는 DB에 저장하지 않음 (크기 문제) — URL만 보관
      const stripBase64 = (urls: string[] | undefined) =>
        urls?.map(u => u.startsWith("data:") ? "" : u).filter(Boolean) ?? [];

      body.instagramImageUrls = stripBase64(body.instagramImageUrls);
      body.blogImageUrls = stripBase64(body.blogImageUrls);

      const validated = insertContentSetSchema.parse(body);
      const contentSet = await storage.createContentSet(validated);
      res.json(contentSet);
    } catch (error: any) {
      console.error("Error creating content set:", error);
      res.status(400).json({ error: error.message || "Invalid content set data" });
    }
  });

  // List all content sets for the current user (summary only, large fields stripped)
  app.get("/api/content-sets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const contentSets = await storage.listContentSets(userId);
      const summaries = contentSets.map(({ blogContent, blogHtml, instagramSlides, caption, hashtags, blogImageUrls, instagramImageUrls, ...rest }) => ({
        ...rest,
        instagramImageUrls: instagramImageUrls ? instagramImageUrls.slice(0, 1) : [],
      }));
      res.json(summaries);
    } catch (error: any) {
      console.error("Error listing content sets:", error);
      res.status(500).json({ error: "Failed to list content sets" });
    }
  });

  // Get single content set
  app.get("/api/content-sets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const contentSet = await storage.getContentSet(req.params.id);
      if (!contentSet) {
        return res.status(404).json({ error: "Content set not found" });
      }
      res.json(contentSet);
    } catch (error: any) {
      console.error("Error getting content set:", error);
      res.status(500).json({ error: "Failed to get content set" });
    }
  });

  // Update content set
  app.patch("/api/content-sets/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Validate that updates conform to the schema structure
      const updates = insertContentSetSchema.partial().parse(req.body);
      const contentSet = await storage.updateContentSet(req.params.id, updates);
      if (!contentSet) {
        return res.status(404).json({ error: "Content set not found" });
      }
      res.json(contentSet);
    } catch (error: any) {
      console.error("Error updating content set:", error);
      res.status(400).json({ error: error.message || "Invalid update data" });
    }
  });

  // Delete content set
  app.delete("/api/content-sets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteContentSet(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Content set not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting content set:", error);
      res.status(500).json({ error: "Failed to delete content set" });
    }
  });

  // Schedule content set
  app.post("/api/content-sets/:id/schedule", isAuthenticated, async (req: any, res) => {
    try {
      const { scheduledDate, platforms } = req.body;
      
      if (!scheduledDate) {
        return res.status(400).json({ error: "scheduledDate is required" });
      }

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ error: "platforms array is required" });
      }

      const contentSet = await storage.updateContentSet(req.params.id, {
        scheduledDate: new Date(scheduledDate),
        platforms: platforms,
        status: "scheduled",
      });

      if (!contentSet) {
        return res.status(404).json({ error: "Content set not found" });
      }

      res.json(contentSet);
    } catch (error: any) {
      console.error("Error scheduling content set:", error);
      res.status(500).json({ error: "Failed to schedule content set" });
    }
  });

  // AI Chat for content editing
  app.post("/api/content-sets/:id/chat", isAuthenticated, async (req: any, res) => {
    try {
      const contentSet = await storage.getContentSet(req.params.id);
      if (!contentSet) {
        return res.status(404).json({ error: "Content set not found" });
      }

      const { message, conversationHistory } = chatRequestSchema.parse(req.body);

      const chatResponse = await editContentWithChat(
        contentSet,
        message,
        conversationHistory
      );

      // If there are updates, apply them to the content set
      if (chatResponse.updatedContent && Object.keys(chatResponse.updatedContent).length > 0) {
        const updates: any = { ...chatResponse.updatedContent };
        let sharedImages: string[] = [];

        // Regenerate blog images if blogHtml was updated
        if (updates.blogHtml) {
          console.log("Regenerating blog images for updated content...");
          const sections = parseBlogSections(updates.blogHtml);
          const mainSections = sections.filter(
            s => !s.isIntro && !s.isConclusion && !s.isFAQ && s.heading
          );

          // Limit to 4 images
          const sectionsForImages = mainSections.slice(0, 4);

          if (sectionsForImages.length > 0) {
            const limit = pLimit(3);
            const imagePromises = sectionsForImages.map((section) =>
              limit(() =>
                generateBlogInfographic(
                  contentSet.keyword,
                  section.heading,
                  section.content.substring(0, 200)
                )
              )
            );
            const blogImageUrls = await Promise.all(imagePromises);
            updates.blogImageUrls = blogImageUrls;
            sharedImages = blogImageUrls;
            
            // Rebuild HTML with inline images
            updates.blogHtml = buildBlogWithInlineImages(sections, blogImageUrls);
            console.log(`Generated ${blogImageUrls.length} blog infographic images`);
          }
        }

        // Regenerate Instagram images if slides were updated
        if (updates.instagramSlides && Array.isArray(updates.instagramSlides)) {
          const limit = pLimit(3);
          
          if (sharedImages.length > 0) {
            // Generate cover + use blog images for content slides
            console.log("Generating Instagram cover + using blog images for content slides");
            
            const coverPromise = generateInstagramVisual(
              contentSet.keyword,
              updates.instagramSlides[0],
              true // isCover
            );
            
            const [coverImage] = await Promise.all([coverPromise]);
            
            // Check if we need more images for remaining slides
            const neededImages = updates.instagramSlides.length - 1; // -1 for cover
            const availableSharedImages = sharedImages.length;
            
            if (neededImages > availableSharedImages) {
              // Generate additional images for slides beyond shared images
              console.log(`Generating ${neededImages - availableSharedImages} additional Instagram images`);
              const remainingSlides = updates.instagramSlides.slice(1 + availableSharedImages);
              const additionalImagePromises = remainingSlides.map((slideHeadline: string) =>
                limit(() => generateInstagramVisual(contentSet.keyword, slideHeadline, false))
              );
              const additionalImages = await Promise.all(additionalImagePromises);
              
              // Combine: cover + shared blog images + additional images
              updates.instagramImageUrls = [coverImage, ...sharedImages, ...additionalImages];
            } else {
              // Enough shared images to cover all slides
              updates.instagramImageUrls = [coverImage, ...sharedImages.slice(0, neededImages)];
            }
          } else {
            // Generate all Instagram images separately
            console.log("Regenerating all Instagram images for updated slides...");
            const imagePromises = updates.instagramSlides.map((slideHeadline: string, index: number) =>
              limit(() => generateInstagramVisual(contentSet.keyword, slideHeadline, index === 0))
            );
            updates.instagramImageUrls = await Promise.all(imagePromises);
            console.log(`Generated ${updates.instagramImageUrls.length} Instagram images`);
          }
        }

        await storage.updateContentSet(req.params.id, updates);
      }

      res.json(chatResponse);
    } catch (error: any) {
      console.error("Error in chat editing:", error);
      res.status(500).json({ error: error.message || "Failed to process chat message" });
    }
  });

  // Monthly Plan Routes
  app.get("/api/monthly-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const plans = await storage.listMonthlyPlans(userId);
      res.json(plans);
    } catch (error: any) {
      console.error("Error fetching monthly plans:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/monthly-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const plan = await storage.getMonthlyPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Monthly plan not found" });
      }
      res.json(plan);
    } catch (error: any) {
      console.error("Error fetching monthly plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/monthly-plans/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { year, month, brandAnalysisId, focusTopics } = req.body;
      
      if (!year || !month) {
        return res.status(400).json({ error: "Year and month are required" });
      }

      let brandContext: string | undefined;
      if (brandAnalysisId) {
        const brandAnalysis = await storage.getBrandAnalysis(brandAnalysisId);
        if (brandAnalysis) {
          brandContext = `브랜드명: ${brandAnalysis.brandName}
제품/서비스: ${brandAnalysis.productService}
USP: ${brandAnalysis.usp || "없음"}
고객 페르소나: ${brandAnalysis.customerPersona || "없음"}
Pain Points: ${brandAnalysis.painPoints || "없음"}
Solution: ${brandAnalysis.solution || "없음"}`;
        }
      }

      console.log(`Generating monthly plan for ${year}/${month}...`);
      const planContent = await generateMonthlyPlan(year, month, brandContext, focusTopics);
      
      // Save the plan
      const userId = (req.user as any).id;
      const plan = await storage.createMonthlyPlan({
        userId,
        brandAnalysisId: brandAnalysisId || null,
        year,
        month,
        title: planContent.title,
        themes: planContent.themes,
        contentItems: planContent.contentItems,
      });

      res.json(plan);
    } catch (error: any) {
      console.error("Error generating monthly plan:", error);
      res.status(500).json({ error: error.message || "Failed to generate monthly plan" });
    }
  });

  app.post("/api/monthly-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const planData = {
        ...req.body,
        userId,
      };
      
      const plan = await storage.createMonthlyPlan(planData);
      res.json(plan);
    } catch (error: any) {
      console.error("Error creating monthly plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/monthly-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const plan = await storage.updateMonthlyPlan(req.params.id, req.body);
      if (!plan) {
        return res.status(404).json({ error: "Monthly plan not found" });
      }
      res.json(plan);
    } catch (error: any) {
      console.error("Error updating monthly plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/monthly-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteMonthlyPlan(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Monthly plan not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting monthly plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // YouTube Scripture Content Generation (Holy-AI-Creator 기반 고도화 버전)
  app.post("/api/youtube-scripture/generate", isAuthenticated, async (req, res) => {
    const { extractYouTubeSubtitles } = await import("./scripture-extractor");
    const { generateScriptureContent } = await import("./scripture-generator");

    try {
      const { youtubeUrl, verseHint, transcriptText } = req.body;

      let subtitleText = "";

      if (transcriptText?.trim()) {
        subtitleText = transcriptText.trim();
      } else if (youtubeUrl) {
        const result = await extractYouTubeSubtitles(youtubeUrl);
        if (!result.success || !result.text) {
          return res.status(400).json({
            error: result.error || "자막을 추출할 수 없습니다. '자막 직접 입력' 탭을 사용해 주세요.",
          });
        }
        subtitleText = result.text;
      } else {
        return res.status(400).json({ error: "YouTube URL 또는 자막 텍스트가 필요합니다." });
      }

      if (subtitleText.length < 50) {
        return res.status(400).json({ error: "텍스트가 너무 짧습니다. 최소 50자 이상 필요합니다." });
      }

      const content = await generateScriptureContent(subtitleText, verseHint);

      res.json({
        videoTitle: content.videoTitle,
        videoSummary: content.videoSummary,
        // Holy-AI-Creator 호환 필드
        summary: content.summary,
        coreMessage: content.coreMessage,
        // ContentPilot 기존 호환 필드
        bibleVerse: content.verseContent,
        bibleReference: content.verseReference,
        verseContent: content.verseContent,
        verseReference: content.verseReference,
        instagramSlides: content.instagramSlides,
        instagramCaption: content.caption,
        instagramHashtags: content.hashtags,
        // imageUrls[0] = 메인 썸네일, imageUrls[1..] = 슬라이드 썸네일 (DB 저장)
        imageUrls: [
          ...(content.thumbnailBase64 ? [content.thumbnailBase64] : (content.imageUrl ? [content.imageUrl] : [])),
          ...((content as any).instagramSlideThumbUrls || []),
        ],
        imageBase64: content.imageBase64 || null,
        instagramSlideImages: (content as any).instagramSlideImages || [],
        imageUrl: content.imageUrl,
        caption: content.caption,
        hashtags: content.hashtags,
        blogTitle: `${content.verseReference} 말씀 묵상`,
        blogContent: content.summary.join("\n\n"),
        blogMetaDescription: content.coreMessage.slice(0, 150),
      });
    } catch (error: any) {
      console.error("[youtube-scripture] 생성 오류:", error);
      res.status(500).json({ error: error.message || "콘텐츠 생성 실패" });
    }
  });

  // 기존 저장된 콘텐츠에 이미지 생성/추가
  app.post("/api/scripture-contents/:id/generate-image", isAuthenticated, async (req, res) => {
    const { generateVerseImage } = await import("./scripture-generator");
    try {
      const content = await storage.getScriptureContent(req.params.id);
      if (!content) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });

      const slides = Array.isArray(content.instagramSlides) ? content.instagramSlides : [];
      const { imageBase64, thumbnailBase64, imageUrl, slideImages, slideThumbUrls } = await generateVerseImage(
        content.bibleReference || "",
        content.bibleVerse || "",
        slides
      );

      const mainThumb = thumbnailBase64 ? [thumbnailBase64] : (imageUrl ? [imageUrl] : []);
      const newImageUrls = [...mainThumb, ...slideThumbUrls];

      await storage.updateScriptureContentImages(content.id, newImageUrls);

      res.json({ imageUrls: newImageUrls, imageBase64: imageBase64 || null, instagramSlideImages: slideImages });
    } catch (error: any) {
      console.error("[generate-image] 오류:", error);
      res.status(500).json({ error: error.message || "이미지 생성 실패" });
    }
  });

  // 성경 블로그 콘텐츠 생성
  app.post("/api/youtube-scripture/blog", isAuthenticated, async (req, res) => {
    const { generateScriptureBlog } = await import("./scripture-blog");
    try {
      const { summary, coreMessage, verseReference, verseContent, mainKeyword } = req.body;
      if (!verseReference || !verseContent) {
        return res.status(400).json({ error: "verseReference와 verseContent가 필요합니다." });
      }
      const blog = await generateScriptureBlog(
        Array.isArray(summary) ? summary : [summary || coreMessage],
        coreMessage || "",
        verseReference,
        verseContent,
        mainKeyword
      );
      res.json(blog);
    } catch (error: any) {
      console.error("[scripture-blog] 생성 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 블로그 이미지만 전용 생성 (텍스트 생성 없이 이미지 3장만)
  app.post("/api/youtube-scripture/blog-images", isAuthenticated, async (req, res) => {
    try {
      const { verseReference, verseContent, coreMessage } = req.body;
      if (!verseReference || !verseContent) {
        return res.status(400).json({ error: "verseReference와 verseContent가 필요합니다." });
      }

      const { generateBlogImagesOnly } = await import("./scripture-blog");
      const images = await generateBlogImagesOnly(verseReference, verseContent, coreMessage || "");
      res.json({ images });
    } catch (error: any) {
      console.error("[blog-images] 생성 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── 월간 희망 콘텐츠 ──────────────────────────────────────────────────────────

  // 생성
  app.post("/api/monthly-content/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { generateMonthlyContent } = await import("./monthly-content");
      const { month } = req.body;
      const result = await generateMonthlyContent(month);
      res.json(result);
    } catch (error: any) {
      console.error("[monthly-content] 생성 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 스타일 전환 → 캔버스 오버레이 (빠름, ~1-2초)
  app.post("/api/monthly-content/apply-text", isAuthenticated, async (req: any, res) => {
    try {
      const { applyQuoteToImage } = await import("./monthly-content");
      const { imageBase64, quote, fullText, signature } = req.body;
      if (!imageBase64 || !quote) return res.status(400).json({ error: "imageBase64와 quote가 필요합니다." });
      const result = await applyQuoteToImage(imageBase64, quote, fullText, signature);
      res.json({ imageBase64: result });
    } catch (error: any) {
      console.error("[monthly-content] 캔버스 오버레이 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 고급 이미지 재생성 → gpt-image-1 (20~40초, 고품질)
  app.post("/api/monthly-content/premium-image", isAuthenticated, async (req: any, res) => {
    try {
      const { generateDesignedImage, applyQuoteToImage } = await import("./monthly-content");
      const { style, month, rawImageBase64 } = req.body;
      if (!style) return res.status(400).json({ error: "style이 필요합니다." });
      const date = month ? new Date(`${month}-01`) : new Date();
      const monthNum = date.getMonth() + 1;
      const year = date.getFullYear();
      let result = await generateDesignedImage(monthNum, year, style);
      if (!result && rawImageBase64) result = await applyQuoteToImage(rawImageBase64, style.quote);
      if (!result) return res.status(500).json({ error: "이미지 생성 실패" });
      res.json({ imageBase64: result });
    } catch (error: any) {
      console.error("[monthly-content] 프리미엄 이미지 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 저장
  app.post("/api/monthly-content/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { quote, caption, hashtags, imageBase64, month } = req.body;
      if (!quote) return res.status(400).json({ error: "quote가 필요합니다." });

      const currentMonth = month || new Date().toISOString().slice(0, 7);
      const saved = await storage.createMonthlyContent({
        userId,
        month: currentMonth,
        quote,
        caption: caption || "",
        hashtags: Array.isArray(hashtags) ? hashtags : [],
        imageBase64: imageBase64 || null,
        imageUrl: null,
        status: "draft",
      });
      res.json(saved);
    } catch (error: any) {
      console.error("[monthly-content] 저장 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 목록 조회
  app.get("/api/monthly-content", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const list = await storage.getMonthlyContents(userId);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 삭제
  app.delete("/api/monthly-content/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const ok = await storage.deleteMonthlyContent(req.params.id, userId);
      res.json({ success: ok });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scripture Content CRUD endpoints
  app.post("/api/scripture-contents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const content = await storage.createScriptureContent({
        ...req.body,
        userId,
      });
      res.json(content);
    } catch (error: any) {
      console.error("Error saving scripture content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scripture-contents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { channel } = req.query;
      const contents = await storage.listScriptureContents(userId, channel as string | undefined);
      res.json(contents);
    } catch (error: any) {
      console.error("Error listing scripture contents:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 채널 목록 조회 (scripture_contents 기반)
  app.get("/api/scripture-channels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const channels = await storage.listScriptureChannels(userId);
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scripture-contents/:id", isAuthenticated, async (req, res) => {
    try {
      const content = await storage.getScriptureContent(req.params.id);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      res.json(content);
    } catch (error: any) {
      console.error("Error getting scripture content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/scripture-contents/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteScriptureContent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Content not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting scripture content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Scripture Automation endpoints
  app.get("/api/scripture-automation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const automation = await storage.getScriptureAutomation(userId);
      res.json(automation || null);
    } catch (error: any) {
      console.error("Error getting scripture automation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/scripture-automation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const automation = await storage.upsertScriptureAutomation({
        ...req.body,
        userId,
      });
      res.json(automation);
    } catch (error: any) {
      console.error("Error saving scripture automation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Saved YouTube Channels API
  app.get("/api/saved-youtube-channels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const channels = await storage.listSavedYoutubeChannels(userId);
      res.json(channels);
    } catch (error: any) {
      console.error("Error listing saved channels:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/saved-youtube-channels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { channelUrl, channelName } = req.body;
      if (!channelUrl || !channelName) {
        return res.status(400).json({ error: "Channel URL and name are required" });
      }
      const channel = await storage.createSavedYoutubeChannel({
        userId,
        channelUrl,
        channelName,
      });
      res.json(channel);
    } catch (error: any) {
      console.error("Error saving channel:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/saved-youtube-channels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSavedYoutubeChannel(id);
      if (!deleted) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting channel:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle saved channel active status
  app.patch("/api/saved-youtube-channels/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ error: "isActive must be a boolean" });
      }
      const channel = await storage.toggleSavedYoutubeChannel(id, isActive);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error: any) {
      console.error("Error toggling channel:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual check for all active channels - fetches new videos and generates content
  app.post("/api/saved-youtube-channels/manual-check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const activeChannels = await storage.getActiveSavedYoutubeChannels(userId);
      
      const results: { channelName: string; newVideos: number; generated: number; error?: string }[] = [];
      
      for (const channel of activeChannels) {
        try {
          let channelId: string | null = null;
          
          // Support multiple URL formats: @handle, /channel/ID, /c/name, /user/name
          const directChannelMatch = channel.channelUrl.match(/\/channel\/([A-Za-z0-9_-]+)/);
          if (directChannelMatch) {
            channelId = directChannelMatch[1];
            console.log(`Found direct channel ID: ${channelId}`);
          }
          
          // If not a direct channel URL, try to extract from page
          if (!channelId) {
            try {
              // Try fetching /videos subpage which may have better success rate
              const videoPageUrl = channel.channelUrl.endsWith('/') 
                ? `${channel.channelUrl}videos` 
                : `${channel.channelUrl}/videos`;
              
              const channelPageResponse = await fetch(videoPageUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                  "Cache-Control": "no-cache",
                },
              });
              
              if (channelPageResponse.ok) {
                const channelHtml = await channelPageResponse.text();
                // Try multiple patterns to find channel ID
                let channelIdMatch = channelHtml.match(/"channelId":"(UC[A-Za-z0-9_-]+)"/);
                if (!channelIdMatch) {
                  channelIdMatch = channelHtml.match(/"externalId":"(UC[A-Za-z0-9_-]+)"/);
                }
                if (!channelIdMatch) {
                  channelIdMatch = channelHtml.match(/data-channel-external-id="(UC[A-Za-z0-9_-]+)"/);
                }
                if (!channelIdMatch) {
                  channelIdMatch = channelHtml.match(/channel_id=(UC[A-Za-z0-9_-]+)/);
                }
                
                if (channelIdMatch) {
                  channelId = channelIdMatch[1];
                  console.log(`Extracted channel ID from page: ${channelId}`);
                }
              } else {
                console.log(`Failed to fetch channel page (${channelPageResponse.status}): ${videoPageUrl}`);
              }
            } catch (fetchError: any) {
              console.log(`Error fetching channel page: ${fetchError.message}`);
            }
          }
          
          if (!channelId) {
            console.log(`Could not determine channel ID for: ${channel.channelUrl}`);
            await storage.updateSavedYoutubeChannelLastChecked(channel.id);
            results.push({
              channelName: channel.channelName,
              newVideos: 0,
              generated: 0,
              error: "채널 ID를 찾을 수 없습니다",
            });
            continue;
          }
          
          // Fetch RSS feed for the channel
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          let rssResponse;
          try {
            rssResponse = await fetch(rssUrl);
          } catch (rssError: any) {
            console.log(`Error fetching RSS feed: ${rssError.message}`);
            await storage.updateSavedYoutubeChannelLastChecked(channel.id);
            results.push({
              channelName: channel.channelName,
              newVideos: 0,
              generated: 0,
              error: "RSS 피드를 가져올 수 없습니다",
            });
            continue;
          }
          
          if (!rssResponse.ok) {
            console.log(`Failed to fetch RSS feed for channel (${rssResponse.status}): ${channelId}`);
            await storage.updateSavedYoutubeChannelLastChecked(channel.id);
            results.push({
              channelName: channel.channelName,
              newVideos: 0,
              generated: 0,
              error: `RSS 피드 오류 (${rssResponse.status})`,
            });
            continue;
          }
          
          const rssXml = await rssResponse.text();
          
          // Parse video IDs from RSS feed
          const videoIdPattern = /<yt:videoId>([^<]+)<\/yt:videoId>/g;
          const videoIds: string[] = [];
          let videoMatch;
          while ((videoMatch = videoIdPattern.exec(rssXml)) !== null) {
            videoIds.push(videoMatch[1]);
          }
          
          // Get only the latest 3 videos to avoid overwhelming the system
          const recentVideoIds = videoIds.slice(0, 3);
          
          // Filter out already processed videos
          const processedIds = channel.processedVideoIds || [];
          const newVideoIds = recentVideoIds.filter(id => !processedIds.includes(id));
          
          console.log(`Channel ${channel.channelName}: ${newVideoIds.length} new videos found`);
          
          let generatedCount = 0;
          
          // Generate content for each new video (limit to 1 per check to avoid rate limits)
          for (const videoId of newVideoIds.slice(0, 1)) {
            try {
              const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
              console.log(`Generating content for: ${youtubeUrl}`);
              
              // Fetch transcript and generate content
              let transcript = "";
              const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
              
              try {
                const transcriptResponse = await fetch(youtubeUrl, {
                  headers: {
                    "User-Agent": browserUserAgent,
                    "Accept-Language": "ko-KR,ko;q=0.9",
                  },
                });
                
                if (transcriptResponse.ok) {
                  const html = await transcriptResponse.text();
                  const captionMatch = html.match(/"captionTracks":\s*\[(.*?)\]/);
                  
                  if (captionMatch) {
                    try {
                      const captionData = JSON.parse(`[${captionMatch[1]}]`);
                      const koreanCaption = captionData.find((c: any) => 
                        c.languageCode === "ko" || c.languageCode === "ko-KR"
                      ) || captionData[0];
                      
                      if (koreanCaption?.baseUrl) {
                        const captionUrl = koreanCaption.baseUrl.replace(/\\u0026/g, "&");
                        const captionResponse = await fetch(captionUrl, {
                          headers: { "User-Agent": browserUserAgent },
                        });
                        
                        if (captionResponse.ok) {
                          const captionXml = await captionResponse.text();
                          const textPattern = /<text[^>]*>(.*?)<\/text>/g;
                          const texts: string[] = [];
                          let textMatch;
                          while ((textMatch = textPattern.exec(captionXml)) !== null) {
                            const text = textMatch[1]
                              .replace(/&amp;/g, "&")
                              .replace(/&lt;/g, "<")
                              .replace(/&gt;/g, ">")
                              .replace(/&#39;/g, "'")
                              .replace(/&quot;/g, '"')
                              .replace(/\n/g, " ");
                            texts.push(text);
                          }
                          transcript = texts.join(" ").trim();
                        }
                      }
                    } catch (parseError) {
                      console.log("Failed to parse caption data");
                    }
                  }
                  
                  // Extract video title
                  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
                  const videoTitle = titleMatch ? titleMatch[1].replace(" - YouTube", "") : "Unknown";
                  
                  // If no transcript, use video title as fallback
                  if (!transcript) {
                    transcript = `영상 제목: ${videoTitle}. 이 영상의 핵심 주제와 메시지를 기반으로 적절한 성경 말씀을 추천해주세요.`;
                  }
                  
                  // Generate scripture content (이미지 포함 — scripture-generator 통합 처리)
                  const { generateScriptureContent } = await import("./scripture-generator");
                  const scriptureContent = await generateScriptureContent(transcript);

                  // 썸네일(200×200 JPEG ~8KB)을 imageUrls에 저장, 없으면 Unsplash fallback
                  const imageUrls = scriptureContent.thumbnailBase64
                    ? [scriptureContent.thumbnailBase64]
                    : (scriptureContent.imageUrl ? [scriptureContent.imageUrl] : []);

                  // Save the generated content
                  await storage.createScriptureContent({
                    userId,
                    youtubeUrl,
                    videoTitle: scriptureContent.videoTitle || videoTitle,
                    videoSummary: scriptureContent.videoSummary,
                    bibleVerse: scriptureContent.verseContent,
                    bibleReference: scriptureContent.verseReference,
                    instagramSlides: scriptureContent.instagramSlides,
                    instagramCaption: scriptureContent.caption,
                    instagramHashtags: scriptureContent.hashtags,
                    imageUrls,
                    blogTitle: "",
                    blogContent: scriptureContent.summary.join("\n\n"),
                    blogMetaDescription: scriptureContent.coreMessage.slice(0, 150),
                  });
                  
                  generatedCount++;
                  console.log(`Successfully generated and saved content for: ${videoTitle}`);
                }
              } catch (transcriptError) {
                console.log(`Failed to fetch/process video: ${videoId}`, transcriptError);
              }
              
              // Mark video as processed
              const updatedProcessedIds = [...processedIds, videoId];
              await storage.updateSavedYoutubeChannelProcessedVideos(channel.id, updatedProcessedIds);
              
            } catch (videoError) {
              console.error(`Error processing video ${videoId}:`, videoError);
            }
          }
          
          // Update lastCheckedAt
          await storage.updateSavedYoutubeChannelLastChecked(channel.id);
          
          results.push({
            channelName: channel.channelName,
            newVideos: newVideoIds.length,
            generated: generatedCount,
          });
          
        } catch (channelError) {
          console.error(`Error processing channel ${channel.channelName}:`, channelError);
        }
      }
      
      res.json({ 
        success: true, 
        checkedCount: activeChannels.length,
        results,
      });
    } catch (error: any) {
      console.error("Error during manual check:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Invention Ideas API ==========
  
  // Create invention idea
  app.post("/api/invention-ideas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { title, problem, solution, useCases, targetAudience, tone } = req.body;
      
      if (!title || !problem || !solution) {
        return res.status(400).json({ error: "제목, 문제, 해결책은 필수입니다" });
      }
      
      const idea = await storage.createInventionIdea({
        userId,
        title,
        problem,
        solution,
        useCases: useCases || "",
        targetAudience: targetAudience || [],
        tone: tone || "professional",
        status: "draft",
      });
      
      res.status(201).json(idea);
    } catch (error: any) {
      console.error("Error creating invention idea:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // List user's invention ideas
  app.get("/api/invention-ideas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const ideas = await storage.listInventionIdeas(userId);
      res.json(ideas);
    } catch (error: any) {
      console.error("Error listing invention ideas:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get single invention idea
  app.get("/api/invention-ideas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const idea = await storage.getInventionIdea(req.params.id);
      if (!idea) {
        return res.status(404).json({ error: "아이디어를 찾을 수 없습니다" });
      }
      res.json(idea);
    } catch (error: any) {
      console.error("Error getting invention idea:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update invention idea
  app.patch("/api/invention-ideas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const idea = await storage.updateInventionIdea(req.params.id, req.body);
      if (!idea) {
        return res.status(404).json({ error: "아이디어를 찾을 수 없습니다" });
      }
      res.json(idea);
    } catch (error: any) {
      console.error("Error updating invention idea:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete invention idea
  app.delete("/api/invention-ideas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteInventionIdea(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "아이디어를 찾을 수 없습니다" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting invention idea:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate content for invention idea
  app.post("/api/invention-ideas/:id/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const idea = await storage.getInventionIdea(req.params.id);
      
      if (!idea) {
        return res.status(404).json({ error: "아이디어를 찾을 수 없습니다" });
      }
      
      // Generate content using AI
      const { generateInventionContent } = await import("./ai");
      const generatedContent = await generateInventionContent(idea);
      
      // Generate images for Instagram slides
      const imageLimit = pLimit(3);
      const imagePromises = (generatedContent.instagramSlides || []).slice(0, 5).map((slide: string, index: number) =>
        imageLimit(async () => {
          const prompt = `Professional product concept visualization for invention: ${idea.title}. Scene ${index + 1}: ${slide.substring(0, 50)}. Clean, modern, minimalist design, tech product photography style, bright lighting, white background for clarity`;
          try {
            const imageUrl = await generateInstagramVisual(prompt, "concept");
            return imageUrl;
          } catch (e) {
            console.error("Error generating image:", e);
            return null;
          }
        })
      );
      
      const imageResults = await Promise.all(imagePromises);
      const imageUrls = imageResults.filter((url): url is string => url !== null);
      
      // Save generated content
      const content = await storage.createInventionContent({
        ideaId: idea.id,
        userId,
        contentType: "instagram_shorts_blog",
        instagramSlides: generatedContent.instagramSlides,
        instagramCaption: generatedContent.instagramCaption,
        instagramHashtags: generatedContent.instagramHashtags,
        instagramImageUrls: imageUrls,
        shortsScript: generatedContent.shortsScript,
        shortsScenes: generatedContent.shortsScenes,
        shortsDuration: generatedContent.shortsDuration,
        shortsTitle: generatedContent.shortsTitle,
        shortsHook: generatedContent.shortsHook,
        shortsHashtags: generatedContent.shortsHashtags,
        blogTitle: generatedContent.blogTitle,
        blogContent: generatedContent.blogContent,
        blogHtml: generatedContent.blogHtml,
        blogMetaDescription: generatedContent.blogMetaDescription,
        blogHashtags: generatedContent.blogHashtags,
        copyright: `© ${new Date().getFullYear()} All rights reserved`,
      });
      
      // Update idea status
      await storage.updateInventionIdea(idea.id, { status: "generated" });
      
      res.json(content);
    } catch (error: any) {
      console.error("Error generating invention content:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate blog for existing invention content
  app.post("/api/invention-contents/:id/generate-blog", isAuthenticated, async (req: any, res) => {
    try {
      const content = await storage.getInventionContent(req.params.id);
      if (!content) {
        return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다" });
      }

      const idea = content.ideaId ? await storage.getInventionIdea(content.ideaId) : null;
      if (!idea) {
        return res.status(404).json({ error: "원본 아이디어를 찾을 수 없습니다" });
      }

      const { generateInventionContent } = await import("./ai");
      const generatedContent = await generateInventionContent(idea);

      const updated = await storage.updateInventionContent(req.params.id, {
        blogTitle: generatedContent.blogTitle,
        blogContent: generatedContent.blogContent,
        blogHtml: generatedContent.blogHtml,
        blogMetaDescription: generatedContent.blogMetaDescription,
        blogHashtags: generatedContent.blogHashtags,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error generating blog for invention content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // List invention contents for a user
  app.get("/api/invention-contents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const contents = await storage.listInventionContents(userId);
      // Strip large base64 image fields from list response for performance
      const summaries = contents.map(({ instagramImageUrls, blogImageUrls, blogHtml, blogContent, shortsScript, ...rest }) => ({
        ...rest,
        hasInstagramImages: instagramImageUrls ? instagramImageUrls.length > 0 : false,
        hasBlogImages: blogImageUrls ? blogImageUrls.length > 0 : false,
      }));
      res.json(summaries);
    } catch (error: any) {
      console.error("Error listing invention contents:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get single invention content
  app.get("/api/invention-contents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const content = await storage.getInventionContent(req.params.id);
      if (!content) {
        return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다" });
      }
      res.json(content);
    } catch (error: any) {
      console.error("Error getting invention content:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete invention content
  app.delete("/api/invention-contents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteInventionContent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting invention content:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // AI slide text editing
  app.post("/api/invention-contents/:id/edit-slides", isAuthenticated, async (req: any, res) => {
    try {
      const { slides, instruction, slideIndex } = req.body;
      if (!slides || !Array.isArray(slides) || !instruction) {
        return res.status(400).json({ error: "slides와 instruction이 필요합니다" });
      }
      const idx = typeof slideIndex === "number" ? slideIndex : undefined;
      const editedSlides = await editInventionSlides(slides, instruction, idx);

      // Persist to DB
      await storage.updateInventionContent(req.params.id, { instagramSlides: editedSlides } as any);
      res.json({ slides: editedSlides });
    } catch (error: any) {
      console.error("Slide edit error:", error);
      res.status(500).json({ error: "슬라이드 편집 실패", detail: error?.message });
    }
  });

  // Upload history
  app.get("/api/upload-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const history = await storage.listUploadHistory(userId);
      res.json(history);
    } catch (error: any) {
      console.error("Error listing upload history:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/upload-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { contentId, platform, uploadType, status, externalId, externalUrl, notes } = req.body;
      
      const history = await storage.createUploadHistory({
        userId,
        contentId,
        platform,
        uploadType: uploadType || "manual",
        status: status || "completed",
        externalId,
        externalUrl,
        notes,
      });
      
      res.status(201).json(history);
    } catch (error: any) {
      console.error("Error creating upload history:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch("/api/upload-history/:id", isAuthenticated, async (req: any, res) => {
    try {
      const history = await storage.updateUploadHistory(req.params.id, req.body);
      if (!history) {
        return res.status(404).json({ error: "기록을 찾을 수 없습니다" });
      }
      res.json(history);
    } catch (error: any) {
      console.error("Error updating upload history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Platform Connections ────────────────────────────────────────────
  // GET  /api/platform-connections        — 사용자의 연결된 플랫폼 목록
  // POST /api/platform-connections        — 플랫폼 연결 저장 (upsert)
  // DELETE /api/platform-connections/:platform — 플랫폼 연결 해제

  app.get("/api/platform-connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const connections = await storage.listPlatformConnections(userId);
      // 민감한 토큰 마스킹
      const masked = connections.map((c) => ({
        ...c,
        instagramAccessToken: c.instagramAccessToken ? "***" : null,
        wordpressAppPassword: c.wordpressAppPassword ? "***" : null,
        tistoryAccessToken: c.tistoryAccessToken ? "***" : null,
        naverAccessToken: c.naverAccessToken ? "***" : null,
      }));
      res.json(masked);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/platform-connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const body = { ...req.body };

      // Instagram 토큰 자동 장기 교환 (Facebook Graph API 방식)
      if (body.platform === "instagram" && body.instagramAccessToken) {
        const appId = process.env.INSTAGRAM_APP_ID;
        const appSecret = process.env.INSTAGRAM_APP_SECRET;
        if (appId && appSecret) {
          try {
            // 1단계: 단기 유저 토큰 → 장기 유저 토큰
            const userExchangeUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${body.instagramAccessToken}`;
            const userResp = await fetch(userExchangeUrl);
            const userData = await userResp.json() as any;

            if (userData.access_token) {
              console.log("[Instagram] 장기 유저 토큰 교환 성공");
              const longUserToken = userData.access_token;

              // 2단계: 장기 유저 토큰으로 페이지 토큰 획득
              const pageResp = await fetch(`https://graph.facebook.com/me/accounts?access_token=${longUserToken}`);
              const pageData = await pageResp.json() as any;
              const marrywell = pageData.data?.find((p: any) => p.name === "Marrywell" || p.id === "1082965191562561");

              if (marrywell?.access_token) {
                console.log("[Instagram] 페이지 토큰 획득 성공 (영구 토큰)");
                body.instagramAccessToken = marrywell.access_token;
                body.instagramUserId = "1082965191562561";
              } else {
                console.warn("[Instagram] 페이지 토큰 획득 실패, 장기 유저 토큰 사용");
                body.instagramAccessToken = longUserToken;
              }
            } else {
              console.warn("[Instagram] 장기 토큰 교환 실패:", userData.error?.message);
            }
          } catch (e: any) {
            console.warn("[Instagram] 토큰 교환 오류:", e.message);
          }
        }
      }

      const connection = await storage.upsertPlatformConnection({ ...body, userId });
      res.json({ success: true, platform: connection.platform });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/platform-connections/:platform", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { platform } = req.params;
      const deleted = await storage.deletePlatformConnection(userId, platform);
      res.json({ success: deleted });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 수동 발행 엔드포인트 ─────────────────────────────────────────────────
  // POST /api/publish/:contentSetId   — 특정 콘텐츠 즉시 발행

  app.post("/api/publish/:contentSetId", isAuthenticated, async (req: any, res) => {
    const { publishToInstagram, publishToWordPress, publishToTistory } = await import("./publisher");
    try {
      const userId = (req.user as any).id;
      const { contentSetId } = req.params;

      const contentSet = await storage.getContentSet(contentSetId);
      if (!contentSet || contentSet.userId !== userId) {
        return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
      }

      const results: any[] = [];
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const platforms: string[] = req.body.platforms || contentSet.platforms || [];

      // 프론트에서 전송된 이미지로 DB의 빈 이미지를 보완
      const mergedContentSet = {
        ...contentSet,
        instagramImageUrls: (contentSet.instagramImageUrls?.length)
          ? contentSet.instagramImageUrls
          : (req.body.instagramImageUrls || []),
        blogImageUrls: (contentSet.blogImageUrls?.length)
          ? contentSet.blogImageUrls
          : (req.body.blogImageUrls || []),
      };

      for (const platform of platforms) {
        const conn = await storage.getPlatformConnection(userId, platform === "blog" ? "wordpress" : platform)
          || (platform === "blog" ? await storage.getPlatformConnection(userId, "tistory") : null);

        if (!conn) {
          results.push({ platform, success: false, error: "연결된 계정이 없습니다. 설정에서 연결해주세요." });
          continue;
        }

        if (platform === "instagram") {
          results.push(await publishToInstagram(conn, mergedContentSet as any, baseUrl));
        } else if (platform === "wordpress" || platform === "blog") {
          results.push(await publishToWordPress(conn, mergedContentSet as any));
        } else if (platform === "tistory") {
          results.push(await publishToTistory(conn, mergedContentSet as any));
        }
      }

      // 성공한 플랫폼이 있으면 상태 업데이트
      const anySuccess = results.some((r) => r.success);
      if (anySuccess) {
        await storage.updateContentSetStatus(contentSetId, "published");
      }

      res.json({ results });
    } catch (e: any) {
      console.error("Publish error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 유튜브 말씀 블로그 티스토리 발행 ────────────────────────────────────
  app.post("/api/publish-tistory-blog", isAuthenticated, async (req: any, res) => {
    const { publishToTistory } = await import("./publisher");
    try {
      const userId = (req.user as any).id;
      const { title, content, hashtags = [], category } = req.body;
      if (!title || !content) return res.status(400).json({ error: "제목과 내용이 필요합니다." });

      const conn = await storage.getPlatformConnection(userId, "tistory");
      if (!conn) return res.status(404).json({ error: "티스토리 연결 정보가 없습니다. Settings에서 연결해주세요." });

      const fakeContentSet = {
        keyword: title,
        blogTitle: title,
        blogContent: content,
        blogHtml: content,
        blogHashtags: hashtags,
        platforms: ["tistory"],
      } as any;

      // category: "wisdom lab" | "life lab" | undefined
      const result = await publishToTistory(conn, fakeContentSet, category);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 임시 이미지 서빙 (Instagram 발행용) ─────────────────────────────────
  app.get("/api/images/temp/:id", (req, res) => {
    const { getTempImage } = require("./publisher");
    const img = getTempImage(req.params.id);
    if (!img) return res.status(404).send("Not found");
    const buf = Buffer.from(img.data, "base64");
    res.set("Content-Type", img.mimeType);
    res.set("Cache-Control", "no-store");
    res.send(buf);
  });

  // ─── YouTube Upload API ───────────────────────────────────────────────────

  app.get("/api/youtube-upload/status", isAuthenticated, async (req: any, res) => {
    const { hasYouTubeConfig, isYouTubeAuthenticated } = await import("./youtube-upload");
    const userId = (req.user as any).id;
    res.json({
      isConfigured: hasYouTubeConfig(),
      isAuthenticated: isYouTubeAuthenticated(userId),
    });
  });

  app.get("/api/youtube-upload/auth-url", isAuthenticated, async (req: any, res) => {
    const { getAuthUrl } = await import("./youtube-upload");
    const userId = (req.user as any).id;
    try {
      const authUrl = getAuthUrl(userId, req);
      res.json({ authUrl });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/youtube-upload/callback", async (req: any, res) => {
    const { handleCallback } = await import("./youtube-upload");
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.status(400).send("Invalid callback");
    try {
      await handleCallback(code as string, userId as string, req);
      res.send(`<script>window.opener?.postMessage({type:'youtube-auth-success'},'*');window.close();</script>`);
    } catch (e: any) {
      res.status(400).send(`인증 실패: ${e.message}`);
    }
  });

  app.get("/api/youtube-upload/channels", isAuthenticated, async (req: any, res) => {
    const { getMyYouTubeChannels } = await import("./youtube-upload");
    const userId = (req.user as any).id;
    const channels = await getMyYouTubeChannels(userId);
    res.json({ channels });
  });

  app.post("/api/youtube-upload/logout", isAuthenticated, async (req: any, res) => {
    const { clearTokens } = await import("./youtube-upload");
    const userId = (req.user as any).id;
    clearTokens(userId);
    res.json({ success: true });
  });

  // 말씀 콘텐츠 → YouTube Shorts 업로드
  app.post("/api/youtube-upload/scripture/:id", isAuthenticated, async (req: any, res) => {
    const { uploadVideoToYouTube } = await import("./youtube-upload");
    const userId = (req.user as any).id;
    const { id } = req.params;
    const { title, description, tags, privacyStatus, videoDataUrl } = req.body;

    if (!videoDataUrl) return res.status(400).json({ error: "영상 데이터가 없습니다." });

    try {
      // base64 영상 데이터를 임시 파일로 저장
      const tmpDir = "/tmp/youtube";
      const fs = await import("fs/promises");
      await fs.mkdir(tmpDir, { recursive: true });
      const filePath = `${tmpDir}/scripture-${id}-${Date.now()}.mp4`;

      const base64Data = videoDataUrl.replace(/^data:\w+\/\w+;base64,/, "");
      await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));

      const result = await uploadVideoToYouTube(userId, filePath, {
        title: title || "말씀 콘텐츠",
        description: description || "",
        tags: tags || [],
        privacyStatus: privacyStatus || "private",
      });

      // 임시 파일 삭제
      await fs.unlink(filePath).catch(() => {});

      res.json(result);
    } catch (e: any) {
      console.error("[YouTube Upload]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── 월간 희망 콘텐츠 → YouTube 업로드 ────────────────────────────────────────
  app.post("/api/monthly-content/youtube-upload", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const { imageBase64, title, description, hashtags, privacyStatus } = req.body;

    if (!imageBase64) return res.status(400).json({ error: "이미지 데이터가 없습니다." });

    try {
      const { isYouTubeAuthenticated, uploadVideoToYouTube } = await import("./youtube-upload");

      if (!isYouTubeAuthenticated(userId)) {
        return res.status(401).json({ error: "YouTube 로그인이 필요합니다.", needAuth: true });
      }

      const fs = await import("fs/promises");
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const pathMod = await import("path");
      const execFileAsync = promisify(execFile);

      const tmpDir = "/tmp/monthly";
      await fs.mkdir(tmpDir, { recursive: true });

      const ts = Date.now();
      const imgPath = pathMod.join(tmpDir, `monthly-${ts}.jpg`);
      const mp4Path = pathMod.join(tmpDir, `monthly-${ts}.mp4`);

      // 이미지 저장
      const b64 = imageBase64.replace(/^data:\w+\/\w+;base64,/, "");
      await fs.writeFile(imgPath, Buffer.from(b64, "base64"));

      // ffmpeg: 이미지 → 20초 MP4 (1080x1350, 세로 영상)
      await execFileAsync("ffmpeg", [
        "-y",
        "-loop", "1",
        "-i", imgPath,
        "-c:v", "libx264",
        "-t", "20",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2",
        "-movflags", "+faststart",
        mp4Path,
      ], { maxBuffer: 1024 * 1024 * 200 });

      // YouTube 업로드
      const tags = Array.isArray(hashtags)
        ? hashtags.map((t: string) => t.replace(/^#/, "")).slice(0, 15)
        : [];

      const result = await uploadVideoToYouTube(userId, mp4Path, {
        title: title || "월간 희망 메시지",
        description: description || "",
        tags,
        privacyStatus: privacyStatus || "private",
        categoryId: "22", // People & Blogs
      });

      // 임시 파일 정리
      await fs.unlink(imgPath).catch(() => {});
      await fs.unlink(mp4Path).catch(() => {});

      res.json(result);
    } catch (e: any) {
      console.error("[Monthly YouTube Upload]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
