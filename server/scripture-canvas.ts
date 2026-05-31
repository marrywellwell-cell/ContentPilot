/**
 * scripture-canvas.ts — Canvas 텍스트 오버레이 공유 유틸 (메모리 처리, 파일시스템 불필요)
 */
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let fontsRegistered = false;

async function ensureFonts() {
  if (fontsRegistered) return;
  const { registerFont } = await import("canvas");

  // 후보 경로: ESM __dirname 기준 → process.cwd() 기준 순으로 시도
  const candidates = [
    path.join(__dirname, "fonts"),
    path.join(process.cwd(), "server", "fonts"),
    path.join(process.cwd(), "fonts"),
  ];

  for (const fontDir of candidates) {
    try {
      const boldPath = path.join(fontDir, "NotoSansKR-Bold.ttf");
      const regularPath = path.join(fontDir, "NotoSansKR-Regular.ttf");
      const { existsSync } = await import("fs");
      if (!existsSync(boldPath)) continue;
      registerFont(boldPath, { family: "NotoSansKR", weight: "bold" });
      registerFont(regularPath, { family: "NotoSansKR", weight: "normal" });
      fontsRegistered = true;
      console.log("[canvas] 폰트 등록 성공:", fontDir);
      return;
    } catch (e: any) {
      console.warn("[canvas] 폰트 경로 실패:", fontDir, e.message?.slice(0, 60));
    }
  }
  console.error("[canvas] 모든 폰트 경로 실패 — 한국어 폰트 없이 렌더링");
}

function wrapText(ctx: any, text: string, maxWidth: number, maxLines = 8): string[] {
  if (!text?.trim()) return [""];
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      if (ctx.measureText(word).width > maxWidth) {
        let rem = word;
        while (rem.length > 0) {
          let charLine = "";
          for (const char of rem) {
            if (ctx.measureText(charLine + char).width > maxWidth && charLine.length > 0) break;
            charLine += char;
          }
          lines.push(charLine);
          rem = rem.slice(charLine.length);
        }
        currentLine = "";
      } else currentLine = word;
    } else currentLine = testLine;
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, maxLines);
}

