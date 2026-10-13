import TextRecognition from '@react-native-ml-kit/text-recognition';

type Frame = { left?: number; top?: number; width?: number; height?: number };
type OcrLine = { text?: string; frame?: Frame };
type OcrBlock = { lines?: OcrLine[] };
type OcrResult = { blocks?: OcrBlock[] };

type Token = {
  text: string;
  midY: number;
  minX: number;
  minY: number;
  maxY: number;
  height: number;
};

export async function recognizeLines(imageUri: string): Promise<string[]> {
  const result = (await TextRecognition.recognize(imageUri)) as OcrResult;
  const tokens: Token[] = [];
  let fallbackOrder = 0;
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const text = line.text?.trim();
      if (!text) continue;
      const frame = line.frame;
      const height = frame?.height ?? 0;
      const top = frame?.top ?? fallbackOrder;
      if (!frame || height <= 0) {
        tokens.push({ text, midY: fallbackOrder, minX: 0, minY: fallbackOrder, maxY: fallbackOrder + 1, height: 1 });
        fallbackOrder += 1;
        continue;
      }
      tokens.push({
        text,
        midY: top + height / 2,
        minX: frame.left ?? 0,
        minY: top,
        maxY: top + height,
        height,
      });
    }
  }
  if (!tokens.length) return [];
  if (tokens.every((token) => token.height === 1 && token.minX === 0)) {
    return tokens.map((token) => token.text);
  }
  return clusterRows(tokens);
}

function clusterRows(tokens: Token[]): string[] {
  const sorted = [...tokens].sort((left, right) => left.midY - right.midY || left.minX - right.minX);
  const rows: Token[][] = [];
  for (const token of sorted) {
    const current = rows[rows.length - 1];
    if (current && sameRow(token, current)) current.push(token);
    else rows.push([token]);
  }
  return rows.map((row) =>
    [...row].sort((left, right) => left.minX - right.minX).map((token) => token.text).join(' '),
  );
}

function sameRow(token: Token, row: Token[]): boolean {
  const rowTop = Math.min(...row.map((item) => item.minY));
  const rowBottom = Math.max(...row.map((item) => item.maxY));
  const overlap = Math.min(rowBottom, token.maxY) - Math.max(rowTop, token.minY);
  if (overlap > 0) return true;
  const mids = row.map((item) => item.midY).sort((a, b) => a - b);
  const heights = row.map((item) => item.height).sort((a, b) => a - b);
  const medianMid = mids[Math.floor(mids.length / 2)] ?? token.midY;
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? token.height;
  return Math.abs(token.midY - medianMid) <= Math.max(medianHeight, token.height) / 2;
}
