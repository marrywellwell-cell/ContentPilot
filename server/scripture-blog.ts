/**
 * scripture-blog.ts
 * 메모리 전용 처리 — 파일시스템 없음 (Render ephemeral FS 대응)
 * 블로그 이미지 3장: base64 생성 → Canvas 오버레이 → base64 반환
 */

import OpenAI from "openai";

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
  images: string[];  // base64 data URLs
}

// ── 이미지 생성 (base64 반환, 파일 저장 없음) ─────────────────────────────────

async function generateBlogImageBase64(prompt: string): Promise<string | null> {
  const fullPrompt = (
    "STRICT RULE: absolutely NO people, NO humans, NO faces. " +
    prompt.slice(0, 700) +
    " Photorealistic, high quality, no text in image."
  ).trim();

  // 1차: OpenAI (gpt-image-1 → dall-e-3 → dall-e-2) — 모두 b64_json으로 직접 수신
  if (process.env.OPENAI_API_KEY) {
    const openaiModels = ["gpt-image-1", "dall-e-3", "dall-e-2"] as const;
    for (const model of openaiModels) {
      try {
        const openai = getOpenAI();
        const params: any = {
          model,
          prompt: fullPrompt.slice(0, 1000),
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        };
        const res = await openai.images.generate(params);
        const b64 = res.data?.[0]?.b64_json;
        if (b64) return `data:image/png;base64,${b64}`;
        const url = res.data?.[0]?.url;
        if (url) {
          const imgRes = await fetch(url);
          if (imgRes.ok) return `data:image/png;base64,${Buffer.from(await imgRes.arrayBuffer()).toString("base64")}`;
        }
      } catch (e: any) { console.warn(`[scripture-blog] OpenAI ${model} 실패:`, e.message?.slice(0, 80)); }
    }
  }

  // 2차: Gemini
  if (process.env.GEMINI_API_KEY) {
    const models = ["gemini-2.0-flash-preview-image-generation", "gemini-2.0-flash-exp-image-generation"];
    for (const model of models) {
      try {
        const { GoogleGenAI, Modality } = await import("@google/genai");
        const gemini = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { apiVersion: "v1alpha" },
        });
        const res = await gemini.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
        });
        const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (part?.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      } catch (e: any) { console.warn(`[scripture-blog] Gemini ${model} 실패:`, e.message?.slice(0, 80)); }
    }
  }

  // 3차: Pollinations.ai (무료, API키 불필요)
  try {
    const shortPrompt = encodeURIComponent(
      "spring flowers meadow soft morning light pastel peaceful nature airy bright no text no people photorealistic"
    );
    const seed = Math.floor(Math.random() * 9999999);
    const polRes = await fetch(
      `https://image.pollinations.ai/prompt/${shortPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`,
      { signal: AbortSignal.timeout(45000) }
    );
    if (polRes.ok) {
      const buf = Buffer.from(await polRes.arrayBuffer());
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch (e: any) { console.warn(`[scripture-blog] Pollinations 실패:`, e.message?.slice(0, 80)); }

  return null;
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

// ── 블로그 이미지 3장 생성 (base64 반환) ──────────────────────────────────────

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
    "soft golden morning light through window, open Bible on wooden table, warm serene atmosphere, calming pastel colors",
    "gentle sunrise over calm water, peaceful nature landscape, warm golden hour lighting, spiritual mood",
    "beautiful flower arrangement with soft bokeh, morning dew, warm natural light, clean modern aesthetic",
  ];

  const { addVerseOverlayToBase64 } = await import("./scripture-canvas");
  const images: string[] = [];

  for (let i = 0; i < 3; i++) {
    const verse = allVerses[i];
    const prompt = `Christian devotional image. Background: ${backgrounds[i]}. Minimalist design, square 1:1, no text in image.`;

    const rawBase64 = await generateBlogImageBase64(prompt);
    if (rawBase64) {
      try {
        const withOverlay = await addVerseOverlayToBase64(rawBase64, verse.reference, verse.content);
        images.push(withOverlay);
      } catch {
        images.push(rawBase64);
      }
    }

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
          content: `너는 팔로워가 아주 많고 네이버에서 상위 노출되는 '최고 인기 블로거'야.
1) 독자(타겟): 신앙생활에 관심있는 크리스천
2) 글 목적(CTA): 성경 말씀을 통한 위로와 은혜를 나누고, 댓글·구독·공유 유도
3) 메인 키워드: ${keyword}

<작성 규칙>
- 제목과 첫 문단에 메인 키워드를 자연스럽게 넣기
- 첫 문장은 강력한 Hook으로 시작
- 소제목을 활용해 3~5개의 본론 구성 (소제목은 줄바꿈 후 ■ 기호로 시작)
- 문장은 짧고 명확하게, 한 문단 2~3문장
- 팩트 기반 정보 + 실제 경험 결합
- 독자에게 말하듯 친근하고 신뢰감 있는 톤
- 결론에서는 핵심 요약 3줄 + CTA 포함
- 문단 구분은 빈 줄로 하기
- 반드시 JSON 형식으로 응답

JSON:
{
  "title": "SEO 최적화 제목 (메인 키워드 포함)",
  "content": "전체 글 (순수 텍스트, 빈 줄로 문단 구분)",
  "titles": ["제목 후보1","제목 후보2","제목 후보3"],
  "thumbnailTexts": ["썸네일 문구1","썸네일 문구2"],
  "imageRecommendations": [{"description":"이미지 설명1","altText":"alt1"},{"description":"이미지 설명2","altText":"alt2"},{"description":"이미지 설명3","altText":"alt3"}],
  "internalLinkTopics": ["관련 주제1","관련 주제2","관련 주제3"],
  "hashtags": ["해시태그1","해시태그2","해시태그3","해시태그4","해시태그5","해시태그6","해시태그7","해시태그8","해시태그9","해시태그10"]
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

    // 블로그 이미지 3장 생성 (base64)
    const images = await generateBlogImages(verseReference, verseContent, coreMessage, blogContent);

    return { ...parsed, images };
  } catch (error) {
    console.error("[scripture-blog] 블로그 생성 실패:", error);
    return defaults;
  }
}