function base64ToBuffer(dataUrl: string): Buffer {
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return Buffer.from(b64, "base64");
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── 슬라이드 테마 ─────────────────────────────────────────────────────────────

interface SlideTheme {
  bg1: string; bg2: string;
  accent: string; text: string;
  circle1: string; circle2: string;
  bar: string;
  name: string;
}

function getSlideTheme(slideText: string, index: number): SlideTheme {
  const t = slideText;
  const themes: SlideTheme[] = [
    // 0 Rose — 사랑/은혜/선행
    { name:"rose", bg1:"#FFF5F7", bg2:"#FFE4EE", accent:"#E91E63", text:"#4A0010",
      circle1:"rgba(233,30,99,0.10)", circle2:"rgba(255,105,155,0.08)", bar:"#E91E63" },
    // 1 Golden — 기도/찬양/감사
    { name:"golden", bg1:"#FFFDE7", bg2:"#FFF3C0", accent:"#F57F17", text:"#3E2000",
      circle1:"rgba(245,127,23,0.10)", circle2:"rgba(255,200,50,0.08)", bar:"#F57F17" },
    // 2 Sky — 믿음/말씀/신뢰
    { name:"sky", bg1:"#E3F2FD", bg2:"#DDEEFF", accent:"#1565C0", text:"#0A1E40",
      circle1:"rgba(21,101,192,0.09)", circle2:"rgba(100,181,246,0.10)", bar:"#1565C0" },
    // 3 Lavender — 소망/비전/새로운
    { name:"lavender", bg1:"#F3E5F5", bg2:"#EAD5F7", accent:"#7B1FA2", text:"#2D0050",
      circle1:"rgba(123,31,162,0.09)", circle2:"rgba(186,104,200,0.10)", bar:"#7B1FA2" },
    // 4 Mint — 평화/공동체/함께
    { name:"mint", bg1:"#E0F7FA", bg2:"#D0F5EC", accent:"#00796B", text:"#00271A",
      circle1:"rgba(0,121,107,0.09)", circle2:"rgba(77,182,172,0.10)", bar:"#00796B" },
  ];

  if (t.match(/사랑|love|섬기|봉사|은혜|grace|선행|헌신/)) return themes[0];
  if (t.match(/기도|pray|간구|찬양|praise|감사|경배|worship/)) return themes[1];
  if (t.match(/믿음|faith|신뢰|말씀|word|성경|scripture|진리/)) return themes[2];
  if (t.match(/소망|hope|비전|vision|새로운|미래|기대|부활/)) return themes[3];
  if (t.match(/평화|peace|평안|공동체|함께|연합|교회|화해/)) return themes[4];
  return themes[index % themes.length];
}

// ── 메인 이미지 오버레이 (밝은 frosted-glass 스타일) ─────────────────────────

export async function addVerseOverlayToBase64(
  imageBase64: string,
  verseReference: string,
  verseContent: string
): Promise<string> {
  try {
    await ensureFonts();
    const { createCanvas, loadImage } = await import("canvas");

    const image = await loadImage(base64ToBuffer(imageBase64));
    const W = image.width, H = image.height;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d") as any;

    // 흰 배경 위에 이미지 55% 투명도로 → 어두운 사진도 밝고 파스텔하게
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(image, 0, 0, W, H);
    ctx.globalAlpha = 1.0;

    // 중앙 frosted-glass 패널
    const padX = W * 0.06;
    const panelW = W - padX * 2;
    const contentFontSize = Math.max(26, Math.min(36, W * 0.034));
    const refFontSize = contentFontSize - 6;
    const lineHeight = contentFontSize * 1.55;

    ctx.font = `bold ${contentFontSize}px "NotoSansKR"`;
    let lines = wrapText(ctx, verseContent, panelW - 70, 8);
    if (lines.length > 8) { lines = lines.slice(0, 8); lines[7] = lines[7].slice(0, -3) + "..."; }

    const totalTxtH = lines.length * lineHeight + refFontSize + 50;
    const panelH = totalTxtH + 70;
    const panelY = H / 2 - panelH / 2;

    // 패널 배경 (흰색 반투명)
    const radius = 18;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    ctx.moveTo(padX + radius, panelY);
    ctx.lineTo(padX + panelW - radius, panelY);
    ctx.quadraticCurveTo(padX + panelW, panelY, padX + panelW, panelY + radius);
    ctx.lineTo(padX + panelW, panelY + panelH - radius);
    ctx.quadraticCurveTo(padX + panelW, panelY + panelH, padX + panelW - radius, panelY + panelH);
    ctx.lineTo(padX + radius, panelY + panelH);
    ctx.quadraticCurveTo(padX, panelY + panelH, padX, panelY + panelH - radius);
    ctx.lineTo(padX, panelY + radius);
    ctx.quadraticCurveTo(padX, panelY, padX + radius, panelY);
    ctx.closePath();
    ctx.fill();

    // 상단 액센트 라인
    ctx.fillStyle = "#E91E63";
    ctx.beginPath();
    ctx.moveTo(padX + radius, panelY);
    ctx.lineTo(padX + panelW - radius, panelY);
    ctx.quadraticCurveTo(padX + panelW, panelY, padX + panelW, panelY + radius);
    ctx.lineTo(padX + panelW, panelY + 6);
    ctx.lineTo(padX, panelY + 6);
    ctx.lineTo(padX, panelY + radius);
    ctx.quadraticCurveTo(padX, panelY, padX + radius, panelY);
    ctx.closePath();
    ctx.fill();

    // 텍스트
    const txtStartY = panelY + 45 + lineHeight / 2;
    ctx.font = `bold ${contentFontSize}px "NotoSansKR"`;
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 4;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, txtStartY + i * lineHeight));

    // 구절 참조
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    ctx.font = `${refFontSize}px "NotoSansKR"`;
    ctx.fillStyle = "#E91E63";
    ctx.fillText(`— ${verseReference} —`, W / 2, txtStartY + lines.length * lineHeight + 28);

    // 워터마크
    ctx.font = `14px "NotoSansKR"`;
    ctx.fillStyle = "rgba(100,100,100,0.55)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("AI 생성 이미지", W - 18, H - 14);

    return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
  } catch (err) {
    console.error("[scripture-canvas] overlay 실패:", err);
    return imageBase64;
  }
}

