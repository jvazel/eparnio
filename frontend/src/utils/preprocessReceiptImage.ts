const MAX_RECEIPT_WIDTH = 1400;

/**
 * Charge une image locale, la redimensionne (<= 1400px), la convertit en niveaux de gris
 * et renforce le contraste sur un canvas hors-écran pour améliorer la lecture OCR
 * des tickets de caisse thermiques.
 */
export async function preprocessReceiptImage(file: Blob): Promise<Blob> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;

    if (!naturalWidth || !naturalHeight) {
      return file;
    }

    const scale = naturalWidth > MAX_RECEIPT_WIDTH ? MAX_RECEIPT_WIDTH / naturalWidth : 1;
    const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;

    let minLum = 255;
    let maxLum = 0;
    const luminances = new Uint8Array(data.length / 4);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      luminances[p] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    const range = Math.max(1, maxLum - minLum);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      // Étirement d'histogramme + contraste doux
      const stretched = ((luminances[p] - minLum) / range) * 255;
      const contrasted = Math.max(0, Math.min(255, Math.round((stretched - 128) * 1.25 + 128)));
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }

    ctx.putImageData(imageData, 0, 0);

    const processedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });

    // Libération explicite du buffer canvas
    canvas.width = 0;
    canvas.height = 0;

    return processedBlob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image du ticket."));
    img.src = src;
  });
}
