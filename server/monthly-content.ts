/**
 * monthly-content.ts
 * 월간 희망 글귀 콘텐츠 생성 — 월별 테마 기반
 */

import OpenAI from "openai";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 미설정");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── 월별 테마 정의 ─────────────────────────────────────────────────────────────

const MONTH_THEMES: Record<number, { season: string; keywords: string; imagePrompt: string }> = {
  1:  { season: "겨울 / 새해",   keywords: "새해, 새 시작, 희망, 결심, 새벽",
        imagePrompt: "Snowy peaceful winter landscape at golden sunrise, soft blue and white tones, hopeful dawn light, minimal Japanese aesthetic" },
  2:  { season: "입춘 / 봄 준비", keywords: "따뜻함, 사랑, 새 시작, 기대, 설렘",
        imagePrompt: "Early spring buds on bare branches with soft pink sky, pastel warm tones, delicate and hopeful atmosphere" },
  3:  { season: "봄",            keywords: "새 시작, 성장, 설렘, 도전, 피어남",
        imagePrompt: "Beautiful spring meadow with wildflowers blooming, soft golden morning light, fresh green and pink tones" },
  4:  { season: "봄꽃 / 벚꽃",   keywords: "아름다움, 변화, 꽃피움, 순간, 감동",
        imagePrompt: "Cherry blossom avenue with falling petals, soft pink bokeh, dreamy spring morning, romantic Japanese park" },
  5:  { season: "가정의 달",     keywords: "감사, 사랑, 가족, 소중함, 행복",
        imagePrompt: "Warm sunny garden with blooming roses and soft afternoon light, family warmth, green lush peaceful nature" },
  6:  { season: "초여름",        keywords: "도전, 열정, 성장, 여름 준비, 에너지",
        imagePrompt: "Lush green summer field under bright blue sky with fluffy clouds, energetic morning light, vibrant nature" },
  7:  { season: "여름",          keywords: "자유, 열정, 도전, 빛, 에너지",
        imagePrompt: "Beautiful ocean sunset with golden reflection, summer energy, vibrant warm tones, peaceful beach horizon" },
  8:  { season: "한여름",        keywords: "자유, 추억, 도전, 긍정, 빛남",
        imagePrompt: "Sunflower field at golden hour, bright summer sunshine, warm yellow and orange tones, joyful energy" },
  9:  { season: "초가을 / 추석", keywords: "풍성함, 감사, 수확, 나눔, 따뜻함",
        imagePrompt: "Autumn harvest field at sunrise, golden wheat and warm light, abundance and gratitude, peaceful Korean countryside" },
  10: { season: "단풍 / 가을",   keywords: "성숙, 여유, 감사, 깊이, 풍요",
        imagePrompt: "Vibrant autumn forest path with red and orange maple leaves, soft morning mist, peaceful walk in fall" },
  11: { season: "만추 / 마무리", keywords: "돌아봄, 감사, 마무리, 따뜻함, 성장",
        imagePrompt: "Late autumn misty morning over calm lake, fallen leaves reflection, serene and contemplative atmosphere" },
  12: { season: "연말 / 겨울",   keywords: "마무리, 감사, 선물, 따뜻함, 새해 준비",
        imagePrompt: "Cozy winter evening with soft snow falling, warm golden light through frost window, peaceful and grateful mood" },
};

// ── 이미지 생성 (Pollinations 우선 → OpenAI 폴백) ────────────────────────────