// ── 인스타그램 슬라이드 생성 ─────────────────────────────────────────────────
// backgrounds: 슬라이드별 배경 이미지(base64). 없으면 파스텔 그라데이션 폴백.

export async function createInstagramSlides(
  backgrounds: (string | null)[] | string | null,
  slides: string[],
  verseReference: string
): Promise<string[]> {
  if (!slides.length) return [];

  // 배열 정규화
  const bgArr: (string | null)[] = Array.isArray(backgrounds)
    ? backgrounds
    : Array(slides.length).fill(backgrounds ?? null);

  try {
    await ensureFonts();
    const { createCanvas, loadImage } = await import("canvas");
    const SIZE = 1080;
    const results: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const theme = getSlideTheme(slides[i], i);
      const bgSrc = bgArr[i] ?? null;
      const canvas = createCanvas(SIZE, SIZE);
      const ctx = canvas.getContext("2d") as any;

      // ① 배경: 실사 이미지(파스텔 처리) or 그라데이션
      if (bgSrc) {
        try {
          const img = await loadImage(base64ToBuffer(bgSrc));
          // 흰 배경 + 이미지 50% 투명도 → 어두운 사진도 밝고 파스텔하게
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, SIZE, SIZE);
          ctx.globalAlpha = 0.50;
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          ctx.globalAlpha = 1.0;
        } catch {
          // 이미지 로드 실패 → 그라데이션 폴백
          const bgGrad = ctx.createLinearGradient(0, 0, SIZE * 0.7, SIZE);
          bgGrad.addColorStop(0, theme.bg1);
          bgGrad.addColorStop(1, theme.bg2);
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, SIZE, SIZE);
        }
      } else {
        // 배경 이미지 없음 → 파스텔 그라데이션
        const bgGrad = ctx.createLinearGradient(0, 0, SIZE * 0.7, SIZE);
        bgGrad.addColorStop(0, theme.bg1);
        bgGrad.addColorStop(1, theme.bg2);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // 테마 컬러 반투명 워시 (실사 이미지 위에 파스텔 느낌 강화)
      if (bgSrc) {
        const [r, g, b] = hexToRgb(theme.bg2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.30)`;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // ② 큰 장식 원 (우상단)
      const cg1 = ctx.createRadialGradient(SIZE * 0.88, SIZE * 0.12, 0, SIZE * 0.88, SIZE * 0.12, SIZE * 0.52);
      cg1.addColorStop(0, theme.circle1);
      cg1.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cg1;
      ctx.beginPath();
      ctx.arc(SIZE * 0.88, SIZE * 0.12, SIZE * 0.52, 0, Math.PI * 2);
      ctx.fill();

      // ③ 작은 장식 원 (좌하단)
      const cg2 = ctx.createRadialGradient(SIZE * 0.12, SIZE * 0.86, 0, SIZE * 0.12, SIZE * 0.86, SIZE * 0.26);
      cg2.addColorStop(0, theme.circle2);
      cg2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cg2;
      ctx.beginPath();
      ctx.arc(SIZE * 0.12, SIZE * 0.86, SIZE * 0.26, 0, Math.PI * 2);
      ctx.fill();

      // ④ 상단 액센트 바
      ctx.fillStyle = theme.bar;
      ctx.fillRect(0, 0, SIZE, 8);

      // ⑤ 슬라이드 번호 (상단 좌)
      const numStr = String(i + 1).padStart(2, "0");
      const totStr = `/ ${String(slides.length).padStart(2, "0")}`;
      ctx.font = `bold 52px "NotoSansKR"`;
      ctx.fillStyle = theme.accent;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(numStr, 56, 36);

      ctx.font = `28px "NotoSansKR"`;
      ctx.fillStyle = theme.accent + "88";
      ctx.fillText(totStr, 56 + ctx.measureText(numStr).width + 12, 53);

      // ⑥ 십자가 장식 (우상단)
      const cx = SIZE - 72, cy = 52, arm = 22, thick = 6;
      ctx.fillStyle = theme.accent + "55";
      ctx.fillRect(cx - arm, cy - thick / 2, arm * 2, thick);
      ctx.fillRect(cx - thick / 2, cy - arm, thick, arm * 2);

      // ⑦ 메인 텍스트
      const maxTxtW = SIZE - 120;
      ctx.font = `bold 82px "NotoSansKR"`;
      ctx.fillStyle = theme.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(255,255,255,0.7)";
      ctx.shadowBlur = 14;

      const lines = wrapText(ctx, slides[i], maxTxtW, 4);
      const lh = 104;
      const totalTxtH = lines.length * lh;
      const txtCenterY = SIZE * 0.50;
      const txtStartY = txtCenterY - totalTxtH / 2 + lh / 2;
      lines.forEach((line, j) => ctx.fillText(line, SIZE / 2, txtStartY + j * lh));

      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;

      // ⑧ 구분선
      const lineY = txtCenterY + totalTxtH / 2 + 38;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(SIZE / 2 - 90, lineY);
      ctx.lineTo(SIZE / 2 + 90, lineY);
      ctx.stroke();

      // ⑨ 말씀 구절 (하단 중앙)
      ctx.font = `30px "NotoSansKR"`;
      ctx.fillStyle = theme.accent;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`— ${verseReference} —`, SIZE / 2, SIZE - 52);

      results.push(`data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", { quality: 0.94 }).toString("base64")}`);
    }

    return results;
  } catch (err) {
    console.error("[scripture-canvas] slide 생성 실패:", err);
    return [];
  }
}

