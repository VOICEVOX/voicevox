import { toBytes } from "fast-base64";
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

export const base64ToUri = async (data: string, type: string) => {
  const buffer = await toBytes(data);
  return URL.createObjectURL(new Blob([buffer.buffer], { type }));
};

export async function base64ImageToUri(image: string): Promise<string> {
  const mimeType = detectImageTypeFromBase64(image);
  return await base64ToUri(image, mimeType);
}
