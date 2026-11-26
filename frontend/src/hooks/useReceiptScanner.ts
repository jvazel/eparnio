import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParsedReceipt } from '../utils/parseReceiptText';
import { scanReceiptFile } from '../utils/receiptOcr';

export interface UseReceiptScannerReturn {
  scanFile: (file: File) => Promise<ParsedReceipt | null>;
  cancelScan: () => void;
  reset: () => void;
  isScanning: boolean;
  progress: number;
  error: string | null;
  lastResult: ParsedReceipt | null;
}

export function useReceiptScanner(): UseReceiptScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ParsedReceipt | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelScan = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsScanning(false);
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsScanning(false);
    setProgress(0);
    setError(null);
    setLastResult(null);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const scanFile = useCallback(async (file: File): Promise<ParsedReceipt | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image (photo de ticket de caisse).');
      return null;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsScanning(true);
    setProgress(5);
    setError(null);

    try {
      const parsed = await scanReceiptFile(file, {
        signal: controller.signal,
        onProgress: (pct) => setProgress(pct)
      });

      if (controller.signal.aborted) {
        return null;
      }

      setLastResult(parsed);

      if (parsed.amount === null && !parsed.merchant && !parsed.date) {
        setError(
          'Impossible de lire le ticket. Essayez avec une photo plus nette et bien éclairée.'
        );
      }

      return parsed;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la lecture du ticket. Vérifiez la photo et réessayez.';
      setError(message);
      return null;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  return {
    scanFile,
    cancelScan,
    reset,
    isScanning,
    progress,
    error,
    lastResult
  };
}