// ── 월간 희망 글귀 오버레이 (1080×1350 인스타그램용) ─────────────────────────

export async function addQuoteOverlayToBase64(
  imageBase64: string,
  quote: string
): Promise<string> {
  try {
    await ensureFonts();
    const { createCanvas, loadImage } = await import("canvas");
    const W = 1080, H = 1350;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d") as any;

    // ── 배경 이미지 ──
    const image = await loadImage(base64ToBuffer(imageBase64));
    ctx.drawImage(image, 0, 0, W, H);

    // ── 전체 어두운 베일 ──
    ctx.fillStyle = "rgba(10,10,20,0.25)";
    ctx.fillRect(0, 0, W, H);

    // ── 하단 그라데이션 ──
    const gradH = H * 0.65;
    const grad = ctx.createLinearGradient(0, H - gradH, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.30, "rgba(5,5,15,0.45)");
    grad.addColorStop(0.65, "rgba(5,5,15,0.75)");
    grad.addColorStop(1, "rgba(5,5,15,0.90)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - gradH, W, gradH);

    // ── **bold** 마커 제거 + 실제 줄 분리 ──
    const cleanQuote = quote
      .replace(/\*\*(.*?)\*\*/g, "$1")  // **text** → text
      .replace(/\*(.*?)\*/g, "$1")      // *text* → text
      .trim();

    const fontFamily = fontsRegistered ? '"NotoSansKR", sans-serif' : "sans-serif";

    // 줄 목록: 명시적 \n 우선, 빈 줄 제거
    const rawLines = cleanQuote.split("\n").filter(l => l.trim().length > 0);

    // 줄이 1개뿐이면 fullText 첫 3줄로 보완 시도
    const inputLines = rawLines.length >= 2 ? rawLines : rawLines;

    // 폰트 크기: 가장 긴 줄 기준, 최대 60px
    const maxLineLen = Math.max(...inputLines.map(l => l.length), 1);
    const fontSize = Math.min(60, Math.max(40, Math.floor(W * 0.65 / maxLineLen)));
    const lineHeight = fontSize * 1.80;
    const maxWidth = W * 0.80;

    // 각 줄 자동 줄바꿈
    const allLines: string[] = [];
    for (const line of inputLines) {
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      if (ctx.measureText(line).width <= maxWidth) {
        allLines.push(line);
      } else {
        let cur = "";
        for (const ch of [...line]) {
          const test = cur + ch;
          if (ctx.measureText(test).width > maxWidth && cur) {
            allLines.push(cur); cur = ch;
          } else { cur = test; }
        }
        if (cur) allLines.push(cur);
      }
    }

    // 텍스트 블록을 이미지 하단 25% 영역에 배치 (잘리지 않도록)
    const totalTextH = allLines.length * lineHeight;
    const maxStartY = H - 80 - totalTextH;   // 하단 여백 80
    const idealCenterY = H * 0.78;
    const blockCenterY = Math.min(idealCenterY, maxStartY + totalTextH / 2);
    const startY = Math.max(H * 0.55, blockCenterY - totalTextH / 2 + lineHeight / 2);

    // ── 황금 장식선 (위) ──
    const decoY = startY - lineHeight * 1.1;
    const goldGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
    goldGrad.addColorStop(0, "rgba(212,175,100,0)");
    goldGrad.addColorStop(0.5, "rgba(212,175,100,0.85)");
    goldGrad.addColorStop(1, "rgba(212,175,100,0)");
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(W * 0.2, decoY); ctx.lineTo(W * 0.8, decoY); ctx.stroke();

    // 작은 다이아몬드 장식
    ctx.fillStyle = "rgba(212,175,100,0.75)";
    ctx.beginPath();
    ctx.moveTo(W / 2, decoY - 8);
    ctx.lineTo(W / 2 + 6, decoY);
    ctx.lineTo(W / 2, decoY + 8);
    ctx.lineTo(W / 2 - 6, decoY);
    ctx.closePath();
    ctx.fill();

    // ── 텍스트 렌더링 ──
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${fontSize}px ${fontFamily}`;

    for (let i = 0; i < allLines.length; i++) {
      const y = startY + i * lineHeight;
      const line = allLines[i];
      if (!line.trim()) continue;

      // 텍스트 그림자 (깊이감)
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 5;
      ctx.shadowOffsetX = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(line, W / 2, y);

      // 미세 골드 광택 레이어
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = "rgba(255,245,200,0.10)";
      ctx.fillText(line, W / 2, y - 1);
    }

    // ── 황금 장식선 (아래) ──
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const decoY2 = startY + totalTextH + lineHeight * 0.25;
    const goldGrad2 = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
    goldGrad2.addColorStop(0, "rgba(212,175,100,0)");
    goldGrad2.addColorStop(0.5, "rgba(212,175,100,0.6)");
    goldGrad2.addColorStop(1, "rgba(212,175,100,0)");
    ctx.strokeStyle = goldGrad2;
    ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(W * 0.25, decoY2); ctx.lineTo(W * 0.75, decoY2); ctx.stroke();

    // ── 하단 브랜딩 (선택) ──
    ctx.font = `normal ${24}px ${fontFamily}`;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.letterSpacing = "3px";
    ctx.fillText("✦  HOPE  ✦", W / 2, H - 60);

    return `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", { quality: 0.94 }).toString("base64")}`;
  } catch (err) {
    console.error("[canvas] addQuoteOverlayToBase64 실패:", err);
    return imageBase64;
  }
}

// ── 썸네일 유틸 ───────────────────────────────────────────────────────────────

export async function createSmallThumbnail(imageBase64: string, size = 200): Promise<string> {
  try {
    const { createCanvas, loadImage } = await import("canvas");
    const image = await loadImage(base64ToBuffer(imageBase64));
    const side = Math.min(image.width, image.height);
    const sx = (image.width - side) / 2;
    const sy = (image.height - side) / 2;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
    return `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", { quality: 0.72 }).toString("base64")}`;
  } catch {
    return "";
  }
}

export async function createSlideThumbnail(imageBase64: string): Promise<string> {
  return createSmallThumbnail(imageBase64, 400);
}

// 파일 기반 오버레이 (scripture-blog.ts에서 호출)
export async function addVerseOverlayPublic(
  imagePath: string,
  verseReference: string,
  verseContent: string
): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const buf = await fs.readFile(imagePath);
    const base64 = `data:image/png;base64,${buf.toString("base64")}`;
    const result = await addVerseOverlayToBase64(base64, verseReference, verseContent);
    const resultBuf = Buffer.from(result.split(",")[1], "base64");
    await fs.writeFile(imagePath, resultBuf);
  } catch (err) {
    console.error("[scripture-canvas] file overlay 실패:", err);
  }
}
