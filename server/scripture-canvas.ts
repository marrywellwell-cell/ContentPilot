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

// 인스타그램 슬라이드 이미지 생성 (슬라이드별 다른 그라디언트 + 텍스트 오버레이)
// imageBase64: 단일 배경 or 슬라이드별 배경 배열
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
    const image = await loadImage(base64ToBuffer(backgrounds[0]));
    const SIZE = 1080;

    // 슬라이드별 그라디언트 색상 (RGBA)
    const overlays = [
      { top: "rgba(88,28,135,0.72)", bottom: "rgba(49,46,129,0.85)" },   // purple-indigo
      { top: "rgba(30,27,75,0.70)", bottom: "rgba(67,20,129,0.82)" },    // deep indigo
      { top: "rgba(14,30,97,0.72)", bottom: "rgba(12,74,110,0.85)" },    // blue-navy
      { top: "rgba(6,78,59,0.72)", bottom: "rgba(20,83,45,0.85)" },      // teal-green
      { top: "rgba(120,53,15,0.72)", bottom: "rgba(154,52,18,0.85)" },   // amber-orange
    ];

    const results: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const canvas = createCanvas(SIZE, SIZE);
      const ctx = canvas.getContext("2d") as any;

      // 슬라이드별 배경 이미지 (다른 배경이 있으면 사용, 없으면 첫 번째 배경)
      const bgBase64 = backgrounds[i] || backgrounds[0];
      const bg = bgBase64 !== backgrounds[0]
        ? await loadImage(base64ToBuffer(bgBase64)).catch(() => image)
        : image;

      // 배경 이미지 (정사각형 크롭)
      const side = Math.min(bg.width, bg.height);
      const sx = (bg.width - side) / 2;
      const sy = (bg.height - side) / 2;
      ctx.drawImage(bg, sx, sy, side, side, 0, 0, SIZE, SIZE);

      // 그라디언트 오버레이
      const overlay = overlays[i % overlays.length];
      const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
      grad.addColorStop(0, overlay.top);
      grad.addColorStop(1, overlay.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // 슬라이드 번호 (상단 우측)
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = `bold 28px "NotoSansKR"`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(`${i + 1} / ${slides.length}`, SIZE - 40, 40);

      // 장식선 (상단, 하단)
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(60, 110); ctx.lineTo(SIZE - 60, 110); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(60, SIZE - 110); ctx.lineTo(SIZE - 60, SIZE - 110); ctx.stroke();

      // 메인 슬라이드 텍스트 (중앙)
      const maxWidth = SIZE - 120;
      ctx.font = `bold 68px "NotoSansKR"`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      const lines = wrapText(ctx, slides[i], maxWidth, 6);
      const lineHeight = 84;
      const totalH = lines.length * lineHeight;
      const startY = SIZE / 2 - totalH / 2 + lineHeight / 2;
      lines.forEach((line, j) => {
        ctx.fillText(line, SIZE / 2, startY + j * lineHeight);
      });

      // 말씀 구절 (하단)
      ctx.shadowBlur = 6;
      ctx.font = `32px "NotoSansKR"`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`— ${verseReference} —`, SIZE / 2, SIZE - 60);

      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;

      results.push(`data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`);
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
