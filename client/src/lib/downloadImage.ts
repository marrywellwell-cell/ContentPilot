// 티스토리용 HTML — base64 이미지 제거 (티스토리 에디터 호환)
export function stripBase64Images(html: string): string {
  return html
    .replace(/<img[^>]*src="data:[^"]*"[^>]*>/gi, "")
    .replace(/<img[^>]*src='data:[^']*'[^>]*/gi, "")
    .trim();
}

export async function downloadImageViaServer(
  imageData: string,
  filename: string,
  mimeType = "image/png"
): Promise<void> {
  const res = await fetch("/api/image-download/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: imageData, mimeType, filename }),
  });

  if (!res.ok) throw new Error("Failed to create download token");
  const { token } = await res.json();
  window.open(`/api/image-download/${token}`, "_blank");
}
