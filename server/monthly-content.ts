/**
 * monthly-content.ts
 * 월간 희망 콘텐츠 — 5가지 스타일 글귀 생성 + 이미지 오버레이
 */

import OpenAI from "openai";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 미설정");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── 월별 테마 ─────────────────────────────────────────────────────────────────

const MONTH_THEMES: Record<number, { season: string; keywords: string; imagePrompt: string }> = {
  1:  { season: "새해·겨울",    keywords: "새해, 새 시작, 희망, 결심",
        imagePrompt: "Ethereal snowy mountain at golden sunrise, soft blue and gold tones, peaceful dawn, premium landscape photography, vertical" },
  2:  { season: "입춘·봄 준비", keywords: "따뜻함, 사랑, 기대, 설렘",
        imagePrompt: "Delicate spring buds on branches with soft pink bokeh sky, warm pastel tones, fine art photography, vertical" },
  3:  { season: "봄",           keywords: "새 시작, 성장, 설렘, 피어남",
        imagePrompt: "Lush spring meadow with wildflowers, soft golden morning light, dreamy depth of field, premium nature photography, vertical" },
  4:  { season: "벚꽃",         keywords: "아름다움, 변화, 꽃피움, 순간",
        imagePrompt: "Cherry blossom avenue with falling petals, soft pink bokeh, magical spring morning light, luxury aesthetic, vertical" },
  5:  { season: "가정의 달",    keywords: "감사, 사랑, 가족, 소중함, 행복",
        imagePrompt: "Lush green garden with blooming roses at golden hour, warm soft light, fine art nature photography, vertical" },
  6:  { season: "초여름",       keywords: "도전, 열정, 성장, 에너지, 기회",
        imagePrompt: "Stunning green summer field under dramatic sky at sunset, vibrant yet soft tones, editorial photography, vertical" },
  7:  { season: "여름",         keywords: "자유, 열정, 빛, 에너지, 도전",
        imagePrompt: "Golden ocean at sunset with soft light reflection, summer warmth, luxury travel photography, vertical" },
  8:  { season: "한여름",       keywords: "자유, 추억, 도전, 긍정, 빛남",
        imagePrompt: "Sunflower field at magic hour, warm golden light flooding through flowers, dreamy bokeh, premium photography, vertical" },
  9:  { season: "초가을·추석",  keywords: "풍성함, 감사, 수확, 나눔",
        imagePrompt: "Golden autumn harvest field at sunrise, warm amber tones, peaceful Korean countryside, fine art photography, vertical" },
  10: { season: "단풍·가을",    keywords: "성숙, 여유, 감사, 풍요, 깊이",
        imagePrompt: "Dramatic autumn forest path with red maple canopy, soft mist, luxury landscape photography, vertical" },
  11: { season: "만추·마무리",  keywords: "돌아봄, 감사, 마무리, 따뜻함",
        imagePrompt: "Late autumn misty lake at golden hour, still water reflection, serene contemplative mood, premium photography, vertical" },
  12: { season: "연말·겨울",    keywords: "마무리, 감사, 선물, 따뜻함, 새해 준비",
        imagePrompt: "Magical winter evening with soft snow and warm golden light, cozy and hopeful atmosphere, luxury photography, vertical" },
};

// ── 타입 ──────────────────────────────────────────────────────────────────────

export interface QuoteStyle {
  id: string;
  label: string;
  quote: string;   // 이미지에 들어갈 핵심 1~2줄 (짧게)
  fullText: string; // 캡션용 전체 텍스트 (멀티 단락)
}

export interface MonthlyGeneratedContent {
  styles: QuoteStyle[];
  hashtags: string[];
  rawImageBase64: string | null;
  imageBase64: string | null;       // 첫 번째 스타일 적용 이미지
}

// ── 이미지 생성 ───────────────────────────────────────────────────────────────

