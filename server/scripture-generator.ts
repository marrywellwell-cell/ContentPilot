/**
 * scripture-generator.ts
 * Holy-AI-Creator content-generator.ts 기반으로 ContentPilot에 통합.
 * - 멀티스텝 AI 분석 (긴 영상 지원)
 * - Canvas 한국어 텍스트 오버레이
 * - OpenAI gpt-image-1 이미지 생성 (없으면 Gemini 폴백)
 * - 개역개정 성경 정확도 강화
 */

import OpenAI from "openai";
import * as fs from "fs/promises";
import * as path from "path";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 미설정");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseJsonSafe<T>(content: string | null | undefined, defaults: T): T {
  if (!content) return defaults;
  try { return { ...defaults, ...JSON.parse(content) }; }
  catch { return defaults; }
}

// ─── Canvas 텍스트 오버레이 ───────────────────────────────────────────────────

async function addVerseOverlay(
  imagePath: string,
  verseReference: string,
  verseContent: string
): Promise<void> {
  try {
    const { createCanvas, loadImage, registerFont } = await import("canvas");

    const fontDir = path.join(process.cwd(), "server", "fonts");
    try {
      registerFont(path.join(fontDir, "NotoSansKR-Bold.ttf"), { family: "NotoSansKR", weight: "bold" });
      registerFont(path.join(fontDir, "NotoSansKR-Regular.ttf"), { family: "NotoSansKR", weight: "normal" });
    } catch {}

    const imageBuffer = await fs.readFile(imagePath);
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const padding = 60;
    const maxWidth = image.width - padding * 2;
    const centerX = image.width / 2;
    const centerY = image.height / 2;
    const fontFamily = "NotoSansKR";

    let contentFontSize = 36;
    let refFontSize = 30;
    let lines: string[] = [];
    let lineHeight = contentFontSize * 1.4;

    for (let fontSize = 36; fontSize >= 22; fontSize -= 2) {
      contentFontSize = fontSize;
      refFontSize = Math.max(fontSize - 6, 20);
      lineHeight = fontSize * 1.4;
      ctx.font = `bold ${contentFontSize}px "${fontFamily}"`;
      lines = wrapText(ctx, verseContent, maxWidth, 12);
      const totalHeight = lines.length * lineHeight + refFontSize + 60;
      if (totalHeight <= image.height * 0.7 && lines.length <= 8) break;
    }

    if (lines.length > 8) {
      lines = lines.slice(0, 8);
      lines[7] = lines[7].slice(0, -3) + "...";
    }

    const totalTextHeight = lines.length * lineHeight + refFontSize + 50;
    const textStartY = centerY - totalTextHeight / 2 + lineHeight / 2;
    const boxPadding = 35;
    const boxY = textStartY - lineHeight / 2 - boxPadding;
    const boxHeight = totalTextHeight + boxPadding * 2;
    const radius = 20;
    const boxX = padding - boxPadding;
    const boxWidth = image.width - (padding - boxPadding) * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxWidth - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
    ctx.lineTo(boxX + radius, boxY + boxHeight);
    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${contentFontSize}px "${fontFamily}"`;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    lines.forEach((line, i) => ctx.fillText(line, centerX, textStartY + i * lineHeight));

    ctx.font = `${refFontSize}px "${fontFamily}"`;
    ctx.fillStyle = "#e0e0e0";
    ctx.fillText(`- ${verseReference} -`, centerX, textStartY + lines.length * lineHeight + 35);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.font = `16px "${fontFamily}"`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("AI 생성 이미지", image.width - 20, image.height - 15);

    await fs.writeFile(imagePath, canvas.toBuffer("image/png"));
  } catch (error) {
    console.error("[scripture-generator] Canvas overlay 실패:", error);
  }
}

function wrapText(ctx: any, text: string, maxWidth: number, maxLines = 8): string[] {
  if (!text?.trim()) return [""];
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      if (ctx.measureText(word).width > maxWidth) {
        let remaining = word;
        while (remaining.length > 0) {
          let charLine = "";
          for (const char of remaining) {
            if (ctx.measureText(charLine + char).width > maxWidth && charLine.length > 0) break;
            charLine += char;
          }
          lines.push(charLine);
          remaining = remaining.slice(charLine.length);
        }
        currentLine = "";
      } else {
        currentLine = word;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, maxLines);
}

// ─── 이미지 생성 (gpt-image-1 → Gemini 폴백) ─────────────────────────────────

async function generateScriptureImageFile(
  prompt: string,
  filename: string
): Promise<string | null> {
  const generatedDir = path.join(process.cwd(), "client", "public", "generated");
  await fs.mkdir(generatedDir, { recursive: true });
  const filePath = path.join(generatedDir, filename);

  // gpt-image-1 시도
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAI();
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: (prompt + " No text in image. High quality, photorealistic.").slice(0, 1000),
        n: 1,
        size: "1024x1024",
      });
      const imageUrl = response.data?.[0]?.url;
      if (imageUrl) {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          await fs.writeFile(filePath, Buffer.from(buffer));
          return filePath;
        }
      }
    } catch (err: any) {
      console.warn("[scripture-generator] gpt-image-1 실패:", err.message);
    }
  }

  // Gemini 폴백
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");
      const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const res = await gemini.models.generateContent({
        model: "gemini-2.0-flash-exp-image-generation",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      });
      const imagePart = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (imagePart?.inlineData?.data) {
        await fs.writeFile(filePath, Buffer.from(imagePart.inlineData.data, "base64"));
        return filePath;
      }
    } catch (err: any) {
      console.warn("[scripture-generator] Gemini 이미지 생성 실패:", err.message);
    }
  }

  return null;
}

// ─── AI 콘텐츠 생성 (Holy-AI-Creator 멀티스텝 방식) ─────────────────────────

export interface ScriptureGeneratedContent {
  summary: string[];
  coreMessage: string;
  verseReference: string;
  verseContent: string;
  imageUrl: string;         // 서버 서빙 경로
  imageBase64?: string;     // DB 저장용 base64
  caption: string;
  hashtags: string[];
  instagramSlides: string[];
  videoTitle: string;
  videoSummary: string;
}

export async function generateScriptureContent(
  subtitleText: string,
  verseHint?: string
): Promise<ScriptureGeneratedContent> {
  const openai = getOpenAI();
  const maxChunkSize = 6000;

  const defaultText = {
    summary: ["영상 내용을 요약하는 중 오류가 발생했습니다."],
    coreMessage: "하나님의 사랑과 은혜가 함께하시길 바랍니다.",
    verseReference: "로마서 8:28",
    verseContent: "우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라",
  };

  let textContent = { ...defaultText };
  let analysisContext = "";

  // ── Step 1a: 긴 영상 구조 분석 ───────────────────────────────────────────
  if (subtitleText.length > maxChunkSize) {
    try {
      const chunks: string[] = [];
      for (let i = 0; i < subtitleText.length; i += maxChunkSize) {
        chunks.push(subtitleText.slice(i, i + maxChunkSize));
      }
      const keyParts = [chunks[0], chunks[Math.floor(chunks.length / 2)], chunks[chunks.length - 1]].filter(Boolean);

      const structRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `당신은 영상 콘텐츠 분석 전문가입니다. 다음을 JSON으로 분석하세요:
{ "mainTopic": "주요 주제", "keyPoints": ["핵심 포인트1",...], "mainArgument": "핵심 주장", "biblicalReferences": ["언급된 성경 구절"] }`,
          },
          {
            role: "user",
            content: `--- 서론 ---\n${keyParts[0]?.slice(0, 2000)}\n\n--- 중간 ---\n${keyParts[1]?.slice(0, 2000)}\n\n--- 결론 ---\n${keyParts[2]?.slice(0, 2000)}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const sa = parseJsonSafe(structRes.choices[0]?.message?.content, { mainTopic: "", keyPoints: [] as string[], mainArgument: "", biblicalReferences: [] as string[] });
      analysisContext = `[사전 분석]\n주제: ${sa.mainTopic}\n핵심: ${sa.keyPoints.join(", ")}\n주장: ${sa.mainArgument}\n성경: ${sa.biblicalReferences.join(", ")}\n\n`;
    } catch (e) {
      console.warn("[scripture-generator] 구조 분석 실패:", e);
    }
  }

  // ── Step 1b: 요약 + 말씀 추출 ─────────────────────────────────────────────
  try {
    const textRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `당신은 기독교 콘텐츠 분석 전문가입니다.

핵심 말씀 추출 원칙:
- 영상에서 설교자가 직접 언급한 성경 구절을 찾아 추출
- 반드시 개역개정(개역개정한글판) 번역 원문을 사용
- verseContent에 구절 전체를 빠짐없이 기재 (생략 금지)
- 단어 변형 금지 (예: "흩어"→"후히" 불가)

출력 JSON:
{
  "summary": ["1. 주제/배경", "2. 핵심1", "3. 핵심2", "4. 핵심3/예시", "5. 결론/적용"],
  "coreMessage": "설교자의 핵심 메시지 한 문장",
  "verseReference": "로마서 8:28",
  "verseContent": "우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라"
}`,
        },
        {
          role: "user",
          content: `${analysisContext}[자막]\n${subtitleText.slice(0, 10000)}${verseHint ? `\n\n힌트: ${verseHint}` : ""}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = parseJsonSafe(textRes.choices[0]?.message?.content, defaultText);
    if (!Array.isArray(parsed.summary) || parsed.summary.length === 0) parsed.summary = defaultText.summary;
    parsed.summary = parsed.summary.filter((s: string) => s?.trim()).slice(0, 5);
    while (parsed.summary.length < 5) parsed.summary.push("");
    textContent = parsed;
  } catch (e) {
    console.error("[scripture-generator] 텍스트 생성 실패:", e);
  }

  // ── Step 2: 인스타그램 슬라이드 생성 ─────────────────────────────────────
  let instagramSlides: string[] = [];
  try {
    const slideRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: `인스타그램 카드뉴스용 슬라이드 5장을 만드세요.
JSON: { "slides": ["커버(15자이내)", "핵심1(12자이내)", "핵심2(12자이내)", "핵심3(12자이내)", "CTA(12자이내)"] }`,
        },
        {
          role: "user",
          content: `말씀: ${textContent.verseReference} — "${textContent.verseContent}"\n핵심: ${textContent.coreMessage}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseJsonSafe(slideRes.choices[0]?.message?.content, { slides: [] as string[] });
    instagramSlides = Array.isArray(parsed.slides) ? parsed.slides.slice(0, 5) : [];
  } catch {}

  // ── Step 3: 캡션 + 해시태그 ───────────────────────────────────────────────
  let caption = "";
  let hashtags: string[] = [];
  try {
    const captionRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: `크리스천 인스타그램 캡션을 작성하세요.
JSON: { "caption": "캡션 전문", "hashtags": ["#해시태그1",...(8-10개)] }`,
        },
        {
          role: "user",
          content: `말씀: ${textContent.verseReference} — "${textContent.verseContent}"\n핵심: ${textContent.coreMessage}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseJsonSafe(captionRes.choices[0]?.message?.content, { caption: "", hashtags: [] as string[] });
    caption = parsed.caption || "";
    hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
  } catch {}

  // ── Step 4: 이미지 생성 + Canvas 오버레이 ────────────────────────────────
  const imagePrompt = `Christian devotional image. Peaceful spiritual atmosphere, soft golden morning light, open Bible on wooden table or serene nature landscape. Warm colors, high quality, minimalist, square 1:1 format. DO NOT include any text.`;
  const filename = `scripture-${Date.now()}.png`;
  let imageUrl = "";
  let imageBase64: string | undefined;

  const filePath = await generateScriptureImageFile(imagePrompt, filename);
  if (filePath) {
    // Canvas 텍스트 오버레이
    await addVerseOverlay(filePath, textContent.verseReference, textContent.verseContent);
    imageUrl = `/generated/${filename}`;
    // base64 저장 (DB용)
    try {
      const buf = await fs.readFile(filePath);
      imageBase64 = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {}
  } else {
    imageUrl = "https://images.unsplash.com/photo-1499652848871-1527a310b13a?w=1080&h=1080&fit=crop";
  }

  const hashtagStr = hashtags.join(" ");
  const fullCaption = caption ? `${caption}\n\n${hashtagStr}` : hashtagStr;

  return {
    summary: textContent.summary,
    coreMessage: textContent.coreMessage,
    verseReference: textContent.verseReference,
    verseContent: textContent.verseContent,
    imageUrl,
    imageBase64,
    caption: fullCaption,
    hashtags,
    instagramSlides,
    videoTitle: textContent.coreMessage.slice(0, 50) || "말씀 콘텐츠",
    videoSummary: textContent.summary.join(" "),
  };
}
