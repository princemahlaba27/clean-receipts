import { Directory, File, Paths } from 'expo-file-system';

const receiptFolder = new Directory(Paths.document, 'receipts');

function ensureReceiptFolder(): Directory {
  if (!receiptFolder.exists) {
    receiptFolder.create({ intermediates: true, idempotent: true });
  }
  return receiptFolder;
}

export async function persistImage(sourceUri: string, fileName: string): Promise<string> {
  const folder = ensureReceiptFolder();
  const destination = new File(folder, fileName);
  if (destination.exists) destination.delete();
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

export function writeCacheText(fileName: string, contents: string): string {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.write(contents);
  return file.uri;
}
