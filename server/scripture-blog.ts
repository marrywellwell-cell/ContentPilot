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
          content: `너는 경건하고 은혜로운 기독교 신앙 블로그를 운영하는 블로거야. 티스토리·네이버에서 상위 노출되며 독자들로부터 큰 위로와 공감을 받는 글을 쓴다.

메인 키워드: ${keyword}
독자: 신앙생활 중 어려움과 고민을 겪는 크리스천
목적: 성경 말씀을 통한 위로·은혜·적용 나눔

⚠️ 절대 규칙: content 필드는 순수 텍스트만 사용. HTML 태그(<p>, <br>, <b>, <h2> 등) 절대 사용 금지. 줄바꿈은 실제 개행문자(\\n)로만 처리.

<글 구조 — 반드시 이 순서로>
1. [서론] 독자의 공감을 끄는 일상적 상황이나 감정으로 시작. 2~3문장. 메인 키워드 자연스럽게 포함.
2. [말씀 소개] 오늘의 성경 구절을 소개하고 구절의 배경·의미 설명. 1~2문단.
3. [본론 소제목 3~4개] 각 소제목은 "■ " 기호로 시작. 각 섹션마다 2~3문단(문단당 2~3문장). 말씀을 실제 삶에 적용하는 내용 중심.
4. [결론] "어려운 상황 속에서도 ~" 식의 격려 + 기도 혹은 소망의 말로 마무리. 댓글·공유 유도 CTA 포함.

<문체 규칙>
- "우리"의 시점으로 공감 형성 ("우리는", "우리의 삶에서")
- 경건하고 따뜻한 톤 — 설교조 아닌 친구처럼 나누는 말투
- 이모지 사용 금지
- HTML 태그 사용 금지 — 순수 텍스트로만 작성
- 문단 사이 빈 줄(\\n\\n)로 구분
- 문장은 간결하게 (한 문장 40자 이내 권장)
- 성경 구절 인용 시 따옴표로 감싸기: "말씀 원문"
- 제목과 첫 문단에 메인 키워드 자연 삽입
- 전체 분량: 1,200~1,800자

<참고 스타일 예시>
서론: "마음이 흔들릴 때, 우리는 하나님께서 우리의 삶을 붙잡고 계신다는 사실을 잊기 쉽습니다."
소제목: "■ 말씀이 주는 약속"
결론: "어려운 상황 속에서 희망을 잃지 말고, 하나님을 믿고 일어설 수 있는 여러분이 되길 기도합니다."

JSON:
{
  "title": "SEO 최적화 제목 (메인 키워드 포함, 30자 이내)",
  "content": "전체 글 (순수 텍스트, 빈 줄로 문단 구분, 이모지 없음)",
  "titles": ["제목 후보1","제목 후보2","제목 후보3"],
  "thumbnailTexts": ["썸네일 문구1 (15자 이내)","썸네일 문구2 (15자 이내)"],
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
