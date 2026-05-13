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
