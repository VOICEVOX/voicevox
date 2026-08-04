export function linearToDecibel(linearValue: number) {
  if (linearValue === 0) {
    return -1000;
  }
  return 20 * Math.log10(linearValue);
}

export function decibelToLinear(decibelValue: number) {
  if (decibelValue <= -1000) {
    return 0;
  }
  return Math.pow(10, decibelValue / 20);
}
