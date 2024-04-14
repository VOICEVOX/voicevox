function detectImageTypeFromBase64(data: string): string {
  switch (data[0]) {
    case "/":
      return "image/jpeg";
    case "R":
      return "image/gif";
    case "i":
      return "image/png";
    case "U":
      return "image/webp";
    default:
      throw new Error("Unsupported image type");
  }
}

export function base64ImageToUri(image: string): string {
  const mimeType = detectImageTypeFromBase64(image);
  const buffer = Buffer.from(image, "base64");
  return URL.createObjectURL(
    new Blob([buffer.buffer], {
      type: mimeType,
    })
  );
}
