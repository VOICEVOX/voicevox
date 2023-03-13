export function bytesToSize(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = parseInt(String(Math.floor(Math.log(bytes) / Math.log(1024))));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}
