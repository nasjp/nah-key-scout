// Helpers to derive local cached image path for house thumbnails

export function safeHouseId(id: string): string {
  return id.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
}

export function extFromUrl(url: string | undefined): string {
  if (!url) return ".jpg";
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".jpeg")) return ".jpg";
    if (pathname.endsWith(".jpg")) return ".jpg";
    if (pathname.endsWith(".png")) return ".png";
    if (pathname.endsWith(".webp")) return ".webp";
    if (pathname.endsWith(".gif")) return ".gif";
    if (pathname.endsWith(".avif")) return ".avif";
    return ".jpg";
  } catch {
    return ".jpg";
  }
}

export function localHouseImagePath(
  houseId: string | undefined,
  imgUrl: string | undefined,
): string | undefined {
  if (!houseId) return undefined;
  const base = safeHouseId(houseId);
  const ext = extFromUrl(imgUrl);
  return `/house-images/${base}${ext}`;
}