async function generateMonthlyImage(monthNum: number): Promise<string | null> {
  const theme = MONTH_THEMES[monthNum] || MONTH_THEMES[6];

  // 1차: Pollinations
  try {
    const prompt = encodeURIComponent(
      `${theme.imagePrompt}. No people. No text overlay. No logo. Cinematic quality. Soft focus background.`
    );
    const seed = Math.floor(Math.random() * 9999999);
    const res = await fetch(
      `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&nologo=true&seed=${seed}&model=flux`,
      { signal: AbortSignal.timeout(35000) }
    );
    if (res.ok) {
      return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    }
  } catch (e: any) { console.warn("[monthly] Pollinations 실패:", e.message?.slice(0, 80)); }

  // 2차: OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAI();
      const res = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${theme.imagePrompt}. No people, no text, no logo. Cinematic quality photography.`,
        n: 1, size: "1024x1024", response_format: "b64_json",
      } as any);
      const b64 = res.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
    } catch (e: any) { console.warn("[monthly] OpenAI 이미지 실패:", e.message?.slice(0, 80)); }
  }
  return null;
}

// ── 글귀 오버레이 적용 ────────────────────────────────────────────────────────

export async function applyQuoteToImage(imageBase64: string, quote: string): Promise<string> {
  const { addQuoteOverlayToBase64 } = await import("./scripture-canvas");
  return addQuoteOverlayToBase64(imageBase64, quote);
}

// ── 메인 생성 함수 ─────────────────────────────────────────────────────────────

export async function generateMonthlyContent(monthStr?: string): Promise<MonthlyGeneratedContent> {
  const openai = getOpenAI();
  const date = monthStr ? new Date(`${monthStr}-01`) : new Date();
  const monthNum = date.getMonth() + 1;
  const year = date.getFullYear();
  const monthLabel = `${year}년 ${monthNum}월`;
  const theme = MONTH_THEMES[monthNum] || MONTH_THEMES[6];

  // 1단계: 5가지 스타일 글귀 + 해시태그 병렬 생성
  const [stylesRes, hashtagRes, rawImageBase64] = await Promise.all([

    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 한국 최고의 인스타그램 감성 카피라이터입니다.
${monthLabel}(${theme.season}) 분위기에 맞는 희망·동기부여 메시지를 5가지 스타일로 생성하세요.
키워드: ${theme.keywords}

각 스타일 형식:
- quote: 이미지에 넣을 핵심 문장 (2~3줄, 각 줄 15~25자, \\n으로 구분, 이모지 없음)
- fullText: 인스타그램 캡션용 전체 글 (여러 단락, 이모지 포함, 감성적, 200자 내외)

스타일 5가지:
1. 감성형: 따뜻하고 감성적, 감정에 호소
2. 희망형: 긍정과 희망, 위로와 격려
3. 짧은 글귀형: 임팩트 있는 한 마디, 간결하고 강렬
4. 명언 스타일: 지혜롭고 깊이 있는 메시지, 인용구 형식
5. 인스타 감성형: Hello/Hi + 영어 혼용, 트렌디하고 세련됨

JSON:
{
  "styles": [
    { "id": "emotional", "label": "감성형", "quote": "핵심 문장\\n2번째 줄\\n3번째 줄", "fullText": "전체 캡션..." },
    { "id": "hopeful", "label": "희망형", "quote": "...", "fullText": "..." },
    { "id": "short", "label": "짧은 글귀형", "quote": "...", "fullText": "..." },
    { "id": "quote_style", "label": "명언 스타일", "quote": "...", "fullText": "..." },
    { "id": "insta", "label": "인스타 감성형", "quote": "...", "fullText": "..." }
  ]
}`,
        },
        { role: "user", content: `${monthLabel} (${theme.season}) 희망 메시지 5가지 스타일을 만들어주세요.` },
      ],
    }),

    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `인스타그램 해시태그 전문가. 정확히 20개, # 포함, 한국어 위주 영어 3~5개 혼합.
JSON: { "hashtags": ["#태그1", ...] }`,
        },
        { role: "user", content: `${monthLabel} ${theme.season} 희망 동기부여 인스타그램 해시태그 20개` },
      ],
    }),

    generateMonthlyImage(monthNum),
  ]);

  // 파싱
  const stylesData = JSON.parse(stylesRes.choices[0]?.message?.content || '{"styles":[]}');
  const styles: QuoteStyle[] = Array.isArray(stylesData.styles) ? stylesData.styles : [];
  const hashtagData = JSON.parse(hashtagRes.choices[0]?.message?.content || '{"hashtags":[]}');
  const hashtags: string[] = Array.isArray(hashtagData.hashtags) ? hashtagData.hashtags.slice(0, 20) : [];

  // 첫 번째 스타일로 이미지 오버레이
  let imageBase64: string | null = null;
  if (rawImageBase64 && styles.length > 0) {
    try {
      imageBase64 = await applyQuoteToImage(rawImageBase64, styles[0].quote);
    } catch { imageBase64 = rawImageBase64; }
  }

  return { styles, hashtags, rawImageBase64, imageBase64 };
}
