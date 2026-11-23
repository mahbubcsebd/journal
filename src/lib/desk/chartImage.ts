"use client";

/**
 * Composite Lightweight Charts' transparent canvas onto the app background.
 * Optionally scales large canvases down so SQLite-attached trade snapshots stay compact.
 */
export function compositeChartCanvas(source: HTMLCanvasElement, maxWidth?: number): HTMLCanvasElement {
  const scale = maxWidth && source.width > maxWidth ? maxWidth / source.width : 1;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(source.width * scale));
  out.height = Math.max(1, Math.round(source.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.fillStyle = "#0f1c24";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

export function captureChartBlob(source: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    compositeChartCanvas(source).toBlob(resolve, "image/png");
  });
}

/** Return a compact image data URL (WebP with JPEG fallback) safe for journal storage. */
export function captureChartDataUrl(source: HTMLCanvasElement): string | null {
  const canvas = compositeChartCanvas(source, 960);
  const webp = canvas.toDataURL("image/webp", 0.8);
  if (webp.startsWith("data:image/webp")) return webp;
  const jpeg = canvas.toDataURL("image/jpeg", 0.82);
  return jpeg.startsWith("data:image/jpeg") ? jpeg : null;
}

