import DocumentScanner, { ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';

/** `null` means the camera was cancelled. An empty list means the scan had no page. */
export async function scanDocument(): Promise<string[] | null> {
  const result = await DocumentScanner.scanDocument({
    croppedImageQuality: 90,
    maxNumDocuments: 8,
  });
  if (result.status === ScanDocumentResponseStatus.Cancel) return null;
  return result.scannedImages ?? [];
}
