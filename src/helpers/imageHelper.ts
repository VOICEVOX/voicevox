function detectImageTypeFromBase64(data: string): string {
  switch (data[0]) {
    case "/":
      return "image/svg+xml";
    case "R":
      return "image/gif";
    case "i":
      return "image/png";
    case "D":
      return "image/jpeg";
    default:
      return "";
  }
}

const base64ImageCache = new Map<string, string>();

export function base64ImageToUri(image: string): string {
  if (base64ImageCache.has(image)) {
    return base64ImageCache.get(image) as string;
  }
  const mimeType = detectImageTypeFromBase64(image);
  const buffer = Buffer.from(image, "base64");
  const url = URL.createObjectURL(
    new Blob([buffer.buffer], {
      type: mimeType,
    })
  );
  base64ImageCache.set(image, url);
  return url;
}
