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

const base64ToUint8Array = (data: string) => {
  const binaryString = atob(data);
  const buffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }
  return buffer;
};

export const base64ToUri = (data: string, type: string) => {
  const buffer = base64ToUint8Array(data);
  return URL.createObjectURL(new Blob([buffer.buffer], { type }));
};

export function base64ImageToUri(image: string): string {
  const mimeType = detectImageTypeFromBase64(image);
  return base64ToUri(image, mimeType);
}
