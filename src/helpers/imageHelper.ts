export function detectImageTypeFromBase64(data: string): string {
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

export function base64ImageToUri(image: string): string {
  const mimeType = detectImageTypeFromBase64(image);
  const rawBytes = atob(image);
  const buffer = new Uint8Array(rawBytes.length); //②
  buffer.forEach((_, i) => {
    buffer[i] = rawBytes.charCodeAt(i);
  });
  return URL.createObjectURL(
    new Blob([buffer.buffer], {
      type: mimeType,
    })
  );
}
