/**
 * monthly-content.ts
 * 월간 희망 콘텐츠 — 5가지 스타일 글귀 + gpt-image-1 고급 디자인 이미지
 */

import OpenAI from "openai";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 미설정");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── 월별 테마 ─────────────────────────────────────────────────────────────────

const MONTH_THEMES: Record<number, {
  season: string; keywords: string;
  bgPrompt: string;   // 배경 이미지용 (Pollinations 폴백)
  colorPalette: string; // 텍스트 컬러 힌트
}> = {
  1:  { season: "새해·겨울",    keywords: "새해, 새 시작, 희망, 결심",
        bgPrompt: "Snowy mountain golden sunrise, soft blue gold tones",
        colorPalette: "icy blue and silver, soft white tones" },
  2:  { season: "입춘·봄 준비", keywords: "따뜻함, 사랑, 기대, 설렘",
        bgPrompt: "Spring buds pink bokeh sky, pastel warm tones",
        colorPalette: "soft pink and peach tones" },
  3:  { season: "봄",           keywords: "새 시작, 성장, 설렘, 피어남",
        bgPrompt: "Spring meadow wildflowers golden morning light",
        colorPalette: "fresh green and soft yellow tones" },
  4:  { season: "벚꽃",         keywords: "아름다움, 변화, 꽃피움, 순간",
        bgPrompt: "Cherry blossom avenue falling petals pink bokeh",
        colorPalette: "cherry blossom pink and soft rose tones" },
  5:  { season: "가정의 달",    keywords: "감사, 사랑, 가족, 소중함, 행복",
        bgPrompt: "Green garden blooming roses golden hour, warm light",
        colorPalette: "warm rose gold and soft green tones" },
  6:  { season: "초여름",       keywords: "도전, 열정, 성장, 에너지, 기회",
        bgPrompt: "Bright summer window scene, white flowers in ceramic vase, ocean view, blue sky",
        colorPalette: "sage green (#6B8F47) and soft sky blue" },
  7:  { season: "여름",         keywords: "자유, 열정, 빛, 에너지, 도전",
        bgPrompt: "Ocean sunset golden reflection, summer warmth beach",
        colorPalette: "warm coral and golden yellow tones" },
  8:  { season: "한여름",       keywords: "자유, 추억, 도전, 긍정, 빛남",
        bgPrompt: "Sunflower field magic hour, golden light bokeh",
        colorPalette: "sunflower yellow and warm amber tones" },
  9:  { season: "초가을·추석",  keywords: "풍성함, 감사, 수확, 나눔",
        bgPrompt: "Autumn harvest field sunrise, golden wheat, countryside",
        colorPalette: "warm amber and harvest gold tones" },
  10: { season: "단풍·가을",    keywords: "성숙, 여유, 감사, 풍요, 깊이",
        bgPrompt: "Autumn maple forest path, red orange leaves, soft mist",
        colorPalette: "rich burgundy and burnt orange tones" },
  11: { season: "만추·마무리",  keywords: "돌아봄, 감사, 마무리, 따뜻함",
        bgPrompt: "Late autumn misty lake golden hour, fallen leaves reflection",
        colorPalette: "muted teal and warm brown tones" },
  12: { season: "연말·겨울",    keywords: "마무리, 감사, 선물, 따뜻함, 새해 준비",
        bgPrompt: "Cozy winter snow warm golden light, frosted window",
        colorPalette: "deep navy and warm gold tones" },
};

// ── 타입 ──────────────────────────────────────────────────────────────────────

export interface QuoteStyle {
  id: string;
  label: string;
  quote: string;    // 이미지 핵심 문장 (2~3줄)
  fullText: string; // 캡션 전체 텍스트
}

export interface MonthlyGeneratedContent {
  styles: QuoteStyle[];
  hashtags: string[];
  rawImageBase64: string | null;   // 배경 원본 (폴백용)
  imageBase64: string | null;      // 최종 디자인 이미지
}

// ── gpt-image-1 디자인 이미지 생성 ───────────────────────────────────────────

export async function generateDesignedImage(
  monthNum: number,
  year: number,
  style: QuoteStyle
): Promise<string | null> {
  const theme = MONTH_THEMES[monthNum] || MONTH_THEMES[6];
  const monthKo = `${monthNum}월`;
  const monthEnMap = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthEn = monthEnMap[monthNum - 1];

  // fullText를 단락별로 분리
  const paragraphs = style.fullText
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const mainPara = paragraphs[0] || "";
  const highlightPara = paragraphs[1] || "";
  const lastPara = paragraphs[2] || "";
  const signature = paragraphs[paragraphs.length - 1]?.replace(/[✨🌿☘️💚]/g, "").trim() || "당신을 응원합니다";

  const prompt = `Create a beautiful Korean Instagram post image, portrait orientation (9:16 ratio, 1080x1350).

BACKGROUND SCENE:
${theme.bgPrompt}. Photorealistic, bright airy minimal aesthetic, soft natural light.
Place nature elements (flowers, plants, foliage) on the RIGHT side of the image.
LEFT side should be mostly clear/light for text.
TOP area has soft sky or window with light coming through.

TYPOGRAPHY LAYOUT (Korean + English text, beautifully designed):

TOP-LEFT area (${theme.colorPalette}):
- Small handwritten cursive English: "Hello,"  with tiny decorative marks (✧ or dashes)
- Very large bold Korean text: "${monthKo}"
- Small leaf or nature icon decoration 🌿 next to ${monthKo}

BODY TEXT (dark charcoal #2D2D2D, left-aligned, readable):
Paragraph 1 (regular weight):
"${mainPara}"

Paragraph 2 (inside a soft ${theme.colorPalette.split(" ")[0]} semi-transparent highlight box):
"${highlightPara}"

Paragraph 3 (regular weight):
"${lastPara}"

BOTTOM-LEFT:
- Handwritten script Korean: "${signature}!"
- Thin decorative underline below it

DESIGN REQUIREMENTS:
- Color palette: ${theme.colorPalette}, warm cream/white
- Font style: Mix of bold display Korean font, elegant body font, handwritten cursive accents
- Subtle decorative elements: tiny leaves ✿, hearts ♥, minimal lines
- Text should be clearly readable on the bright background (NO dark overlay)
- Clean, airy, premium magazine/Instagram aesthetic
- Overall mood: warm, hopeful, elegant
- The ${monthEn} / "${monthKo}" English mug or element may appear naturally in the scene if appropriate`;

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAI();
      const res = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt.slice(0, 32000),
        n: 1,
        size: "1024x1536",
        quality: "high",
      } as any);
      const b64 = res.data?.[0]?.b64_json;
      if (b64) {
        console.log("[monthly] gpt-image-1 디자인 이미지 생성 성공");
        return `data:image/png;base64,${b64}`;
      }
    } catch (e: any) {
      console.warn("[monthly] gpt-image-1 실패:", e.message?.slice(0, 120));
    }
  }
  return null;
}

