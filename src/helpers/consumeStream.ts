/**
 * ReadableStreamを受け取り、中身をすべて消費する。
 */
export function consumeStream(
  stream: ReadableStream<Uint8Array>,
  pipeOptions: StreamPipeOptions = {},
): Promise<void> {
  const pipe = new WritableStream<Uint8Array>({
    write() {},
    close() {},
  });

  return stream.pipeTo(pipe, pipeOptions);
}
