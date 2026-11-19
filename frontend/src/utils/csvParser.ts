import type { EnvelopeItem as Envelope, TransactionItem as Transaction } from '../types/budget.types';

export interface ParsedBankOperation {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  amount: number; // positive debit amount
  suggestedEnvelopeId: string | null;
  dedupKey: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildClientDedupKey(dateIso: string, amount: number, label: string): string {
  const day = dateIso.slice(0, 10);
  return `${day}|${amount.toFixed(2)}|${normalizeText(label)}`;
}

function parseFrenchOrIsoDate(raw: string): string | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) {
    return null;
  }

  // YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const frMatch = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(trimmed);
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
  }

  // OFX YYYYMMDD...
  const ofxMatch = /^(\d{4})(\d{2})(\d{2})/.exec(trimmed);
  if (ofxMatch) {
    return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  }

  return null;
}

function parseFrenchAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(',', '.');

  if (!cleaned) {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function suggestEnvelopeForLabel(
  label: string,
  envelopes: Envelope[],
  pastTransactions: Transaction[]
): string | null {
  const normLabel = normalizeText(label);
  if (!normLabel || envelopes.length === 0) {
    return null;
  }

  // 1. Exact or substring match against past transactions
  for (const tx of pastTransactions) {
    const normTx = normalizeText(tx.label);
    if (normTx && (normLabel.includes(normTx) || normTx.includes(normLabel))) {
      if (envelopes.some((env) => env.id === tx.envelopeId)) {
        return tx.envelopeId;
      }
    }
  }

  // 2. Keyword match against envelope names
  for (const env of envelopes) {
    const normEnv = normalizeText(env.name);
    if (normEnv && (normLabel.includes(normEnv) || normEnv.includes(normLabel))) {
      return env.id;
    }
  }

  return null;
}

function parseOfxContent(
  content: string,
  envelopes: Envelope[],
  pastTransactions: Transaction[]
): ParsedBankOperation[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  const operations: ParsedBankOperation[] = [];

  blocks.forEach((block, index) => {
    const dateMatch = /<DTPOSTED>([^<\r\n]+)/i.exec(block);
    const amountMatch = /<TRNAMT>([^<\r\n]+)/i.exec(block);
    const nameMatch = /<NAME>([^<\r\n]+)/i.exec(block);
    const memoMatch = /<MEMO>([^<\r\n]+)/i.exec(block);

    const parsedDate = dateMatch ? parseFrenchOrIsoDate(dateMatch[1]) : null;
    const parsedAmount = amountMatch ? parseFrenchAmount(amountMatch[1]) : null;
    const rawLabel = (nameMatch?.[1] || memoMatch?.[1] || '').trim();

    if (!parsedDate || parsedAmount === null || !rawLabel || parsedAmount >= 0) {
      return;
    }

    const absAmount = Math.round(Math.abs(parsedAmount) * 100) / 100;
    if (absAmount <= 0) {
      return;
    }

    operations.push({
      id: `ofx-${index}-${parsedDate}`,
      date: parsedDate,
      label: rawLabel.slice(0, 100),
      amount: absAmount,
      suggestedEnvelopeId: suggestEnvelopeForLabel(rawLabel, envelopes, pastTransactions),
      dedupKey: buildClientDedupKey(parsedDate, absAmount, rawLabel)
    });
  });

  return operations;
}

export function parseBankStatement(
  content: string,
  envelopes: Envelope[],
  pastTransactions: Transaction[]
): ParsedBankOperation[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  if (/<OFX>/i.test(trimmed) || /<STMTTRN>/i.test(trimmed)) {
    return parseOfxContent(trimmed, envelopes, pastTransactions);
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = splitCsvLine(headerLine, delimiter).map((h) => normalizeText(h));

  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const labelIdx = headers.findIndex(
    (h) => h.includes('libelle') || h.includes('label') || h.includes('description') || h.includes('nom')
  );
  const debitIdx = headers.findIndex((h) => h.includes('debit'));
  const amountIdx = headers.findIndex(
    (h) => h.includes('montant') || h.includes('amount') || h.includes('valeur')
  );

  if (dateIdx === -1 || labelIdx === -1 || (debitIdx === -1 && amountIdx === -1)) {
    return [];
  }

  const operations: ParsedBankOperation[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i], delimiter);
    const parsedDate = parseFrenchOrIsoDate(cols[dateIdx] ?? '');
    const rawLabel = (cols[labelIdx] ?? '').replace(/^["']|["']$/g, '').trim();

    if (!parsedDate || !rawLabel) {
      continue;
    }

    let debitAmount: number | null = null;
    if (debitIdx !== -1 && cols[debitIdx]) {
      const val = parseFrenchAmount(cols[debitIdx]);
      if (val !== null && val !== 0) {
        debitAmount = Math.abs(val);
      }
    } else if (amountIdx !== -1 && cols[amountIdx]) {
      const val = parseFrenchAmount(cols[amountIdx]);
      // Negative amounts in bank CSVs represent expenses/debits
      if (val !== null && val < 0) {
        debitAmount = Math.abs(val);
      }
    }

    if (debitAmount === null || debitAmount <= 0) {
      continue;
    }

    const rounded = Math.round(debitAmount * 100) / 100;
    operations.push({
      id: `csv-${i}-${parsedDate}`,
      date: parsedDate,
      label: rawLabel.slice(0, 100),
      amount: rounded,
      suggestedEnvelopeId: suggestEnvelopeForLabel(rawLabel, envelopes, pastTransactions),
      dedupKey: buildClientDedupKey(parsedDate, rounded, rawLabel)
    });
  }

  return operations;
}