// ── 배경 이미지 생성 (Pollinations 폴백) ─────────────────────────────────────

async function generateBgImage(monthNum: number): Promise<string | null> {
  const theme = MONTH_THEMES[monthNum] || MONTH_THEMES[6];
  try {
    const prompt = encodeURIComponent(
      `${theme.bgPrompt}. No people. No text. Cinematic quality. Photorealistic. Soft light.`
    );
    const seed = Math.floor(Math.random() * 9999999);
    const res = await fetch(
      `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&nologo=true&seed=${seed}&model=flux`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (res.ok) return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch (e: any) { console.warn("[monthly] Pollinations 실패:", e.message?.slice(0, 60)); }
  return null;
}

// ── 캔버스 텍스트 오버레이 폴백 ──────────────────────────────────────────────

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
  const [stylesRes, hashtagRes] = await Promise.all([
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

각 스타일의 fullText는 아래 규칙을 반드시 따르세요:
- 첫 줄: **볼드체** 제목 문장 (${monthNum}월 언급 포함)
- 본문: 2~3개 단락, 각 단락은 빈 줄(\\n\\n)로 구분
- 마지막 줄: **볼드체** 응원 문장 + 이모지
- 전체 길이: 150~250자
- 줄바꿈은 \\n, 단락 구분은 \\n\\n 사용

quote는 이미지에 넣을 핵심 2~3줄 (이모지 없음, 각 줄 15자 내외, \\n으로 구분)

스타일별 특징:
1. 감성형: 감정에 호소, "아직 이루지 못한 것보다 앞으로가 더 많습니다" 류
2. 희망형: 긍정·격려, "다시 시작하기 늦지 않았습니다" 류, 목표/도전 언급
3. 짧은 글귀형: 짧고 임팩트 있는 한 마디 중심, "천천히 가도 괜찮습니다" 류
4. 명언 스타일: **"인용구 형식"** 따옴표 포함, 깊이 있는 메시지
5. 인스타 감성형: **Hello, June 🌿** 영어 혼용, 트렌디·세련, "지나간 날 후회 말고" 류

JSON:
{
  "styles": [
    { "id":"emotional","label":"감성형","quote":"핵심문장\\n두번째줄\\n세번째줄","fullText":"**${monthNum}월의 첫날입니다.**\\n본문...\\n\\n본문2...\\n\\n**응원 문장. 🌿**" },
    { "id":"hopeful","label":"희망형","quote":"...","fullText":"..." },
    { "id":"short","label":"짧은 글귀형","quote":"...","fullText":"..." },
    { "id":"quote_style","label":"명언 스타일","quote":"...","fullText":"..." },
    { "id":"insta","label":"인스타 감성형","quote":"...","fullText":"..." }
  ]
}`,
        },
        { role: "user", content: `${monthLabel} (${theme.season}) 희망 동기부여 메시지 5가지 스타일 생성` },
      ],
    }),

    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `인스타그램 해시태그 전문가. 20개, # 포함. JSON: { "hashtags": ["#태그1",...] }` },
        { role: "user", content: `${monthLabel} ${theme.season} 희망 동기부여 해시태그 20개` },
      ],
    }),
  ]);

  const stylesData = JSON.parse(stylesRes.choices[0]?.message?.content || '{"styles":[]}');
  const styles: QuoteStyle[] = Array.isArray(stylesData.styles) ? stylesData.styles : [];
  const hashtagData = JSON.parse(hashtagRes.choices[0]?.message?.content || '{"hashtags":[]}');
  const hashtags: string[] = Array.isArray(hashtagData.hashtags) ? hashtagData.hashtags.slice(0, 20) : [];

  if (styles.length === 0) return { styles, hashtags, rawImageBase64: null, imageBase64: null };

  // 2단계: gpt-image-1로 디자인 이미지 생성 (1번째 스타일 기준)
  let imageBase64: string | null = null;
  let rawImageBase64: string | null = null;

  // gpt-image-1 시도
  imageBase64 = await generateDesignedImage(monthNum, year, styles[0]);

  // 폴백: Pollinations + 캔버스 오버레이
  if (!imageBase64) {
    rawImageBase64 = await generateBgImage(monthNum);
    if (rawImageBase64) {
      try { imageBase64 = await applyQuoteToImage(rawImageBase64, styles[0].quote); }
      catch { imageBase64 = rawImageBase64; }
    }
  }

  return { styles, hashtags, rawImageBase64, imageBase64 };
}
