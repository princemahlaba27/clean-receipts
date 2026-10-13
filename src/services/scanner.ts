import DocumentScanner from 'react-native-document-scanner-plugin';

export async function scanDocument(): Promise<string[]> {
  const result = await DocumentScanner.scanDocument({
    croppedImageQuality: 90,
    maxNumDocuments: 8,
  });
  return result.scannedImages ?? [];
}
