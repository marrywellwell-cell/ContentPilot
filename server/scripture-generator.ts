/**
 * scripture-generator.ts
 * 메모리 전용 처리 — 파일시스템 없음 (Render ephemeral FS 대응)
 * 이미지: ai.ts의 generateImage()와 동일한 로직 사용 (검증된 방법)
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

// ─── 이미지 생성 (ai.ts와 동일한 방식 — 검증된 로직) ────────────────────────

async function generateScriptureImageBase64(prompt: string): Promise<string | null> {
  const fullPrompt = (
    "STRICT RULE: absolutely NO people, NO humans, NO faces, NO body parts. " +
    prompt.slice(0, 700) +
    " Photorealistic, high quality, no text in image."
  ).trim();

  // 1차: OpenAI (gpt-image-1 → dall-e-3 → dall-e-2) — 모두 b64_json으로 직접 수신
  if (process.env.OPENAI_API_KEY) {
    const openaiModels = [
      "gpt-image-1",
      "dall-e-3",
      "dall-e-2",
    ] as const;

    for (const model of openaiModels) {
      try {
        console.log(`[scripture] OpenAI ${model} 시도...`);
        const openai = getOpenAI();
        const params: any = {
          model,
          prompt: fullPrompt.slice(0, 1000),
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        };

        const response = await openai.images.generate(params);
        const b64 = response.data?.[0]?.b64_json;

        if (b64) {
          console.log(`[scripture] OpenAI ${model} 성공 (base64)`);
          return `data:image/png;base64,${b64}`;
        }
        // URL 응답 폴백 (gpt-image-1이 URL을 반환하는 경우)
        const url = response.data?.[0]?.url;
        if (url) {
          console.log(`[scripture] OpenAI ${model} 성공 (url fetch)`);
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            return `data:image/png;base64,${buf.toString("base64")}`;
          }
        }
      } catch (err: any) {
        console.warn(`[scripture] OpenAI ${model} 실패:`, err?.message?.slice(0, 100));
      }
    }
  }

  // 2차: Gemini (v1alpha image generation models)
  if (process.env.GEMINI_API_KEY) {
    const geminiModels = [
      "gemini-2.0-flash-preview-image-generation",
      "gemini-2.0-flash-exp-image-generation",
    ];

    for (const model of geminiModels) {
      try {
        console.log(`[scripture] Gemini ${model} 시도...`);
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
          const mimeType = part.inlineData.mimeType || "image/png";
          console.log(`[scripture] Gemini ${model} 성공`);
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      } catch (err: any) {
        console.warn(`[scripture] Gemini ${model} 실패:`, err?.message?.slice(0, 100));
      }
    }
  }

  // 3차: Pollinations.ai (무료, API키 불필요, 매번 다른 이미지)
  try {
    console.log("[scripture] Pollinations.ai 시도...");
    const shortPrompt = encodeURIComponent(
      "spring cherry blossom flowers soft morning light pastel meadow peaceful nature airy bright no text no people photorealistic high key"
    );
    const seed = Math.floor(Math.random() * 9999999);
    const polUrl = `https://image.pollinations.ai/prompt/${shortPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
    const polRes = await fetch(polUrl, { signal: AbortSignal.timeout(45000) });
    if (polRes.ok) {
      const buf = Buffer.from(await polRes.arrayBuffer());
      console.log("[scripture] Pollinations.ai 성공");
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch (err: any) {
    console.warn("[scripture] Pollinations.ai 실패:", err?.message?.slice(0, 80));
  }

  console.warn("[scripture] 모든 이미지 생성 실패 — Unsplash 폴백 사용");
  return null;
}

// ─── 슬라이드별 배경 이미지 (Pollinations.ai 무료) ───────────────────────────

async function fetchSlideBackground(slideText: string, slideIndex: number): Promise<string | null> {
  try {
    const base = slideTextToImagePrompt(slideText, slideIndex);
    const prompt = encodeURIComponent(
      `${base.slice(0, 180)} bright pastel light airy high key photography no text no people no faces`
    );
    const seed = Math.floor(Math.random() * 9_999_999) + slideIndex * 7919;
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1080&nologo=true&seed=${seed}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch {}
  return null;
}

async function fetchAllSlideBackgrounds(slides: string[]): Promise<(string | null)[]> {
  return Promise.all(slides.map((text, i) => fetchSlideBackground(text, i)));
}

// ─── 슬라이드 텍스트 → 이미지 프롬프트 변환 ─────────────────────────────────

function slideTextToImagePrompt(slideText: string, slideIndex: number): string {
  const text = slideText.toLowerCase();

  // 슬라이드 주제 → 자연/풍경/꽃 이미지 (성경책·교회 제외)
  const keywordMap: [string[], string][] = [
    [["사랑", "love", "애정", "섬기", "헌신"],
      "beautiful pink cherry blossom flowers spring branches blue sky soft bokeh"],
    [["기도", "pray", "기원", "간구", "주님께", "맡기"],
      "peaceful misty mountain valley morning golden light serene meadow"],
    [["믿음", "faith", "신뢰", "확신", "의지"],
      "bright sunlight rays breaking through forest canopy trees green nature"],
    [["평화", "peace", "평안", "안식", "쉼", "안에서"],
      "calm serene lake reflection soft morning mist pastel sky"],
    [["은혜", "grace", "축복", "감사", "blessing"],
      "golden autumn maple leaves falling soft light bokeh warm"],
    [["말씀", "word", "성경", "scripture"],
      "beautiful sunrise over calm ocean horizon golden hour waves"],
    [["하나님", "god", "주님", "lord", "예수", "jesus"],
      "majestic snow mountain peaks above clouds golden sunrise sky"],
    [["찬양", "praise", "worship", "경배"],
      "colorful wildflower meadow sunshine vibrant tulips spring field"],
    [["겸손", "humble", "낮아짐", "내려"],
      "small delicate white flower morning dew drops macro soft bokeh"],
    [["소망", "hope", "기대", "미래", "새로운", "비전"],
      "rainbow over green valley after rain colorful sky bright"],
    [["공동체", "community", "함께", "연합"],
      "warm golden afternoon light through window cozy interior autumn"],
    [["치유", "heal", "회복", "restoration"],
      "clear waterfall flowing green forest sunlight mist fresh nature"],
    [["순종", "obey", "따름", "돌보", "돌봄"],
      "green rolling pastoral hills sheep countryside sunrise peaceful"],
    [["영적", "spirit", "성령"],
      "starry night sky milky way galaxy stars cosmos long exposure"],
    [["새로운", "변화", "시작", "새출발"],
      "fresh green sprout seedling morning dew soft sunlight new growth"],
    [["염려", "걱정", "두려움"],
      "calm butterfly on lavender flower soft pastel background bokeh"],
  ];

  for (const [keywords, prompt] of keywordMap) {
    if (keywords.some(k => text.includes(k))) {
      return `${prompt} photorealistic bright airy high quality no text no people no faces`;
    }
  }

  // 슬라이드 순서별 기본 다양 이미지
  const defaults = [
    "beautiful spring cherry blossom path pink flowers blue sky bright",
    "golden wheat field sunset horizon warm light pastoral peaceful",
    "colorful tulip flower garden vibrant spring sunshine close up",
    "majestic mountain lake reflection sunrise misty morning serene",
    "green bamboo forest morning light rays mist tranquil peaceful",
  ];
  return `${defaults[slideIndex % defaults.length]} photorealistic bright no text no people high quality`;
}

// ─── AI 콘텐츠 생성 ──────────────────────────────────────────────────────────

export interface ScriptureGeneratedContent {
  summary: string[];
  coreMessage: string;
  verseReference: string;
  verseContent: string;
  imageUrl: string;
  imageBase64?: string;
  thumbnailBase64?: string;
  caption: string;
  hashtags: string[];
  instagramSlides: string[];
  instagramSlideImages: string[];      // 슬라이드별 풀사이즈 이미지 (표시용)
  instagramSlideThumbUrls: string[];   // 슬라이드별 썸네일 (DB 저장용)
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
          content: `당신은 기독교 콘텐츠 분석 전문가입니다. 유튜브 영상 자막을 정확하게 분석하여 요약을 생성합니다.

중요한 분석 원칙:
1. 영상에서 실제로 다루는 내용만 요약하세요
2. 추측하거나 일반적인 내용을 추가하지 마세요
3. 설교자/발표자의 실제 메시지를 정확히 반영하세요
4. 각 요약 문장은 구체적이고 명확해야 합니다

핵심 말씀 추출 (매우 중요):
- 영상에서 설교자가 직접 언급하거나 인용한 성경 구절을 찾아서 추출하세요
- AI가 추천하는 것이 아니라, 영상 내용에서 실제로 다루는 핵심 말씀(본문 말씀)을 찾으세요
- 성경 구절이 여러 개 언급되었다면, 가장 핵심이 되는 말씀(오늘의 본문)을 선택하세요
- verseContent에는 해당 구절의 전체 내용을 빠짐없이 포함하세요
- 절대로 "..." 등으로 생략하지 마세요. 구절 전체를 완전하게 적어주세요
- 여러 절이 언급되었다면 (예: 로마서 8:28-30) 해당하는 모든 절의 전체 내용을 포함하세요

성경 말씀 정확성 (반드시 준수):
- 반드시 개역개정(개정개역한글판) 번역본의 정확한 원문을 사용하세요
- 자막에 오타가 있어도 성경 원문은 정확하게 작성하세요
- 예시 (누가복음 1:12-13 개역개정):
  "12 사가랴가 보고 놀라며 무서워하니 13 천사가 이르되 사가랴여 무서워하지 말라 네 간구함이 들린지라 네 아내 엘리사벳이 네게 아들을 낳아 주리니 그 이름을 요한이라 하라"
- 예시 (잠언 11:24-25 개역개정):
  "24 흩어 구제하여도 더욱 부하게 되는 일이 있나니 과도히 아껴도 가난하게 될 뿐이니라 25 구제를 좋아하는 자는 풍족하여질 것이요 남을 윤택하게 하는 자는 자기도 윤택하여지리라"
- 단어를 변형하지 마세요. 예: "흩어"를 "후히"로 바꾸면 안됩니다
- 성경 구절의 정확한 철자와 어휘를 사용하세요

출력 JSON:
{
  "summary": ["1. 영상의 주제/배경 소개", "2. 첫 번째 핵심 포인트", "3. 두 번째 핵심 포인트", "4. 세 번째 핵심 포인트 또는 예시", "5. 결론 및 적용점"],
  "coreMessage": "영상의 핵심 메시지 한 문장 (설교자의 의도 반영)",
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

  // ── Step 4: 이미지 프롬프트 생성 → 이미지 생성 + Canvas 오버레이 ─────────
  // Holy AI Creator 방식: 말씀/핵심메시지 기반으로 GPT가 맞춤 이미지 프롬프트 생성
  let imagePrompt = `Beautiful nature scene for Christian devotional. Soft morning light, spring flowers, peaceful landscape. Bright pastel tones. No people, no text. Square format.`;
  try {
    const promptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [
        {
          role: "system",
          content: `Create a detailed image prompt for a 1080x1080 Instagram post background image. The image should be:
- Peaceful and spiritual Christian aesthetic matching the Bible verse theme
- Beautiful nature scenery (flowers, landscape, sunrise, water, forest — NO Bible books, NO church buildings)
- Bright, airy, high-key lighting with soft pastel tones
- Suitable for text overlay
- NO people, NO faces, NO hands, NO text in image
- Professional photorealistic quality

Respond with ONLY the English prompt text, no JSON, no explanation.`,
        },
        {
          role: "user",
          content: `Create an image prompt based on this Bible verse and message:
Verse: ${textContent.verseReference} - "${textContent.verseContent}"
Core message: ${textContent.coreMessage}`,
        },
      ],
    });
    const generated = promptRes.choices[0]?.message?.content?.trim();
    if (generated) imagePrompt = generated;
  } catch (e) {
    console.warn("[scripture-generator] 이미지 프롬프트 생성 실패, 기본값 사용");
  }

  const UNSPLASH_FALLBACK = "https://images.unsplash.com/photo-1499652848871-1527a310b13a?w=1080&h=1080&fit=crop";
  let imageUrl = UNSPLASH_FALLBACK;
  let imageBase64: string | undefined;
  let thumbnailBase64: string | undefined;

  let instagramSlideImages: string[] = [];
  let instagramSlideThumbUrls: string[] = [];

  const rawBase64 = await generateScriptureImageBase64(imagePrompt);
  if (rawBase64) {
    try {
      const { addVerseOverlayToBase64, createSmallThumbnail, createInstagramSlides, createSlideThumbnail } = await import("./scripture-canvas");
      imageBase64 = await addVerseOverlayToBase64(rawBase64, textContent.verseReference, textContent.verseContent);
      thumbnailBase64 = await createSmallThumbnail(imageBase64);
      imageUrl = ""; // base64 사용 시 imageUrl 불필요

      // 슬라이드 이미지 생성 — 슬라이드별 다른 배경 사진 + 파스텔 오버레이
      if (instagramSlides.length > 0) {
        const slideBgs = await fetchAllSlideBackgrounds(instagramSlides);
        instagramSlideImages = await createInstagramSlides(slideBgs, instagramSlides, textContent.verseReference);
        instagramSlideThumbUrls = await Promise.all(
          instagramSlideImages.map(img => createSlideThumbnail(img).catch(() => ""))
        );
        instagramSlideThumbUrls = instagramSlideThumbUrls.filter(Boolean);
      }
    } catch (err: any) {
      console.warn("[scripture-generator] canvas 처리 실패:", err.message?.slice(0, 80));
      imageBase64 = rawBase64;
    }
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
    thumbnailBase64,
    caption: fullCaption,
    hashtags,
    instagramSlides,
    instagramSlideImages,
    instagramSlideThumbUrls,
    videoTitle: textContent.coreMessage.slice(0, 50) || "말씀 콘텐츠",
    videoSummary: textContent.summary.join(" "),
  };
}

// ─── 기존 콘텐츠용 이미지만 단독 생성 ────────────────────────────────────────

export async function generateVerseImage(
  verseReference: string,
  verseContent: string,
  instagramSlides: string[] = []
): Promise<{ imageBase64?: string; thumbnailBase64?: string; imageUrl: string; slideImages: string[]; slideThumbUrls: string[] }> {
  const UNSPLASH_FALLBACK = "https://images.unsplash.com/photo-1499652848871-1527a310b13a?w=1080&h=1080&fit=crop";
  const openai = getOpenAI();

  // 말씀 기반 맞춤 이미지 프롬프트 생성 (Holy AI Creator 방식)
  let imagePrompt = `Peaceful spiritual nature background, soft morning light, spring flowers. Bright pastel. No people, no text.`;
  try {
    const promptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `Create a short English image prompt for a Christian Instagram post background. Beautiful nature only (NO Bible books, NO churches, NO people, NO faces). Bright, airy, pastel tones. Photorealistic. Max 2 sentences.`,
        },
        {
          role: "user",
          content: `Bible verse: ${verseReference} - "${verseContent}"`,
        },
      ],
    });
    const p = promptRes.choices[0]?.message?.content?.trim();
    if (p) imagePrompt = p;
  } catch {}

  let imageUrl = UNSPLASH_FALLBACK;
  let imageBase64: string | undefined;
  let thumbnailBase64: string | undefined;
  let slideImages: string[] = [];
  let slideThumbUrls: string[] = [];

  const rawBase64 = await generateScriptureImageBase64(imagePrompt);
  if (rawBase64) {
    try {
      const { addVerseOverlayToBase64, createSmallThumbnail, createInstagramSlides, createSlideThumbnail } = await import("./scripture-canvas");
      imageBase64 = await addVerseOverlayToBase64(rawBase64, verseReference, verseContent);
      thumbnailBase64 = await createSmallThumbnail(imageBase64);
      imageUrl = "";

      // 슬라이드가 있으면 함께 재생성 — 슬라이드별 다른 배경 사진
      if (instagramSlides.length > 0) {
        const slideBgs = await fetchAllSlideBackgrounds(instagramSlides);
        slideImages = await createInstagramSlides(slideBgs, instagramSlides, verseReference);
        slideThumbUrls = (await Promise.all(slideImages.map(img => createSlideThumbnail(img).catch(() => "")))).filter(Boolean);
      }
    } catch (err: any) {
      console.warn("[generateVerseImage] canvas 실패:", err.message?.slice(0, 80));
      imageBase64 = rawBase64;
    }
  }

  return { imageBase64, thumbnailBase64, imageUrl, slideImages, slideThumbUrls };
}
