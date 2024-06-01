/** FileをUTF-8のテキストファイルとして読み込む */
export const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (event) => {
      reject(event);
    };
    reader.readAsText(file, "UTF-8");
  });
};
