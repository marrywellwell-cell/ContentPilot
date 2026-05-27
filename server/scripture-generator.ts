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
          content: `당신은 기독교 콘텐츠 분석 전문가입니다.

핵심 말씀 추출 원칙:
- 영상에서 설교자가 직접 언급한 성경 구절을 찾아 추출
- 반드시 개역개정(개역개정한글판) 번역 원문을 사용
- verseContent에 구절 전체를 빠짐없이 기재 (생략 금지)
- 단어 변형 금지

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

  // ── Step 4: 이미지 생성 + Canvas 오버레이 (메모리 전용) ─────────────────
  const imagePrompt = `Beautiful nature scene for Christian devotional. Soft morning light through trees, spring cherry blossoms, peaceful meadow with wildflowers, or gentle sunrise over mountains. Bright airy pastel tones, high-key lighting, no Bible books, no church buildings, no people, no text. Square format. High quality photorealistic.`;

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
  const imagePrompt = `Beautiful nature scene for Christian devotional. Soft morning light through trees, spring cherry blossoms, peaceful meadow with wildflowers, or gentle sunrise over mountains. Bright airy pastel tones, high-key lighting, no Bible books, no church buildings, no people, no text. Square format. High quality photorealistic.`;

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
