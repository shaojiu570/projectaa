export function getSize(num: number): string {
  return num >= 25 ? '大' : '小';
}

export function getTailNumber(num: number): number {
  return num % 10;
}

export function getComposite(num: number): number {
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return tens + ones;
}
