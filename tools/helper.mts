/**
 * 何度かリトライするfetch。
 * 成功した場合はそのままResponseを返す。
 * リトライ回数を超えた場合は最後のResponseを返す。
 */
export async function retryFetch(
  url: string | URL,
  options?: RequestInit,
  retries: number = 3,
) {
  for (let i = 0; i < retries - 1; i++) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    console.error(`Fetch failed: ${response.statusText}`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 少し待つ
  }
  return fetch(url, options);
}