async function generateMonthlyImage(monthNum: number): Promise<string | null> {
  const theme = MONTH_THEMES[monthNum] || MONTH_THEMES[1];

  // 1차: Pollinations (무료, 빠름)
  try {
    const prompt = encodeURIComponent(
      `${theme.imagePrompt}. No people. No text. No logo. Photorealistic premium photography. Vertical portrait orientation.`
    );
    const seed = Math.floor(Math.random() * 9999999);
    const res = await fetch(
      `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&nologo=true&seed=${seed}`,
      { signal: AbortSignal.timeout(35000) }
    );
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch (e: any) {
    console.warn("[monthly-content] Pollinations 실패:", e.message?.slice(0, 80));
  }

  // 2차: OpenAI dall-e-3
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAI();
      const res = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${theme.imagePrompt}. No people, no text, no logo. High quality photorealistic.`,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      } as any);
      const b64 = res.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
    } catch (e: any) {
      console.warn("[monthly-content] OpenAI 이미지 실패:", e.message?.slice(0, 80));
    }
  }

  return null;
}

// ── 이미지에 글귀 오버레이 ─────────────────────────────────────────────────────

export async function applyQuoteToImage(imageBase64: string, quote: string): Promise<string> {
  const { addQuoteOverlayToBase64 } = await import("./scripture-canvas");
  return addQuoteOverlayToBase64(imageBase64, quote);
}

// ── 메인 생성 함수 ─────────────────────────────────────────────────────────────

export interface MonthlyGeneratedContent {
  quote: string;
  caption: string;
  hashtags: string[];
  rawImageBase64: string | null;   // 텍스트 없는 원본
  imageBase64: string | null;      // 글귀 오버레이된 최종 이미지
}

export async function generateMonthlyContent(monthStr?: string): Promise<MonthlyGeneratedContent> {
  const openai = getOpenAI();

  // 월 파싱 (형식: "2026-06" 또는 undefined → 현재 월)
  const date = monthStr ? new Date(`${monthStr}-01`) : new Date();
  const monthNum = date.getMonth() + 1; // 1~12
  const year = date.getFullYear();
  const monthLabel = `${year}년 ${monthNum}월`;
  const theme = MONTH_THEMES[monthNum] || MONTH_THEMES[1];

  // 1단계: 글귀 생성
  const quoteRes = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `당신은 따뜻한 위로와 희망을 전하는 감성 카피라이터입니다.
${monthLabel}(${theme.season}) 분위기에 어울리는 희망 메시지를 생성하세요.
키워드 참고: ${theme.keywords}

조건:
- 한국어
- 2~3줄 구성 (각 줄 15~25자, 줄바꿈은 \\n으로)
- 긍정적이고 감성적, 시적인 문장
- 종교/정치 내용 제외
- 인스타그램 이미지에 넣기 좋은 문장

JSON: { "quote": "첫 번째 줄\\n두 번째 줄\\n세 번째 줄" }`,
      },
      { role: "user", content: `${monthLabel}에 어울리는 희망 글귀를 만들어주세요.` },
    ],
  });
  const quoteData = JSON.parse(quoteRes.choices[0]?.message?.content || '{"quote":""}');
  const quote = quoteData.quote || `${monthLabel},\n오늘도 희망을 품고\n한 걸음씩 나아갑니다.`;

  // 2단계 & 3단계: 캡션 + 해시태그 병렬 생성
  const [captionRes, hashtagRes, rawImageBase64] = await Promise.all([
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `인스타그램 캡션 전문가입니다.
조건: 150자 이내, 공감형 문체, 이모지 2~3개, ${theme.season} 분위기 반영
JSON: { "caption": "..." }`,
        },
        { role: "user", content: `글귀: "${quote}"\n월: ${monthLabel}` },
      ],
    }),
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `인스타그램 해시태그 전문가입니다.
조건: 정확히 20개, # 기호 포함, 한국어 위주 영어 3~5개 혼합, ${theme.season} 시즌 태그 포함
JSON: { "hashtags": ["#태그1", ...] }`,
        },
        { role: "user", content: `글귀: "${quote}"\n월: ${monthLabel}(${theme.season})` },
      ],
    }),
    generateMonthlyImage(monthNum),
  ]);

  const caption = JSON.parse(captionRes.choices[0]?.message?.content || '{"caption":""}').caption || "";
  const hashtagData = JSON.parse(hashtagRes.choices[0]?.message?.content || '{"hashtags":[]}');
  const hashtags: string[] = Array.isArray(hashtagData.hashtags) ? hashtagData.hashtags.slice(0, 20) : [];

  // 4단계: 이미지에 글귀 오버레이
  let imageBase64: string | null = null;
  if (rawImageBase64) {
    try {
      imageBase64 = await applyQuoteToImage(rawImageBase64, quote);
    } catch {
      imageBase64 = rawImageBase64;
    }
  }

  return { quote, caption, hashtags, rawImageBase64, imageBase64 };
}
