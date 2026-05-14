import OpenAI, { type OpenAI as OpenAIType } from "openai";
import { GoogleGenAI, Modality } from "@google/genai";
import { Buffer } from "node:buffer";
import pRetry, { AbortError } from "p-retry";
import type { ContentSet, ChatMessage, ChatResponse } from "@shared/schema";

// OpenAI for text generation (lazy initialization)
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Gemini for image generation (lazy initialization)
function getGemini() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Helper function to check if error is rate limit or quota violation
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

interface InstagramContent {
  slides: string[];
  caption: string;
  hashtags: string[];
}

interface ImageRecommendation {
  description: string;
  altText: string;
}

interface BlogContent {
  title: string;
  content: string;
  metaDescription: string;
  html: string;
  titles: string[];
  thumbnailTexts: string[];
  imageRecommendations: ImageRecommendation[];
  internalLinkTopics: string[];
  hashtags: string[];
}

export async function generateInstagramContent(
  keyword: string,
  brandContext?: string
): Promise<InstagramContent> {
  return pRetry(
    async () => {
      try {
        const brandSection = brandContext ? `
**브랜드 컨텍스트 (이 정보를 활용하여 콘텐츠를 작성하세요):**
${brandContext}

` : "";

        const prompt = `${brandSection}"${keyword}" 주제로 인스타그램 캐러셀 콘텐츠를 생성해주세요.

**중요: 정확히 5장의 슬라이드만 생성하세요.**
"${keyword}"에 대한 4개의 핵심 포인트를 정하고, 커버 슬라이드 포함 총 5장으로 만들어주세요.
예: "건강한 식단" 주제라면 → 1) 커버: 건강한 식단, 2) 아침 식사, 3) 점심 식사, 4) 저녁 식사, 5) 건강 팁

${brandContext ? "브랜드의 USP, 고객 페르소나, Pain Point, 솔루션을 반영하여 콘텐츠를 작성해주세요.\n\n" : ""}다음을 제공해주세요:
1. 캐러셀 슬라이드 텍스트 (정확히 5장):
   - 첫 번째 슬라이드: 커버 슬라이드로 주제 자체를 표현 (예: "건강한 식단", "AI 마케팅") - 20자 이내
   - 두 번째~네 번째 슬라이드: 핵심 포인트 (각 15자 이내)
   - 다섯 번째 슬라이드: CTA 또는 결론 (15자 이내)
2. 완전한 인스타그램 캡션:
   - 관심을 끄는 훅
   - 주요 내용
   - 명확한 행동 유도 문구 (CTA)
3. 10-25개의 관련 해시태그 (# 기호 없이, 한국어 위주)

모든 콘텐츠는 한국어로 작성해주세요.

다음 JSON 형식으로 응답해주세요 (정확히 5개의 슬라이드):
{
  "slides": ["커버 슬라이드 제목", "슬라이드 2 헤드라인", "슬라이드 3 헤드라인", "슬라이드 4 헤드라인", "슬라이드 5 CTA/결론"],
  "caption": "이모지가 포함된 전체 캡션 텍스트",
  "hashtags": ["해시태그1", "해시태그2", ...]
}`;

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o", // Using GPT-4o for reliable availability
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        const result = JSON.parse(content);
        
        // Ensure slide headlines are concise and limit to 5 slides
        if (result.slides && Array.isArray(result.slides)) {
          result.slides = result.slides.slice(0, 5).map((slide: string, index: number) => {
            // First slide (cover) can be slightly longer (20 chars)
            const maxLength = index === 0 ? 20 : 15;
            return slide.length > maxLength ? slide.substring(0, maxLength) : slide;
          });
        }
        
        return result;
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

export async function generateBlogContent(
  keyword: string,
  brandContext?: string
): Promise<BlogContent> {
  return pRetry(
    async () => {
      try {
        const brandSection = brandContext ? `
**브랜드 컨텍스트 (이 정보를 활용하여 콘텐츠를 작성하세요):**
${brandContext}

` : "";

        const prompt = `${brandSection}너는 팔로워가 아주 많고 네이버에서 상위 노출되는 '최고 인기 블로거'야.

"${keyword}" 주제에 대해 네이버 인기 블로그 스타일로 글을 작성해줘.

${brandContext ? "브랜드의 USP, 고객 페르소나, Pain Point, 솔루션을 반영하여 콘텐츠를 작성해주세요.\n\n" : ""}
<작성 규칙>
- 제목과 첫 문단에 메인 키워드 "${keyword}"를 자연스럽게 넣기
- 첫 문장은 강력한 Hook으로 시작 (질문, 충격적 사실, 공감 유발)
- 소제목(H2/H3)을 활용해 3~5개의 본론 구성
- 문장은 짧고 명확하게, 한 문단 2~3문장
- 리스트(<ul><li>), 굵은글씨(<strong>), 표(<table>) 등을 활용해 가독성 강화
- 팩트 기반 정보 + 실제 경험 결합
- 독자에게 말하듯 친근하고 신뢰감 있는 톤 (반말 금지, 존댓말 사용)
- 결론에서는 핵심 요약 3줄 + CTA 포함

<출력 형식>
다음 JSON 형식으로 응답해주세요:
{
  "title": "메인 제목 (SEO 최적화, 메인 키워드 포함)",
  "metaDescription": "메타 설명 (120-150자, 검색 결과에 노출될 설명)",
  "content": "블로그 전체 내용 (순수 텍스트 버전, HTML 태그 없이)",
  "html": "블로그 전체 내용 (HTML 포맷팅 포함, H2/H3 소제목, 리스트, 굵은글씨, 표 등)",
  "titles": ["제목 옵션 1", "제목 옵션 2", "제목 옵션 3"],
  "thumbnailTexts": ["썸네일 문구 1 (짧고 임팩트있게)", "썸네일 문구 2"],
  "imageRecommendations": [
    {"description": "이미지 1 설명 (어떤 이미지가 좋을지)", "altText": "alt 텍스트 1"},
    {"description": "이미지 2 설명", "altText": "alt 텍스트 2"},
    {"description": "이미지 3 설명", "altText": "alt 텍스트 3"}
  ],
  "internalLinkTopics": ["관련 주제 1", "관련 주제 2", "관련 주제 3"],
  "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4", "해시태그5", "해시태그6", "해시태그7", "해시태그8", "해시태그9", "해시태그10"]
}

모든 콘텐츠는 한국어로 작성해주세요.`;

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        const parsed = JSON.parse(content);
        
        // Ensure all required fields have default values
        return {
          title: parsed.title || "",
          content: parsed.content || "",
          metaDescription: parsed.metaDescription || "",
          html: parsed.html || "",
          titles: parsed.titles || [parsed.title || ""],
          thumbnailTexts: parsed.thumbnailTexts || [],
          imageRecommendations: parsed.imageRecommendations || [],
          internalLinkTopics: parsed.internalLinkTopics || [],
          hashtags: parsed.hashtags || [],
        };
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

// Generate image using OpenAI DALL-E 3 (primary) → Gemini (fallback)
// Returns base64 data URL
async function generateImageWithGemini(prompt: string): Promise<string> {
  // 1차: OpenAI DALL-E 3 (URL 방식 → 다운로드 → base64)
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAI();
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 1000) + " Photorealistic, high quality, no text overlay.",
        n: 1,
        size: "1024x1024",
      });
      const imageUrl = response.data?.[0]?.url;
      if (imageUrl) {
        // URL에서 이미지 다운로드 후 base64 변환
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const b64 = Buffer.from(buffer).toString("base64");
          return `data:image/png;base64,${b64}`;
        }
      }
    } catch (err: any) {
      console.warn("DALL-E 이미지 생성 실패:", err?.message?.slice(0, 100));
    }
  }

  // 2차: Gemini 폴백
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await getGemini().models.generateContent({
        model: "gemini-2.0-flash-exp-image-generation",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      if (imagePart?.inlineData?.data) {
        const mimeType = imagePart.inlineData.mimeType || "image/png";
        return `data:${mimeType};base64,${imagePart.inlineData.data}`;
      }
    } catch (err: any) {
      console.warn("Gemini 이미지 생성 실패:", err?.message?.slice(0, 80));
    }
  }

  throw new Error("이미지 생성 실패 (DALL-E/Gemini 모두 실패)");
}

export async function generateImage(
  keyword: string,
  slideText?: string
): Promise<string> {
  // Generate realistic photography-style image WITHOUT text
  const contentHint = slideText ? `Content context: "${slideText}"` : '';
  
  const prompt = `Create a stunning realistic photograph for "${keyword}":
- Style: Professional photography, photorealistic, high-quality stock photo style
- DO NOT include any text, letters, or typography in the image
- Capture real-world scenes that represent "${keyword}":
  * If food: professional food photography with appetizing dishes, fresh ingredients, beautiful plating
  * If beauty/skincare: elegant product shots, lifestyle beauty moments, spa atmospheres
  * If fitness/health: real gym scenes, outdoor exercise, healthy lifestyle moments
  * If travel: breathtaking landscape photography, travel destinations, adventure moments
  * If business: professional office environments, business meetings, success moments
  * If technology: sleek device photography, modern tech setups, innovation scenes
  * If lifestyle: cozy home interiors, daily life moments, aesthetic living spaces
- Photography characteristics:
  * Natural or studio lighting
  * Sharp focus with beautiful bokeh/depth of field
  * Rich colors and professional color grading
  * High resolution quality
  * Bright, well-lit, and airy — no dark overlays or shadows
- Overall mood: Authentic, professional, aspirational
${contentHint}
Topic: ${keyword}`;

  return generateImageWithGemini(prompt);
}

export async function generateInstagramVisual(
  keyword: string,
  slideHeadline: string,
  isCover: boolean = false
): Promise<string> {
  let prompt: string;
  
  if (isCover) {
    // Cover slide - stunning realistic photography (NO text in image)
    prompt = `Create a stunning realistic photograph for Instagram cover about "${keyword}":
- Style: Professional photography, photorealistic, high-end stock photo quality
- DO NOT include any text, letters, words, or typography in the image
- Capture a beautiful real-world scene representing "${keyword}":
  * If food: mouth-watering food photography, fresh ingredients, artistic plating, warm lighting
  * If beauty/skincare: luxury cosmetic products, spa atmosphere, elegant textures, soft lighting
  * If fitness/health: dynamic gym scene, outdoor exercise, athletic moments, energetic mood
  * If travel: breathtaking landscape, iconic destinations, golden hour lighting, wanderlust vibes
  * If business: sleek office environment, professional success moments, modern workspace
  * If technology: cutting-edge devices, futuristic setups, clean tech aesthetics
  * If lifestyle: cozy interiors, aesthetic daily moments, warm inviting spaces
- Photography characteristics:
  * Professional studio or natural lighting
  * Sharp focus with beautiful depth of field
  * Rich, vibrant colors with professional grading
  * Bright and well-lit — clean, light background, no dark tones
  * Eye-catching composition
- Overall mood: Aspirational, professional, visually stunning
- Size: Square format (1:1) for Instagram
Topic: ${keyword}`;
  } else {
    // Content slide - realistic photography matching slide content (NO text in image)
    prompt = `Create a realistic photograph for Instagram slide about "${slideHeadline}":
- Style: Professional photography, photorealistic, authentic stock photo quality
- DO NOT include any text, letters, words, or typography in the image
- Capture a real-world scene that represents "${slideHeadline}":
  * Show actual objects, products, or scenes related to "${slideHeadline}"
  * If food-related: real food photography, ingredients, cooking process
  * If beauty-related: actual cosmetic products, skincare routines, beauty moments
  * If health-related: real exercise, wellness activities, healthy lifestyle
  * If business-related: authentic office scenes, professional activities
  * If tech-related: real devices, technology in use, modern setups
  * If lifestyle-related: genuine home moments, daily activities, cozy spaces
- Photography characteristics:
  * Natural or professional lighting
  * Clean composition with clear subject
  * Bright, vibrant colors — light and airy, no dark tones or shadows
  * Beautiful bokeh/depth of field where appropriate
- Overall mood: Authentic, informative, professional
- Size: Square format (1:1) for Instagram
Slide topic: ${slideHeadline}
Main theme: ${keyword}`;
  }

  return generateImageWithGemini(prompt);
}

export async function generateBlogInfographic(
  keyword: string,
  sectionHeading: string,
  sectionSummary: string
): Promise<string> {
  // Realistic photography for blog sections - NO text in image
  const contentHint = sectionSummary ? `Context: ${sectionSummary.substring(0, 100)}` : '';
  
  const prompt = `Create a realistic photograph for blog section about "${sectionHeading}":
- Style: Professional photography, photorealistic, editorial/stock photo quality
- DO NOT include any text, letters, words, or typography in the image
- Capture a real-world scene representing "${sectionHeading}":
  * If food-related: professional food photography, ingredients, cooking scenes, plated dishes
  * If beauty/skincare: luxury product shots, spa environments, beauty routines, elegant textures
  * If health/fitness: real gym environments, outdoor exercise, wellness activities, healthy lifestyle
  * If business/career: professional office spaces, business meetings, work environments, success moments
  * If technology: real devices in use, modern tech setups, innovation scenes, digital workspaces
  * If lifestyle/home: cozy interiors, daily life moments, aesthetic living spaces, comfortable environments
  * If travel: landscape photography, destination scenes, adventure moments, cultural experiences
  * If education/learning: study environments, books, learning moments, knowledge symbols
- Photography characteristics:
  * Professional natural or studio lighting
  * Sharp focus with artistic depth of field
  * Rich, authentic colors with subtle grading
  * Clean composition focusing on the subject
  * Bright and well-exposed — light, airy tones, no dark vignette or shadows
- Overall mood: Authentic, informative, professional, trustworthy
- Size: Landscape format (16:9 or 4:3) suitable for blog content
${contentHint}
Section topic: ${sectionHeading}
Article theme: ${keyword}`;

  return generateImageWithGemini(prompt);
}

export async function editContentWithChat(
  currentContent: ContentSet,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  return pRetry(
    async () => {
      try {
        // Build context about current content
        const contentContext = [];
        
        if (currentContent.instagramSlides) {
          contentContext.push(`**인스타그램 슬라이드:**\n${currentContent.instagramSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
        }
        if (currentContent.instagramCaption) {
          contentContext.push(`**인스타그램 캡션:**\n${currentContent.instagramCaption}`);
        }
        if (currentContent.instagramHashtags) {
          contentContext.push(`**인스타그램 해시태그:**\n${currentContent.instagramHashtags.join(', ')}`);
        }
        if (currentContent.blogTitle) {
          contentContext.push(`**블로그 제목:**\n${currentContent.blogTitle}`);
        }
        if (currentContent.blogContent) {
          contentContext.push(`**블로그 내용:**\n${currentContent.blogContent.substring(0, 500)}...`);
        }
        
        const systemPrompt = `당신은 콘텐츠 편집 어시스턴트입니다. 사용자의 요청에 따라 인스타그램과 블로그 콘텐츠를 수정합니다.

현재 콘텐츠:
${contentContext.join('\n\n')}

사용자가 콘텐츠 수정을 요청하면:
1. 어떤 부분을 수정할지 이해합니다
2. 수정된 콘텐츠를 생성합니다
3. 수정 사항을 명확하게 설명합니다

**중요:** 블로그 콘텐츠를 수정할 때는 반드시 blogContent와 blogHtml을 모두 업데이트해야 합니다.
- blogContent: 마크다운 형식의 텍스트
- blogHtml: blogContent를 HTML로 변환한 것 (H2 태그로 섹션 구분)

응답은 반드시 다음 JSON 형식이어야 합니다:
{
  "message": "수정 사항에 대한 설명 (한국어)",
  "updatedContent": {
    "instagramSlides": ["수정된 슬라이드 배열"] (선택사항),
    "instagramCaption": "수정된 캡션" (선택사항),
    "instagramHashtags": ["수정된 해시태그 배열"] (선택사항),
    "blogTitle": "수정된 제목" (선택사항),
    "blogContent": "수정된 내용" (선택사항),
    "blogMetaDescription": "수정된 메타 설명" (선택사항),
    "blogHtml": "수정된 HTML - blogContent를 수정할 때 반드시 함께 제공" (선택사항)
  }
}

수정하지 않은 필드는 updatedContent에서 제외하세요.
블로그 콘텐츠를 수정할 때는 blogContent와 blogHtml을 항상 함께 업데이트하세요.`;

        const messages: OpenAIType.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt }
        ];
        
        // Add conversation history
        for (const msg of conversationHistory) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
        
        // Add current user message
        messages.push({ role: "user", content: userMessage });

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages,
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response generated");
        }

        return JSON.parse(content);
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

interface BrandAnalysisResult {
  usp: string;
  customerPersona: string;
  painPoints: string;
  solution: string;
}

export async function generateBrandAnalysis(
  brandName: string,
  productService: string
): Promise<BrandAnalysisResult> {
  return pRetry(
    async () => {
      try {
        const prompt = `당신은 마케팅 전략 전문가입니다. 다음 브랜드/제품에 대한 마케팅 전략 분석을 해주세요.

**브랜드명:** ${brandName}
**제품/서비스:** ${productService}

다음 4가지 요소를 심층 분석해주세요:

1. **USP (Unique Selling Proposition) - 고유 판매 제안**
   - 이 브랜드/제품만의 독특한 가치는 무엇인가?
   - 경쟁사와 차별화되는 핵심 강점은?
   - 고객이 이 제품을 선택해야 하는 이유는?

2. **고객 페르소나 (Customer Persona)**
   - 이상적인 고객의 인구통계학적 특성 (나이, 성별, 직업, 소득 등)
   - 고객의 라이프스타일과 관심사
   - 고객의 구매 행동 패턴과 의사결정 요인

3. **고객의 Pain Point (고통점/문제점)**
   - 고객이 현재 겪고 있는 주요 문제나 불편함
   - 기존 솔루션의 한계점
   - 충족되지 않은 니즈나 욕구

4. **브랜드의 Solution (솔루션)**
   - 위 Pain Point를 어떻게 해결하는가?
   - 제품/서비스가 제공하는 구체적인 혜택
   - 고객 경험을 어떻게 개선하는가?

각 항목을 2-3개의 문단으로 상세하게 작성해주세요. 모든 내용은 한국어로 작성해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "usp": "USP 분석 내용 (여러 문단)",
  "customerPersona": "고객 페르소나 분석 내용 (여러 문단)",
  "painPoints": "Pain Point 분석 내용 (여러 문단)",
  "solution": "Solution 분석 내용 (여러 문단)"
}`;

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        return JSON.parse(content);
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

interface MonthlyPlanContent {
  title: string;
  themes: string[];
  contentItems: {
    date: string;
    dayOfWeek: string;
    topic: string;
    platforms: string[];
    contentType: string;
    notes?: string;
  }[];
}

export async function generateMonthlyPlan(
  year: string,
  month: string,
  brandContext?: string,
  focusTopics?: string
): Promise<MonthlyPlanContent> {
  return pRetry(
    async () => {
      try {
        const monthPadded = month.padStart(2, '0');
        const brandSection = brandContext ? `
**브랜드 컨텍스트 (이 정보를 반영하여 콘텐츠 플랜을 작성하세요):**
${brandContext}

` : "";

        const focusSection = focusTopics ? `
**집중 주제/키워드:**
${focusTopics}

` : "";

        const prompt = `${brandSection}${focusSection}${year}년 ${month}월의 한 달치 콘텐츠 플랜을 생성해주세요.

다음 규칙을 따라주세요:
1. 주 3-4회 정도의 콘텐츠 발행 일정을 계획해주세요 (월~금 중 선택)
2. 각 콘텐츠에 대해 다음 정보를 제공해주세요:
   - 날짜 (YYYY-MM-DD 형식)
   - 요일
   - 주제/키워드
   - 플랫폼 (instagram, blog 중 선택, 둘 다 가능)
   - 콘텐츠 유형 (정보형, 스토리형, 프로모션, 트렌드, 교육, Q&A 등)
   - 간단한 메모 (선택사항)

3. 월간 테마 2-3개를 정하고, 각 콘텐츠가 테마와 연결되도록 해주세요.
4. 다양한 콘텐츠 유형을 균형있게 배치해주세요.
5. 월 초/중순/말의 흐름을 고려해주세요.

모든 내용은 한국어로 작성해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "title": "${year}년 ${month}월 콘텐츠 플랜",
  "themes": ["월간 테마 1", "월간 테마 2", "월간 테마 3"],
  "contentItems": [
    {
      "date": "${year}-${monthPadded}-01",
      "dayOfWeek": "월",
      "topic": "콘텐츠 주제/키워드",
      "platforms": ["instagram", "blog"],
      "contentType": "정보형",
      "notes": "추가 메모 (선택사항)"
    }
  ]
}`;

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        const parsed = JSON.parse(content);
        
        return {
          title: parsed.title || `${year}년 ${month}월 콘텐츠 플랜`,
          themes: parsed.themes || [],
          contentItems: parsed.contentItems || [],
        };
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

interface YouTubeScriptureContent {
  videoTitle: string;
  videoSummary: string;
  bibleVerse: string;
  bibleReference: string;
  instagramSlides: string[];
  instagramCaption: string;
  instagramHashtags: string[];
  blogTitle: string;
  blogContent: string;
  blogMetaDescription: string;
}

export async function generateYouTubeScriptureContent(
  transcript: string,
  verseHint?: string
): Promise<YouTubeScriptureContent> {
  return pRetry(
    async () => {
      try {
        const hintSection = verseHint ? `
사용자가 원하는 힌트: "${verseHint}"
이 힌트를 참고하여 관련 성경 구절을 선택해주세요.
` : "";

        const prompt = `유튜브 영상 자막을 분석하고 성경 말씀 기반 인스타그램 콘텐츠와 블로그 콘텐츠를 생성해주세요.

영상 자막:
${transcript.substring(0, 5000)}

${hintSection}

다음을 생성해주세요:
1. 영상 제목 (자막 내용 기반 추정)
2. 영상 핵심 요약 (2-3문장)
3. 영상 내용과 가장 잘 어울리는 성경 말씀 (한글 개역개정 기준)
4. 성경 구절 출처 (예: 요한복음 3:16)
5. 인스타그램 캐러셀 슬라이드 (4-6장):
   - 첫 슬라이드: 말씀 구절 핵심 키워드 (15자 이내)
   - 중간 슬라이드: 말씀 해석/적용 포인트 (각 15자 이내)
   - 마지막 슬라이드: 기도/다짐 문구 (15자 이내)
6. 인스타그램 캡션:
   - 영상 내용 연결
   - 말씀 설명
   - 적용점
   - 기도 문구
   - CTA
7. 관련 해시태그 15-20개 (# 없이)
8. 블로그 제목 (SEO 최적화, 검색하기 좋은 제목)
9. 블로그 본문 (HTML 형식):
   - 도입부: 영상 내용 소개 및 관심 유도
   - 성경 말씀 소개 및 해석
   - 말씀의 핵심 메시지 (3-5개 포인트)
   - 실생활 적용 방법
   - 기도문
   - 마무리 및 축복 인사
   - 총 1500-2000자 분량
10. 블로그 메타 설명 (SEO용, 150자 이내)

모든 콘텐츠는 한국어로 작성해주세요.

JSON 형식으로 응답:
{
  "videoTitle": "영상 제목",
  "videoSummary": "영상 요약",
  "bibleVerse": "성경 말씀 전문",
  "bibleReference": "성경 출처",
  "instagramSlides": ["슬라이드1", "슬라이드2", ...],
  "instagramCaption": "캡션 전문",
  "instagramHashtags": ["해시태그1", "해시태그2", ...],
  "blogTitle": "블로그 제목",
  "blogContent": "<h2>...</h2><p>...</p>...",
  "blogMetaDescription": "메타 설명"
}`;

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        const parsed = JSON.parse(content);
        
        return {
          videoTitle: parsed.videoTitle || "영상 제목",
          videoSummary: parsed.videoSummary || "",
          bibleVerse: parsed.bibleVerse || "",
          bibleReference: parsed.bibleReference || "",
          instagramSlides: parsed.instagramSlides || [],
          instagramCaption: parsed.instagramCaption || "",
          instagramHashtags: parsed.instagramHashtags || [],
          blogTitle: parsed.blogTitle || "",
          blogContent: parsed.blogContent || "",
          blogMetaDescription: parsed.blogMetaDescription || "",
        };
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

export async function generateScriptureImage(
  slideText: string,
  bibleReference: string
): Promise<string | null> {
  try {
    const prompt = `Create a serene and spiritual background image for a Christian Instagram post.

Theme: ${slideText}
Bible Reference: ${bibleReference}

Style requirements:
- Peaceful, calming atmosphere
- Soft, warm lighting (golden hour or sunrise feel)
- Nature elements: sky, clouds, light rays, flowers, or peaceful landscape
- Subtle religious symbolism (cross silhouette, light beams, dove optional)
- Color palette: soft pastels, warm golds, peaceful blues
- NO text in the image
- High quality, Instagram-ready composition (square format)
- Professional photography style
- Inspirational and uplifting mood`;

    const response = await getGemini().models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64 = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || "image/png";
          return `data:${mimeType};base64,${base64}`;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error generating scripture image:", error);
    return null;
  }
}

// Interface for invention content generation
interface InventionContentResult {
  instagramSlides: string[];
  instagramCaption: string;
  instagramHashtags: string[];
  shortsScript: string;
  shortsScenes: { scene: number; description: string; duration: string; narration: string }[];
  shortsDuration: string;
  shortsTitle: string;
  shortsHook: string;
  shortsHashtags: string[];
  blogTitle: string;
  blogContent: string;
  blogHtml: string;
  blogMetaDescription: string;
  blogHashtags: string[];
}

interface InventionIdea {
  title: string;
  problem: string;
  solution: string;
  useCases?: string | null;
  targetAudience?: string[] | null;
  tone?: string | null;
}

export async function generateInventionContent(
  idea: InventionIdea
): Promise<InventionContentResult> {
  return pRetry(
    async () => {
      try {
        const targetAudienceText = idea.targetAudience?.join(", ") || "일반 소비자";
        const toneText = idea.tone === "professional" ? "전문적이고 신뢰감 있는" :
                        idea.tone === "emotional" ? "감성적이고 공감가는" :
                        "캐주얼하고 친근한";

        const prompt = `당신은 발명 아이디어를 매력적인 SNS 콘텐츠로 변환하는 전문가입니다.

**발명 아이디어 정보:**
- 제목: ${idea.title}
- 해결하려는 문제: ${idea.problem}
- 해결 방법: ${idea.solution}
${idea.useCases ? `- 활용 분야: ${idea.useCases}` : ""}
- 타겟 고객: ${targetAudienceText}
- 콘텐츠 톤: ${toneText}

**요청사항:**

1. **인스타그램 카드뉴스 (정확히 5장)**
   - 첫 번째 슬라이드: 주목을 끄는 헤드라인 (20자 이내)
   - 두 번째~네 번째 슬라이드: 핵심 포인트 (각 15자 이내)
   - 다섯 번째 슬라이드: CTA 또는 결론 (15자 이내)

2. **인스타그램 캡션**
   - 관심을 끄는 훅으로 시작
   - 문제-해결 구조로 발명 설명
   - 명확한 CTA (좋아요, 저장, 댓글 유도)

3. **해시태그** (10-15개)
   - 발명, 스타트업, 기술 관련 해시태그

4. **숏츠 영상 스크립트 (조회수 폭발 전략 적용, 총 15~25초)**
   - **제목 (shortsTitle)**: 검색 최적화된 유튜브 숏츠 제목
     * 앞부분에 핵심 키워드 배치 (예: "발명 아이디어 공개" → "집에서 만드는 스마트 발명품")
     * 30자 이내, 호기심·유용성·충격 중 하나를 자극
   - **처음 3초 훅 (shortsHook)**: 시청자가 넘기지 않게 만드는 한 마디 (15자 이내)
     * 충격적 사실, 공감 유발 질문, "이거 모르면 손해" 스타일
     * 예: "왜 아무도 안 만들었을까", "이 문제 10년째 참고 살았다"
   - **씬 구성 (3~5개 씬)**:
     * 씬 1 (3~5초): 훅 + 문제 제시 — 시청자의 공감/호기심 최대화
     * 씬 2~3 (각 5~8초): 발명 해결책 소개, 시각적 임팩트 강조
     * 씬 4~5 (3~5초): CTA — "댓글로 알려주세요" / "특허 내고 싶으면 저장!" 형태로 참여 유도
   - **해시태그 전략 (shortsHashtags)**: 정확히 5개, 아래 구조로
     * 대형 태그 1개 (예: #발명)
     * 중형 태그 1~2개 (주제 관련, 예: #스마트홈 #아이디어상품)
     * 특화 태그 1개 (발명 내용 맞춤)
     * #Shorts 반드시 포함
   - **나레이션 작성 규칙**:
     * 반드시 평서문(마침표)으로 끝낼 것. 물음표나 느낌표 금지
     * 말끝이 내려오는 자연스러운 어조 (예: "~입니다.", "~합니다.", "~됩니다.")
     * 짧고 명확한 문장, 한 씬당 1~2문장
     * 방송 뉴스 앵커처럼 또렷하고 안정적인 어조

5. **블로그 글 (네이버 인기 블로거 스타일)**
   - 제목: SEO 최적화, 발명 아이디어 키워드 포함
   - 메타 설명: 120-150자
   - 첫 문장은 강력한 Hook으로 시작 (질문, 충격적 사실, 공감 유발)
   - 소제목(H2/H3)을 활용해 3~5개의 본론 구성
   - 발명의 문제-해결 구조로 설명
   - 활용 분야, 시장성, 차별점 등 구체적으로 기술
   - 짧은 문장, 리스트, 굵은글씨 활용
   - 결론에서 핵심 요약 + CTA 포함
   - HTML 포맷팅 포함 (H2, H3, ul, li, strong, table 등)
   - 독자에게 말하듯 친근하고 신뢰감 있는 톤 (존댓말 사용)
   - 블로그용 해시태그 10개 (발명, 기술, 스타트업, 특허, 혁신 등 관련)

다음 JSON 형식으로 응답해주세요:
{
  "instagramSlides": ["슬라이드1", "슬라이드2", ...],
  "instagramCaption": "캡션 전체 텍스트",
  "instagramHashtags": ["해시태그1", "해시태그2", ...],
  "shortsTitle": "유튜브 숏츠 제목 (30자 이내, 검색 최적화)",
  "shortsHook": "처음 3초 훅 문구 (15자 이내)",
  "shortsHashtags": ["#발명", "#아이디어상품", "#Shorts", "#스마트홈", "#특허"],
  "shortsScript": "전체 스크립트 텍스트",
  "shortsScenes": [
    {"scene": 1, "description": "씬 설명", "duration": "5초", "narration": "나레이션 텍스트"},
    ...
  ],
  "shortsDuration": "20초",
  "blogTitle": "블로그 제목",
  "blogContent": "블로그 전체 내용 (순수 텍스트, HTML 태그 없이)",
  "blogHtml": "블로그 전체 내용 (HTML 포맷팅 포함)",
  "blogMetaDescription": "메타 설명 (120-150자)",
  "blogHashtags": ["해시태그1", "해시태그2", ...]
}`;

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        const result = JSON.parse(content);
        
        // Ensure slide headlines are concise
        if (result.instagramSlides && Array.isArray(result.instagramSlides)) {
          result.instagramSlides = result.instagramSlides.map((slide: string, index: number) => {
            const maxLength = index === 0 ? 20 : 15;
            return slide.length > maxLength ? slide.substring(0, maxLength) : slide;
          });
        }
        
        return {
          instagramSlides: result.instagramSlides || [],
          instagramCaption: result.instagramCaption || "",
          instagramHashtags: result.instagramHashtags || [],
          shortsScript: result.shortsScript || "",
          shortsScenes: result.shortsScenes || [],
          shortsDuration: result.shortsDuration || "20초",
          shortsTitle: result.shortsTitle || "",
          shortsHook: result.shortsHook || "",
          shortsHashtags: result.shortsHashtags || [],
          blogTitle: result.blogTitle || "",
          blogContent: result.blogContent || "",
          blogHtml: result.blogHtml || "",
          blogMetaDescription: result.blogMetaDescription || "",
          blogHashtags: result.blogHashtags || [],
        };
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 5,
      minTimeout: 2000,
      maxTimeout: 64000,
      factor: 2,
    }
  );
}


async function generateTTSClovaVoice(text: string): Promise<Buffer> {
  const clientId = process.env.CLOVA_CLIENT_ID;
  const clientSecret = process.env.CLOVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("CLOVA credentials not set");

  const params = new URLSearchParams({
    speaker: "nara",       // Natural Korean female voice
    volume: "0",
    speed: "0",
    pitch: "0",
    format: "mp3",
    text: text.slice(0, 900),
  });

  const res = await fetch("https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`CLOVA TTS error ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function generateTTSElevenLabs(text: string, voiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  // Use custom cloned voice if provided, otherwise "Aria" multilingual
  const vid = voiceId || "9BWtsMINqrJLrRacOk9x";

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS error ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function generateTTSOpenAI(text: string): Promise<Buffer> {
  const response = await getOpenAI().audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
    response_format: "mp3",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateTTSEdge(text: string): Promise<Buffer> {
  const os = await import("os");
  const path = await import("path");
  const fs = await import("fs");
  const { EdgeTTS } = await import("node-edge-tts");

  const tts = new EdgeTTS({
    voice: "ko-KR-HyunsuMultilingualNeural",
    lang: "ko-KR",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    rate: "-5%",
    pitch: "-8%",
  });

  const tmpFile = path.join(os.tmpdir(), `edge_tts_${Date.now()}.mp3`);
  try {
    await tts.ttsPromise(text, tmpFile);
    const buf = fs.readFileSync(tmpFile);
    if (buf.length === 0) throw new Error("Edge TTS returned empty audio");
    return buf;
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

async function generateTTSGoogleFallback(text: string): Promise<Buffer> {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。])\s+/);
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > 380) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current = current ? current + " " + s : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0) chunks.push(text.slice(0, 380));

  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    // Keep period at end so TTS engine knows the sentence is complete (prevents rising intonation)
    // Replace question marks / exclamation marks with periods for more neutral, natural delivery
    const normalized = chunk.replace(/[!！?？]+$/, ".").trim();
    const encoded = encodeURIComponent(normalized);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ko&client=tw-ob&ttsspeed=0.9`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
      },
    });
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
    audioBuffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(audioBuffers);
}

async function generateTTSFishAudio(text: string, referenceAudioBuffer?: Buffer): Promise<Buffer> {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) throw new Error("FISH_AUDIO_API_KEY not set");

  let body: Buffer;
  let contentType: string;

  if (referenceAudioBuffer) {
    // Use msgpack for inline zero-shot voice cloning
    const { encode } = await import("@msgpack/msgpack");
    const payload = {
      model: "s1",
      text,
      references: [{ audio: new Uint8Array(referenceAudioBuffer), text: "" }],
      format: "mp3",
      mp3_bitrate: 128,
      normalize: true,
      latency: "normal",
      prosody: { speed: 1.0, volume: 0 },
    };
    body = Buffer.from(encode(payload));
    contentType = "application/msgpack";
  } else {
    const jsonPayload = {
      model: "s1",
      text,
      format: "mp3",
      mp3_bitrate: 128,
      normalize: true,
      latency: "normal",
      prosody: { speed: 1.0, volume: 0 },
    };
    body = Buffer.from(JSON.stringify(jsonPayload));
    contentType = "application/json";
  }

  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": contentType,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fish Audio TTS error ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function generateTTS(text: string, voiceId?: string, referenceAudioBase64?: string): Promise<{ data: Buffer; mimeType: string }> {
  // Fish Audio with inline voice reference (zero-shot cloning) — highest priority when reference provided
  if (referenceAudioBase64 && process.env.FISH_AUDIO_API_KEY) {
    try {
      const refBuffer = Buffer.from(referenceAudioBase64, "base64");
      const data = await generateTTSFishAudio(text, refBuffer);
      console.log("TTS: Fish Audio zero-shot voice clone");
      return { data, mimeType: "audio/mpeg" };
    } catch (err: any) {
      console.warn("Fish Audio TTS failed, falling back:", err?.message);
    }
  }

  // ElevenLabs with cloned voice ID
  if (voiceId && process.env.ELEVENLABS_API_KEY) {
    try {
      const data = await generateTTSElevenLabs(text, voiceId);
      console.log("TTS: Using cloned voice", voiceId);
      return { data, mimeType: "audio/mpeg" };
    } catch (err: any) {
      console.warn("ElevenLabs cloned voice TTS failed, falling back:", err?.message);
    }
  }

  // Priority 2: Microsoft Edge TTS — high quality Korean neural voice, no API key needed
  try {
    const data = await generateTTSEdge(text);
    console.log("TTS: Using Edge TTS (ko-KR-HyunsuMultilingualNeural)");
    return { data, mimeType: "audio/mpeg" };
  } catch (err: any) {
    console.warn("Edge TTS failed:", err?.message);
  }

  // Priority 3: Fish Audio (no reference)
  if (process.env.FISH_AUDIO_API_KEY) {
    try {
      const data = await generateTTSFishAudio(text);
      console.log("TTS: Fish Audio (no voice reference)");
      return { data, mimeType: "audio/mpeg" };
    } catch (err: any) {
      console.warn("Fish Audio TTS (no ref) failed:", err?.message);
    }
  }

  // Priority 4: CLOVA → OpenAI → ElevenLabs
  if (process.env.CLOVA_CLIENT_ID && process.env.CLOVA_CLIENT_SECRET) {
    try {
      const data = await generateTTSClovaVoice(text);
      console.log("TTS: Using CLOVA Voice");
      return { data, mimeType: "audio/mpeg" };
    } catch (err: any) {
      console.warn("CLOVA TTS failed:", err?.message);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const data = await generateTTSOpenAI(text);
      console.log("TTS: Using OpenAI TTS (nova)");
      return { data, mimeType: "audio/mpeg" };
    } catch (err: any) {
      console.warn("OpenAI TTS failed:", err?.message);
    }
  }
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const data = await generateTTSElevenLabs(text);
      console.log("TTS: Using ElevenLabs");
      return { data, mimeType: "audio/mpeg" };
    } catch (err: any) {
      console.warn("ElevenLabs TTS failed:", err?.message);
    }
  }

  console.log("TTS: Using Google Translate fallback");
  const data = await generateTTSGoogleFallback(text);
  return { data, mimeType: "audio/mpeg" };
}

// ── AI 슬라이드 텍스트 편집 ───────────────────────────────────────────────
export async function editInventionSlides(
  slides: string[],
  instruction: string,
  slideIndex?: number
): Promise<string[]> {
  const systemPrompt = `당신은 인스타그램 카드뉴스 텍스트 편집 전문가입니다.
발명 아이디어를 소개하는 카드뉴스 슬라이드 텍스트를 사용자의 요청에 맞게 수정합니다.
각 슬라이드 텍스트는 간결하고 임팩트 있게 유지하세요. 보통 1~3줄 분량입니다.
반드시 JSON 형식으로만 응답하세요.`;

  let userPrompt: string;

  if (slideIndex !== undefined) {
    userPrompt = `현재 슬라이드 텍스트: "${slides[slideIndex]}"

수정 요청: ${instruction}

반드시 다음 JSON 형식으로만 응답하세요:
{"slide": "수정된 슬라이드 텍스트"}`;
  } else {
    const slidesText = slides.map((s, i) => `슬라이드 ${i + 1}: "${s}"`).join("\n");
    userPrompt = `현재 슬라이드들:
${slidesText}

수정 요청: ${instruction}

슬라이드 수를 그대로 유지하고 반드시 다음 JSON 형식으로만 응답하세요:
{"slides": ["슬라이드1텍스트", "슬라이드2텍스트", ...]}`;
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");

  if (slideIndex !== undefined) {
    const newSlides = [...slides];
    newSlides[slideIndex] = result.slide || slides[slideIndex];
    return newSlides;
  } else {
    return Array.isArray(result.slides) && result.slides.length === slides.length
      ? result.slides
      : slides;
  }
}
