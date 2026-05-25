/**
 * scripture-canvas.ts — Canvas 텍스트 오버레이 공유 유틸 (메모리 처리, 파일시스템 불필요)
 */
import * as path from "path";

let fontsRegistered = false;

async function ensureFonts() {
  if (fontsRegistered) return;
  try {
    const { registerFont } = await import("canvas");
    const fontDir = path.join(process.cwd(), "server", "fonts");
    registerFont(path.join(fontDir, "NotoSansKR-Bold.ttf"), { family: "NotoSansKR", weight: "bold" });
    registerFont(path.join(fontDir, "NotoSansKR-Regular.ttf"), { family: "NotoSansKR", weight: "normal" });
    fontsRegistered = true;
  } catch {}
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

// base64 이미지에 말씀 텍스트 오버레이 → base64 반환 (파일 I/O 없음)
export async function addVerseOverlayToBase64(
  imageBase64: string,
  verseReference: string,
  verseContent: string
): Promise<string> {
  try {
    await ensureFonts();
    const { createCanvas, loadImage } = await import("canvas");

    const image = await loadImage(base64ToBuffer(imageBase64));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const padding = 60;
    const maxWidth = image.width - padding * 2;
    const centerX = image.width / 2;
    const centerY = image.height / 2;

    let contentFontSize = 36;
    let refFontSize = 30;
    let lines: string[] = [];
    let lineHeight = contentFontSize * 1.4;

    for (let sz = 36; sz >= 22; sz -= 2) {
      contentFontSize = sz;
      refFontSize = Math.max(sz - 6, 20);
      lineHeight = sz * 1.4;
      ctx.font = `bold ${contentFontSize}px "NotoSansKR"`;
      lines = wrapText(ctx, verseContent, maxWidth, 12);
      if (lines.length * lineHeight + refFontSize + 60 <= image.height * 0.7 && lines.length <= 8) break;
    }

    if (lines.length > 8) { lines = lines.slice(0, 8); lines[7] = lines[7].slice(0, -3) + "..."; }

    const totalTextHeight = lines.length * lineHeight + refFontSize + 50;
    const textStartY = centerY - totalTextHeight / 2 + lineHeight / 2;
    const boxPadding = 35;
    const boxY = textStartY - lineHeight / 2 - boxPadding;
    const boxHeight = totalTextHeight + boxPadding * 2;
    const radius = 20;
    const boxX = padding - boxPadding;
    const boxWidth = image.width - (padding - boxPadding) * 2;

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxWidth - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
    ctx.lineTo(boxX + radius, boxY + boxHeight);
    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${contentFontSize}px "NotoSansKR"`;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    lines.forEach((line, i) => ctx.fillText(line, centerX, textStartY + i * lineHeight));

    ctx.font = `${refFontSize}px "NotoSansKR"`;
    ctx.fillStyle = "#e0e0e0";
    ctx.fillText(`- ${verseReference} -`, centerX, textStartY + lines.length * lineHeight + 35);

    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.font = `16px "NotoSansKR"`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("AI 생성 이미지", image.width - 20, image.height - 15);

    return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
  } catch (err) {
    console.error("[scripture-canvas] overlay 실패:", err);
    return imageBase64;
  }
}

// 200×200 JPEG 썸네일 생성 (~8KB) — DB 저장용
export async function createSmallThumbnail(imageBase64: string, size = 200): Promise<string> {
  try {
    const { createCanvas, loadImage } = await import("canvas");
    const image = await loadImage(base64ToBuffer(imageBase64));

    // 정사각형 크롭
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

// 슬라이드 텍스트 → 파스텔 테마 선택
function getSlideTheme(slideText: string, index: number) {
  const t = slideText.toLowerCase();
  const themes = [
    // 0 Rose — 사랑/은혜
    { wash: [255, 192, 203] as [number,number,number], panelBg: "rgba(255,240,244,0.88)", textColor: "#5C001A", accentColor: "#D63B5C", num: "#C41E3A" },
    // 1 Golden — 기도/찬양/감사
    { wash: [255, 220, 150] as [number,number,number], panelBg: "rgba(255,251,235,0.88)", textColor: "#4A2800", accentColor: "#B8860B", num: "#D4860A" },
    // 2 Sky — 믿음/말씀/소망
    { wash: [173, 216, 230] as [number,number,number], panelBg: "rgba(235,247,255,0.88)", textColor: "#0A1E40", accentColor: "#1565C0", num: "#1976D2" },
    // 3 Lavender — 소망/비전/새로운
    { wash: [210, 180, 235] as [number,number,number], panelBg: "rgba(248,242,255,0.88)", textColor: "#2D0050", accentColor: "#7B1FA2", num: "#8E24AA" },
    // 4 Mint — 평화/공동체/함께
    { wash: [152, 225, 195] as [number,number,number], panelBg: "rgba(235,255,248,0.88)", textColor: "#00271A", accentColor: "#00796B", num: "#00897B" },
  ];

  if (t.match(/사랑|love|섬기|봉사|은혜|grace|선행/)) return themes[0];
  if (t.match(/기도|pray|간구|찬양|praise|감사|경배/)) return themes[1];
  if (t.match(/믿음|faith|신뢰|말씀|word|성경|scripture/)) return themes[2];
  if (t.match(/소망|hope|비전|vision|새로운|미래|기대/)) return themes[3];
  if (t.match(/평화|peace|평안|공동체|함께|연합|교회/)) return themes[4];
  return themes[index % themes.length];
}

// 인스타그램 슬라이드 이미지 생성
// - 배경: 슬라이드마다 다른 크롭 위치 + 파스텔 컬러 워시
// - 하단: 반투명 패널 + 진한 텍스트 (가독성 최우선)
export async function createInstagramSlides(
  imageBase64: string | string[],
  slides: string[],
  verseReference: string
): Promise<string[]> {
  if (!slides.length) return [];

  const backgrounds = Array.isArray(imageBase64) ? imageBase64 : Array(slides.length).fill(imageBase64);

  try {
    await ensureFonts();
    const { createCanvas, loadImage } = await import("canvas");
    const SIZE = 1080;

    const firstBg = await loadImage(base64ToBuffer(backgrounds[0]));

    // 슬라이드별 크롭 오프셋 (같은 이미지라도 다른 구도처럼 보이게)
    const cropOffsets = [
      { ox: 0.00, oy: 0.00 }, // 좌상단
      { ox: 0.10, oy: 0.05 }, // 약간 오른쪽
      { ox: 0.20, oy: 0.00 }, // 우상단
      { ox: 0.00, oy: 0.15 }, // 좌하단
      { ox: 0.10, oy: 0.12 }, // 중앙
    ];

    const results: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const theme = getSlideTheme(slides[i], i);
      const offset = cropOffsets[i % cropOffsets.length];
      const [wr, wg, wb] = theme.wash;

      const canvas = createCanvas(SIZE, SIZE);
      const ctx = canvas.getContext("2d") as any;

      // 배경 이미지 로드
      let bg = firstBg;
      const bgSrc = backgrounds[i];
      if (bgSrc && bgSrc !== backgrounds[0]) {
        try { bg = await loadImage(base64ToBuffer(bgSrc)); } catch {}
      }

      // 배경 이미지: 1.25배 확대 후 오프셋으로 다르게 크롭
      const scale = 1.25;
      const scaledW = bg.width * scale;
      const scaledH = bg.height * scale;
      const side = Math.min(scaledW, scaledH);
      const srcSide = side / scale;
      const maxOffX = (bg.width - srcSide) * offset.ox;
      const maxOffY = (bg.height - srcSide) * offset.oy;
      ctx.drawImage(bg, maxOffX, maxOffY, srcSide, srcSide, 0, 0, SIZE, SIZE);

      // ① 파스텔 컬러 워시 (이미지 전체를 밝고 부드럽게)
      ctx.fillStyle = `rgba(${wr},${wg},${wb},0.52)`;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // ② 상단 흰색 페이드 (이미지 상단 더 밝게)
      const topFade = ctx.createLinearGradient(0, 0, 0, SIZE * 0.45);
      topFade.addColorStop(0, "rgba(255,255,255,0.45)");
      topFade.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = topFade;
      ctx.fillRect(0, 0, SIZE, SIZE * 0.45);

      // ③ 장식 원 (테마 컬러, 반투명)
      const circlePositions = [
        [SIZE * 0.82, SIZE * 0.12, SIZE * 0.18],
        [SIZE * 0.12, SIZE * 0.22, SIZE * 0.12],
        [SIZE * 0.72, SIZE * 0.08, SIZE * 0.10],
      ] as [number, number, number][];
      for (const [cx, cy, cr] of circlePositions) {
        const circGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        circGrad.addColorStop(0, `rgba(${wr},${wg},${wb},0.35)`);
        circGrad.addColorStop(1, `rgba(${wr},${wg},${wb},0)`);
        ctx.fillStyle = circGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }

      // ④ 하단 반투명 패널 (텍스트 배경)
      const panelY = SIZE * 0.50;
      const panelGrad = ctx.createLinearGradient(0, panelY, 0, SIZE);
      panelGrad.addColorStop(0, "rgba(255,255,255,0)");
      panelGrad.addColorStop(0.25, theme.panelBg);
      panelGrad.addColorStop(1, theme.panelBg);
      ctx.fillStyle = panelGrad;
      ctx.fillRect(0, panelY, SIZE, SIZE - panelY);

      // ⑤ 슬라이드 번호 배지 (상단 좌측)
      const badgeR = 36;
      ctx.beginPath();
      ctx.arc(56, 56, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = theme.num;
      ctx.fill();
      ctx.font = `bold 24px "NotoSansKR"`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, 56, 57);

      // 슬라이드 총 수 (배지 옆)
      ctx.font = `18px "NotoSansKR"`;
      ctx.fillStyle = `rgba(${wr > 200 ? 80 : 200},${wg > 200 ? 80 : 200},${wb > 200 ? 80 : 200},0.85)`;
      ctx.textAlign = "left";
      ctx.fillText(`/ ${slides.length}`, 100, 57);

      // ⑥ 메인 텍스트 (패널 위, 진한 컬러)
      const maxTxtW = SIZE - 100;
      ctx.font = `bold 76px "NotoSansKR"`;
      ctx.fillStyle = theme.textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 10;

      const lines = wrapText(ctx, slides[i], maxTxtW, 4);
      const lh = 94;
      const totalTxtH = lines.length * lh;
      const txtStartY = SIZE * 0.56;
      lines.forEach((line, j) => {
        ctx.fillText(line, SIZE / 2, txtStartY + j * lh);
      });

      // ⑦ 액센트 구분선
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      const lineY = txtStartY + totalTxtH + 22;
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(SIZE / 2 - 70, lineY);
      ctx.lineTo(SIZE / 2 + 70, lineY);
      ctx.stroke();

      // ⑧ 말씀 구절 (하단)
      ctx.font = `26px "NotoSansKR"`;
      ctx.fillStyle = theme.accentColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`— ${verseReference} —`, SIZE / 2, SIZE - 42);

      results.push(`data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", { quality: 0.94 }).toString("base64")}`);
    }

    return results;
  } catch (err) {
    console.error("[scripture-canvas] slide 생성 실패:", err);
    return [];
  }
}

// 슬라이드용 썸네일 (400×400 JPEG ~20KB) — DB 저장용
export async function createSlideThumbnail(imageBase64: string): Promise<string> {
  return createSmallThumbnail(imageBase64, 400);
}

// 파일 기반 오버레이 (하위 호환 — 기존 scripture-blog.ts에서 호출)
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
