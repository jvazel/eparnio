interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  eccCodewords: number;
  alignmentCenters: readonly number[];
}

const QR_VERSIONS_L: readonly QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, eccCodewords: 7, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, eccCodewords: 10, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, eccCodewords: 15, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20, alignmentCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, eccCodewords: 26, alignmentCenters: [6, 30] }
] as const;

// Format string Level L + Mask 0 : 0b111011111000100 (MSB -> LSB)
const FORMAT_BITS_L_MASK_0 = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0] as const;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildReedSolomonGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMultiply(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeEccBytes(data: Uint8Array, eccCount: number): Uint8Array {
  const generator = buildReedSolomonGenerator(eccCount);
  const buffer = new Uint8Array(data.length + eccCount);
  buffer.set(data, 0);

  for (let i = 0; i < data.length; i += 1) {
    const factor = buffer[i];
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      buffer[i + j] ^= gfMultiply(generator[j], factor);
    }
  }

  return buffer.slice(data.length);
}

function selectVersionForBytes(byteLength: number): QrVersionSpec {
  for (const spec of QR_VERSIONS_L) {
    // 4 bits mode + 8 bits length + payload + 4 bits terminateur
    const maxBytes = Math.floor((spec.dataCodewords * 8 - 12) / 8);
    if (byteLength <= maxBytes) {
      return spec;
    }
  }
  return QR_VERSIONS_L[QR_VERSIONS_L.length - 1];
}

function encodeByteCodewords(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const maxBytes = Math.floor((spec.dataCodewords * 8 - 12) / 8);
  const clipped = bytes.slice(0, maxBytes);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Mode octet
  pushBits(clipped.length, 8);
  for (const byte of clipped) {
    pushBits(byte, 8);
  }

  const maxBits = spec.dataCodewords * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminatorLen; i += 1) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(spec.dataCodewords);
  const byteCount = Math.floor(bits.length / 8);
  for (let i = 0; i < byteCount; i += 1) {
    let val = 0;
    for (let b = 0; b < 8; b += 1) {
      val = (val << 1) | bits[i * 8 + b];
    }
    codewords[i] = val;
  }

  const pads = [0xec, 0x11];
  for (let i = byteCount; i < spec.dataCodewords; i += 1) {
    codewords[i] = pads[(i - byteCount) % 2];
  }

  return codewords;
}

/**
 * Génère la matrice booléenne d'un QR Code ISO 18004 (niveau L, masque 0) côté client, sans dépendance externe.
 */
export function buildQrMatrix(content: string): boolean[][] {
  const inputBytes = new TextEncoder().encode(content || 'eparnio');
  const spec = selectVersionForBytes(inputBytes.length);
  const size = spec.size;

  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onOuterBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInnerSquare = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFunctionModule(rr, cc, inBox && (onOuterBorder || inInnerSquare));
      }
    }
  };

  const drawAlignment = (centerR: number, centerC: number) => {
    if (reserved[centerR]?.[centerC]) return;
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        const dark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        setFunctionModule(centerR + r, centerC + c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  if (spec.alignmentCenters.length > 0) {
    for (const r of spec.alignmentCenters) {
      for (const c of spec.alignmentCenters) {
        drawAlignment(r, c);
      }
    }
  }

  // Réserve des zones d'information de format + dark module
  for (let i = 0; i <= 8; i += 1) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = size - 8; i < size; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  setFunctionModule(4 * spec.version + 9, 8, true);

  // Remplissage des données + Reed-Solomon
  const data = encodeByteCodewords(inputBytes, spec);
  const ecc = computeEccBytes(data, spec.eccCodewords);
  const allBytes = new Uint8Array(data.length + ecc.length);
  allBytes.set(data, 0);
  allBytes.set(ecc, data.length);

  let bitIndex = 0;
  const totalBits = allBytes.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const c = rightCol - offset;
        if (reserved[r][c]) continue;
        let bit = false;
        if (bitIndex < totalBits) {
          const byteVal = allBytes[bitIndex >> 3];
          bit = ((byteVal >> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
        // Masque 0 : (r + c) % 2 === 0
        modules[r][c] = (r + c) % 2 === 0 ? !bit : bit;
      }
    }
    upward = !upward;
  }

  // Écriture des bits de format autour des finders
  const fmt = FORMAT_BITS_L_MASK_0;
  const coordsTopLeft = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8]
  ] as const;

  for (let i = 0; i < 15; i += 1) {
    const dark = fmt[i] === 1;
    const [r1, c1] = coordsTopLeft[i];
    modules[r1][c1] = dark;

    if (i < 7) {
      modules[size - 1 - i][8] = dark;
    } else {
      modules[8][size - 15 + i] = dark;
    }
  }

  return modules;
}
