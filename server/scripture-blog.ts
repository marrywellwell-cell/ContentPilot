/**
 * scripture-blog.ts
 * Holy-AI-Creator blog-content-generator.ts 기반.
 * 성경 말씀 기반 네이버 블로그 콘텐츠 + 관련 구절 3개 이미지 생성.
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

export interface ScriptureBlogContent {
  title: string;
  content: string;
  titles: string[];
  thumbnailTexts: string[];
  imageRecommendations: { description: string; altText: string }[];
  internalLinkTopics: string[];
  hashtags: string[];
  images: string[];     // 서버 서빙 경로 (/generated/...)
}

// ── 관련 성경 구절 2개 추천 ──────────────────────────────────────────────────

async function generateRelatedVerses(
  mainRef: string,
  mainContent: string,
  coreMessage: string,
  blogContent: string
): Promise<{ reference: string; content: string }[]> {
  const openai = getOpenAI();
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `성경 전문가로서, 블로그 내용과 어울리는 서로 다른 책의 구절 2개를 추천하세요.
규칙: 개역개정 원문 사용, 생략 금지, 단어 변형 금지, 메인 구절과 달라야 함.
JSON: { "verses": [{"reference":"...","content":"전체 원문"},{"reference":"...","content":"전체 원문"}] }`,
        },
        {
          role: "user",
          content: `메인: ${mainRef} - "${mainContent}"\n핵심: ${coreMessage}\n블로그: ${blogContent.substring(0, 1500)}`,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    return parsed.verses || [];
  } catch {
    return [
      { reference: mainRef, content: mainContent },
      { reference: mainRef, content: mainContent },
    ];
  }
}

// ── 이미지 생성 (gpt-image-1 → Gemini) ──────────────────────────────────────

async function generateBlogImageFile(prompt: string, filename: string): Promise<string | null> {
  const generatedDir = path.join(process.cwd(), "client", "public", "generated");
  await fs.mkdir(generatedDir, { recursive: true });
  const filePath = path.join(generatedDir, filename);

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAI();
      const res = await openai.images.generate({
        model: "dall-e-3",
        prompt: (prompt + " No text in image. Photorealistic.").slice(0, 1000),
        n: 1, size: "1024x1024",
      });
      const imageUrl = res.data?.[0]?.url;
      if (imageUrl) {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          await fs.writeFile(filePath, Buffer.from(await imgRes.arrayBuffer()));
          return filePath;
        }
      }
    } catch (e: any) { console.warn("[scripture-blog] dall-e-3:", e.message); }
  }

  if (process.env.GEMINI_API_KEY) {
    const geminiModels = ["gemini-2.0-flash-preview-image-generation", "gemini-2.0-flash-exp-image-generation"];
    for (const model of geminiModels) {
      try {
        const { GoogleGenAI, Modality } = await import("@google/genai");
        const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
        const res = await gemini.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
        });
        const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (part?.inlineData?.data) {
          await fs.writeFile(filePath, Buffer.from(part.inlineData.data, "base64"));
          return filePath;
        }
      } catch (e: any) { console.warn(`[scripture-blog] Gemini ${model}:`, e.message?.slice(0, 80)); }
    }
  }

  return null;
}

// ── 블로그 이미지 3장 생성 + Canvas 오버레이 ─────────────────────────────────

async function generateBlogImages(
  mainRef: string,
  mainContent: string,
  coreMessage: string,
  blogContent: string
): Promise<string[]> {
  const relatedVerses = await generateRelatedVerses(mainRef, mainContent, coreMessage, blogContent);

  const allVerses = [
    { reference: mainRef, content: mainContent },
    relatedVerses[0] || { reference: mainRef, content: mainContent },
    relatedVerses[1] || { reference: mainRef, content: mainContent },
  ];

  const backgrounds = [
    "soft golden morning light through window, open Bible on wooden table, warm serene atmosphere, calming pastel colors, leave bottom 35% clear for text",
    "gentle sunrise over calm water, peaceful nature landscape, warm golden hour lighting, spiritual mood, leave bottom 35% clear for text",
    "beautiful flower arrangement with soft bokeh, morning dew, warm natural light, clean modern aesthetic, leave bottom 35% clear for text",
  ];

  const images: string[] = [];

  for (let i = 0; i < 3; i++) {
    const verse = allVerses[i];
    const prompt = `Christian devotional image. Background: ${backgrounds[i]}. Minimalist design, square 1:1, no text in image.`;
    const filename = `blog-scripture-${Date.now()}-${i + 1}.png`;

    const filePath = await generateBlogImageFile(prompt, filename);
    if (filePath) {
      // Canvas 텍스트 오버레이
      try {
        const { addVerseOverlayPublic } = await import("./scripture-canvas");
        await addVerseOverlayPublic(filePath, verse.reference, verse.content);
      } catch {}
      images.push(`/generated/${filename}`);
    }
    // API 레이트 리밋 방지
    if (i < 2) await new Promise((r) => setTimeout(r, 1500));
  }

  return images;
}

// ── 메인 블로그 콘텐츠 생성 ──────────────────────────────────────────────────

export async function generateScriptureBlog(
  summary: string[],
  coreMessage: string,
  verseReference: string,
  verseContent: string,
  mainKeyword?: string
): Promise<ScriptureBlogContent> {
  const openai = getOpenAI();
  const keyword = mainKeyword || verseReference.split(" ")[0] || "오늘의 말씀";

  const defaults: ScriptureBlogContent = {
    title: `${verseReference} 말씀 묵상`,
    content: "",
    titles: [],
    thumbnailTexts: [],
    imageRecommendations: [],
    internalLinkTopics: [],
    hashtags: [],
    images: [],
  };

  let blogContent = "";

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `네이버 상위 노출 인기 블로거 스타일로 글을 작성하세요.
메인 키워드: ${keyword}
독자: 신앙생활에 관심있는 크리스천
목적: 성경 말씀을 통한 위로와 은혜 나눔

규칙:
- 첫 문장은 강력한 Hook
- 소제목은 ■ 기호로 시작
- 짧고 명확한 문장 (2~3문장/문단)
- 결론에서 핵심 요약 3줄 + CTA
- 반드시 JSON 형식으로 응답

JSON:
{
  "title": "SEO 최적화 제목",
  "content": "전체 글 (순수 텍스트)",
  "titles": ["제목1","제목2","제목3"],
  "thumbnailTexts": ["썸네일1","썸네일2"],
  "imageRecommendations": [{"description":"설명1","altText":"alt1"},{"description":"설명2","altText":"alt2"},{"description":"설명3","altText":"alt3"}],
  "internalLinkTopics": ["관련주제1","관련주제2","관련주제3"],
  "hashtags": ["해시태그1",...(10개)]
}`,
        },
        {
          role: "user",
          content: `성경 말씀: ${verseReference}\n"${verseContent}"\n\n핵심 메시지: ${coreMessage}\n\n영상 요약:\n${summary.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = parseJsonSafe(res.choices[0]?.message?.content, defaults);
    if (!Array.isArray(parsed.titles)) parsed.titles = [];
    if (!Array.isArray(parsed.thumbnailTexts)) parsed.thumbnailTexts = [];
    if (!Array.isArray(parsed.imageRecommendations)) parsed.imageRecommendations = [];
    if (!Array.isArray(parsed.internalLinkTopics)) parsed.internalLinkTopics = [];
    if (!Array.isArray(parsed.hashtags)) parsed.hashtags = [];
    blogContent = parsed.content || "";

    // 블로그 이미지 3장 생성
    const images = await generateBlogImages(verseReference, verseContent, coreMessage, blogContent);

    return { ...parsed, images };
  } catch (error) {
    console.error("[scripture-blog] 블로그 생성 실패:", error);
    return defaults;
  }
}
