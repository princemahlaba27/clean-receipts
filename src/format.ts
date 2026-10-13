export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatPlainMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatIsoDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthTitle(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-/);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function quarterOf(iso: string): 1 | 2 | 3 | 4 {
  const month = Number(iso.slice(5, 7));
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

export function currentQuarter(): 1 | 2 | 3 | 4 {
  return quarterOf(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}
