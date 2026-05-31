/**
 * monthly-content.ts
 * 월간 희망 글귀 콘텐츠 생성 (글귀 → 캡션 → 해시태그 → 이미지)
 */

import OpenAI from "openai";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 미설정");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface MonthlyGeneratedContent {
  quote: string;
  caption: string;
  hashtags: string[];
  imageBase64: string | null;
}

// ── 이미지 생성 (Pollinations 우선 → OpenAI 폴백) ────────────────────────────

async function generateImage(quote: string): Promise<string | null> {
  // 1차: Pollinations (무료, 빠름)
  try {
    const prompt = encodeURIComponent(
      "Warm inspirational background. Beautiful sunrise over peaceful nature. Soft golden light. Premium photography. Minimal composition. Center text area. Hopeful atmosphere. No text. No people. No logo. Pastel tones."
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
        prompt: `Warm inspirational Instagram background. Beautiful sunrise. Natural landscape. Soft light. Premium photography. Minimal composition. Text area in center. Hopeful atmosphere. No text. No logo. No people.`,
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

// ── 메인 생성 함수 ─────────────────────────────────────────────────────────────

export async function generateMonthlyContent(): Promise<MonthlyGeneratedContent> {
  const openai = getOpenAI();

  // 1단계: 글귀 생성
  const quoteRes = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 256,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `당신은 따뜻한 위로와 희망을 전하는 카피라이터입니다.
다음 조건으로 희망 메시지 1개를 생성하세요.
조건:
- 한국어
- 30~60자
- 긍정적이고 감성적인 문장
- 종교/정치 내용 제외
- 줄바꿈 포함 가능 (2~3줄)
JSON: { "quote": "..." }`,
      },
      { role: "user", content: `이번 달(${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" })})에 어울리는 희망 글귀를 만들어주세요.` },
    ],
  });
  const quote = JSON.parse(quoteRes.choices[0]?.message?.content || '{"quote":"오늘의 작은 용기가 내일의 큰 변화를 만듭니다."}').quote || "";

  // 2단계 & 3단계: 캡션 + 해시태그 병렬 생성
  const [captionRes, hashtagRes] = await Promise.all([
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `인스타그램 캡션 전문 작성자입니다.
조건:
- 150자 이내
- 공감형 문체
- 이모지 2~3개 포함
- 글귀와 자연스럽게 연결
JSON: { "caption": "..." }`,
        },
        { role: "user", content: `다음 글귀를 기반으로 인스타그램 캡션을 작성해주세요.\n\n글귀: "${quote}"` },
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
조건:
- 정확히 20개 생성
- # 기호 포함
- 한국어 해시태그 위주, 영어 3~5개 혼합
- 도달 범위 넓은 인기 태그 + 틈새 태그 혼합
JSON: { "hashtags": ["#태그1", "#태그2", ...] }`,
        },
        { role: "user", content: `다음 글귀와 관련된 인스타그램 해시태그 20개를 생성해주세요.\n\n글귀: "${quote}"` },
      ],
    }),
  ]);

  const caption = JSON.parse(captionRes.choices[0]?.message?.content || '{"caption":""}').caption || "";
  const hashtagData = JSON.parse(hashtagRes.choices[0]?.message?.content || '{"hashtags":[]}');
  const hashtags: string[] = Array.isArray(hashtagData.hashtags) ? hashtagData.hashtags.slice(0, 20) : [];

  // 4단계: 이미지 생성 (병렬로 시작)
  const imageBase64 = await generateImage(quote);

  return { quote, caption, hashtags, imageBase64 };
}
