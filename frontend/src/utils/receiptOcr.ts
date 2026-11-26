import { parseReceiptText, type ParsedReceipt } from './parseReceiptText';
import { preprocessReceiptImage } from './preprocessReceiptImage';

const OCR_TIMEOUT_MS = 20_000;

export interface ScanReceiptOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Exécute l'OCR 100 % local sur un fichier image via tesseract.js (chargé en lazy-load).
 * Aucun envoi réseau de l'image : tout reste dans le navigateur.
 */
export async function scanReceiptFile(
  file: File | Blob,
  options: ScanReceiptOptions = {}
): Promise<ParsedReceipt> {
  const { onProgress, signal } = options;

  if (signal?.aborted) {
    throw new DOMException('Analyse annulée.', 'AbortError');
  }

  onProgress?.(5);
  const processedBlob = await preprocessReceiptImage(file);

  if (signal?.aborted) {
    throw new DOMException('Analyse annulée.', 'AbortError');
  }

  onProgress?.(15);

  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker('fra', 1, {
    logger: (message: { status?: string; progress?: number }) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        const mapped = Math.min(98, Math.max(20, Math.round(20 + message.progress * 78)));
        onProgress?.(mapped);
      }
    }
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let aborted = false;

  const handleAbort = () => {
    aborted = true;
    void worker.terminate();
  };

  signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    const recognitionPromise = worker.recognize(processedBlob);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        void worker.terminate();
        reject(new Error("L'analyse du ticket a pris trop de temps. Réessayez avec une photo plus nette."));
      }, OCR_TIMEOUT_MS);
    });

    const result = await Promise.race([recognitionPromise, timeoutPromise]);

    if (aborted || signal?.aborted) {
      throw new DOMException('Analyse annulée.', 'AbortError');
    }

    onProgress?.(100);
    const rawText = result?.data?.text ?? '';
    return parseReceiptText(rawText);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener('abort', handleAbort);
    try {
      await worker.terminate();
    } catch {
      // Worker déjà terminé
    }
  }
}
