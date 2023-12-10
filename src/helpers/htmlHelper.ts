/**
 * 文字列をHTMLエスケープする
 *
 * @param string
 * @returns
 */
export const escapeHtml = (string: string): string => {
  return string.replace(/[&'`"<>]/g, function (match: string) {
    return (
      {
        "&": "&amp;",
        "'": "&#x27;",
        "`": "&#x60;",
        '"': "&quot;",
        "<": "&lt;",
        ">": "&gt;",
      }[match] ?? match
    );
  });
};
