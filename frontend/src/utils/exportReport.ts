import { apiClient } from '../services/api';
import type {
  EnvelopeItem,
  PeriodAnalytics,
  SavingsGoalItem,
  TransactionItem
} from '../types/budget.types';
import { formatCurrency } from './format';

export interface PeriodPdfReportInput {
  budgetName: string;
  periodLabel: string;
  analytics: PeriodAnalytics;
  envelopes: EnvelopeItem[];
  goals: SavingsGoalItem[];
  transactions?: TransactionItem[];
  generatedAt?: Date;
}

const WIN_ANSI_EXTRAS: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x201e: 0x84,
  0x2026: 0x85, // …
  0x2018: 0x91,
  0x2019: 0x92, // ’
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x0152: 0x8c, // Œ
  0x0153: 0x9c // œ
};

function sanitizePdfText(raw: string): string {
  return raw
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\u2192/g, '->')
    .replace(/\r?\n/g, ' ');
}

function encodeWinAnsiPdfLiteralBytes(raw: string): number[] {
  const cleaned = sanitizePdfText(raw);
  const bytes: number[] = [];

  for (const ch of cleaned) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;

    let byte: number | undefined;
    if (code >= 0x20 && code <= 0x7e) {
      byte = code;
    } else if (code >= 0xa0 && code <= 0xff) {
      byte = code;
    } else if (WIN_ANSI_EXTRAS[code] !== undefined) {
      byte = WIN_ANSI_EXTRAS[code];
    }

    if (byte === undefined) {
      // Ignore les emojis / symboles hors jeu WinAnsi sans casser le PDF
      continue;
    }

    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      bytes.push(0x5c); // '\'
    }
    bytes.push(byte);
  }

  // Supprimer les espaces superflus en début si un emoji ouvrait la chaîne
  while (bytes.length > 0 && bytes[0] === 0x20) {
    bytes.shift();
  }
  return bytes;
}

function appendAscii(target: number[], text: string): void {
  for (let i = 0; i < text.length; i++) {
    target.push(text.charCodeAt(i) & 0xff);
  }
}

function formatPdfCurrency(value: number): string {
  return sanitizePdfText(formatCurrency(value));
}

/**
 * Normalise une chaîne pour produire un nom de fichier sûr côté client.
 */
export function sanitizeFilenamePart(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'budget';
}

/**
 * Déclenche le téléchargement local d'un `Blob` sans navigation ni sink HTML dangereux.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const canUseObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const href = canUseObjectUrl ? URL.createObjectURL(blob) : '';
  if (!href) return;

  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 100);
}

interface PdfTableCell {
  text: string;
  x: number;
  bold?: boolean;
  colorRgb?: readonly [number, number, number];
}

interface PdfLineSpec {
  text: string;
  font: 'F1' | 'F2';
  size: number;
  spacingAfter: number;
  colorRgb?: readonly [number, number, number];
  tableRow?: {
    cells: PdfTableCell[];
    isHeader?: boolean;
    isZebra?: boolean;
  };
  stackedBar?: Array<{
    ratio: number;
    colorRgb: readonly [number, number, number];
  }>;
  pieChart?: Array<{
    label: string;
    percentage: number;
    colorRgb: readonly [number, number, number];
  }>;
}

function formatPdfDateFr(rawDate: string | undefined): string {
  if (!rawDate) return '';
  const isoDay = rawDate.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!match) return isoDay;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function buildReportLineSpecs(input: PeriodPdfReportInput): PdfLineSpec[] {
  const { budgetName, periodLabel, analytics, envelopes, goals } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const dateStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(generatedAt);

  const lines: PdfLineSpec[] = [
    {
      text: `EPARNIO - Bilan budgetaire (${periodLabel})`,
      font: 'F2',
      size: 16,
      spacingAfter: 20,
      colorRgb: [0.486, 0.227, 0.929]
    },
    {
      text: `Espace : ${budgetName} | Genere le ${dateStr}`,
      font: 'F1',
      size: 10,
      spacingAfter: 22,
      colorRgb: [0.39, 0.45, 0.55]
    },
    {
      text: "Entrees et sorties d'argent",
      font: 'F2',
      size: 12,
      spacingAfter: 18,
      colorRgb: [0.06, 0.09, 0.16]
    },
    {
      text: 'Poste | Montant',
      font: 'F2',
      size: 8.5,
      spacingAfter: 16,
      tableRow: {
        isHeader: true,
        cells: [
          { text: 'Poste', x: 54, bold: true },
          { text: 'Montant', x: 450, bold: true }
        ]
      }
    },
    {
      text: `Revenus prevus : ${formatPdfCurrency(analytics.cashFlow.plannedIncome)}`,
      font: 'F1',
      size: 9,
      spacingAfter: 15,
      tableRow: {
        cells: [
          { text: 'Revenus prevus', x: 54 },
          { text: formatPdfCurrency(analytics.cashFlow.plannedIncome), x: 450, bold: true }
        ]
      }
    },
    {
      text: `Depenses fixes : ${formatPdfCurrency(analytics.cashFlow.plannedFixedCharges)}`,
      font: 'F1',
      size: 9,
      spacingAfter: 15,
      tableRow: {
        isZebra: true,
        cells: [
          { text: 'Depenses fixes', x: 54 },
          { text: formatPdfCurrency(analytics.cashFlow.plannedFixedCharges), x: 450, bold: true }
        ]
      }
    },
    {
      text: `  - Enveloppes variables allouees : ${formatPdfCurrency(analytics.cashFlow.plannedEnvelopes)} (depense : ${formatPdfCurrency(analytics.cashFlow.spentVariables)})`,
      font: 'F1',
      size: 10.5,
      spacingAfter: 14
    },
    {
      text: `  - Epargne du mois : ${formatPdfCurrency(analytics.cashFlow.plannedSavings)}`,
      font: 'F1',
      size: 10.5,
      spacingAfter: 14
    },
    {
      text: `  - Reste a vivre : ${formatPdfCurrency(analytics.cashFlow.remainingToLive)} | Restant a repartir (Base Zero) : ${formatPdfCurrency(analytics.zeroBased.remainingToAllocate)}`,
      font: 'F2',
      size: 10.5,
      spacingAfter: 14
    },
    {
      text: `  - Budget quotidien conseille : ${formatPdfCurrency(analytics.dailyBudget.dailyAmount)} / jour (${analytics.dailyBudget.daysRemaining} jours restants)`,
      font: 'F1',
      size: 10,
      spacingAfter: 20
    },
    {
      text: 'Part des depenses par rapport aux revenus',
      font: 'F2',
      size: 12,
      spacingAfter: 18
    },
    {
      text: 'Camembert repartition',
      font: 'F1',
      size: 9,
      spacingAfter: 82,
      pieChart: analytics.allocation.items.map((item, idx) => ({
        label: item.label,
        percentage: item.percentage,
        colorRgb:
          idx === 0
            ? ([0.545, 0.361, 0.965] as const)
            : idx === 1
              ? ([0.231, 0.51, 0.965] as const)
              : ([0.133, 0.773, 0.369] as const)
      }))
    }
  ];

  const variableEnvelopes = envelopes
    .filter((item) => item.pillar === 'variable_envelope')
    .sort((a, b) => a.order - b.order);

  if (variableEnvelopes.length > 0) {
    lines.push({
      text: '',
      font: 'F1',
      size: 8,
      spacingAfter: 8
    });
    lines.push({
      text: 'Enveloppes budgetaires',
      font: 'F2',
      size: 12,
      spacingAfter: 18
    });
    lines.push({
      text: 'Enveloppe | Alloue | Depense | Restant',
      font: 'F2',
      size: 8.5,
      spacingAfter: 16,
      tableRow: {
        isHeader: true,
        cells: [
          { text: 'Enveloppe', x: 54, bold: true },
          { text: 'Alloue', x: 260, bold: true },
          { text: 'Depense', x: 365, bold: true },
          { text: 'Restant', x: 470, bold: true }
        ]
      }
    });
    variableEnvelopes.forEach((env, idx) => {
      const available = env.allocatedAmount + (env.rolloverAmount ?? 0);
      const remaining = Math.round((available - env.spentOrPaidAmount) * 100) / 100;
      lines.push({
        text: `${env.name} : Alloue ${formatPdfCurrency(available)} | Depense ${formatPdfCurrency(env.spentOrPaidAmount)} | Restant ${formatPdfCurrency(remaining)}`,
        font: 'F1',
        size: 9,
        spacingAfter: 15,
        tableRow: {
          isZebra: idx % 2 === 1,
          cells: [
            { text: env.name.slice(0, 32), x: 54, bold: true },
            { text: formatPdfCurrency(available), x: 260 },
            { text: formatPdfCurrency(env.spentOrPaidAmount), x: 365 },
            {
              text: formatPdfCurrency(remaining),
              x: 470,
              bold: true,
              colorRgb: remaining < 0 ? [0.88, 0.11, 0.28] : [0.09, 0.64, 0.29]
            }
          ]
        }
      });
    });
  }

  if (goals.length > 0) {
    lines.push({
      text: '',
      font: 'F1',
      size: 8,
      spacingAfter: 8
    });
    lines.push({
      text: "Objectifs d'epargne",
      font: 'F2',
      size: 12,
      spacingAfter: 18
    });
    lines.push({
      text: 'Objectif | Epargne | Cible | Avancement',
      font: 'F2',
      size: 8.5,
      spacingAfter: 16,
      tableRow: {
        isHeader: true,
        cells: [
          { text: 'Objectif', x: 54, bold: true },
          { text: 'Epargne', x: 260, bold: true },
          { text: 'Cible', x: 365, bold: true },
          { text: 'Avancement', x: 470, bold: true }
        ]
      }
    });
    goals.forEach((goal, idx) => {
      const pct =
        goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
      lines.push({
        text: `${goal.name} : ${formatPdfCurrency(goal.currentAmount)} / ${formatPdfCurrency(goal.targetAmount)} (${pct} %)`,
        font: 'F1',
        size: 9,
        spacingAfter: 15,
        tableRow: {
          isZebra: idx % 2 === 1,
          cells: [
            { text: goal.name.slice(0, 32), x: 54, bold: true },
            { text: formatPdfCurrency(goal.currentAmount), x: 260 },
            { text: formatPdfCurrency(goal.targetAmount), x: 365 },
            { text: `${pct} %`, x: 470, bold: true, colorRgb: [0.06, 0.45, 0.9] }
          ]
        }
      });
    });
  }

  if (analytics.budgetType === 'shared' && analytics.memberBreakdown.length > 0) {
    lines.push({
      text: '',
      font: 'F1',
      size: 8,
      spacingAfter: 8
    });
    lines.push({
      text: 'Bilan par membre (Budget commun)',
      font: 'F2',
      size: 12,
      spacingAfter: 16
    });
    for (const member of analytics.memberBreakdown) {
      lines.push({
        text: `  - ${member.displayName} : Apports ${formatPdfCurrency(member.incomeContributed)} (${member.incomeSharePercentage} %) | Depenses ${formatPdfCurrency(member.expensesPaid)} | Solde ${formatPdfCurrency(member.netBalance)}`,
        font: 'F1',
        size: 10,
        spacingAfter: 14
      });
    }
  }

  const fixedCharges = envelopes.filter((env) => env.pillar === 'fixed_charge');
  if (fixedCharges.length > 0) {
    lines.push({
      text: '',
      font: 'F1',
      size: 8,
      spacingAfter: 8
    });
    lines.push({
      text: 'Depenses fixes',
      font: 'F2',
      size: 12,
      spacingAfter: 18
    });
    lines.push({
      text: 'Date | Libelle | Statut | Montant',
      font: 'F2',
      size: 8.5,
      spacingAfter: 16,
      tableRow: {
        isHeader: true,
        cells: [
          { text: 'Date', x: 54, bold: true },
          { text: 'Libelle', x: 125, bold: true },
          { text: 'Statut', x: 375, bold: true },
          { text: 'Montant', x: 475, bold: true }
        ]
      }
    });
    fixedCharges.forEach((fc, idx) => {
      const statusLabel = fc.isPaid ? 'Payee' : 'A venir';
      const dateStr = formatPdfDateFr(fc.date) || '-';
      lines.push({
        text: `${dateStr} | ${fc.name} | ${statusLabel} | ${formatPdfCurrency(fc.allocatedAmount)}`,
        font: 'F1',
        size: 9,
        spacingAfter: 15,
        tableRow: {
          isZebra: idx % 2 === 1,
          cells: [
            { text: dateStr, x: 54 },
            { text: fc.name.slice(0, 40), x: 125 },
            {
              text: statusLabel,
              x: 375,
              colorRgb: fc.isPaid ? [0.09, 0.64, 0.29] : [0.85, 0.46, 0.02]
            },
            { text: formatPdfCurrency(fc.allocatedAmount), x: 475, bold: true }
          ]
        }
      });
    });
  }

  if (input.transactions && input.transactions.length > 0) {
    const envelopeNameById = new Map(envelopes.map((e) => [e.id, e.name]));
    const sortedTxs = [...input.transactions].sort((a, b) => b.date.localeCompare(a.date));
    lines.push({
      text: '',
      font: 'F1',
      size: 8,
      spacingAfter: 8
    });
    lines.push({
      text: 'Detail des depenses variables (jour par jour)',
      font: 'F2',
      size: 12,
      spacingAfter: 18
    });
    lines.push({
      text: 'Date | Libelle | Enveloppe | Note | Montant',
      font: 'F2',
      size: 8.5,
      spacingAfter: 16,
      tableRow: {
        isHeader: true,
        cells: [
          { text: 'Date', x: 54, bold: true },
          { text: 'Libelle', x: 120, bold: true },
          { text: 'Enveloppe', x: 270, bold: true },
          { text: 'Note', x: 375, bold: true },
          { text: 'Montant', x: 480, bold: true }
        ]
      }
    });
    sortedTxs.forEach((tx, idx) => {
      const envName = envelopeNameById.get(tx.envelopeId) ?? 'Enveloppe';
      const dateStr = formatPdfDateFr(tx.date);
      const noteStr = tx.notes ? tx.notes.slice(0, 18) : '-';
      lines.push({
        text: `${dateStr} | ${tx.label} (${envName}) : ${formatPdfCurrency(tx.amount)}`,
        font: 'F1',
        size: 9,
        spacingAfter: 15,
        tableRow: {
          isZebra: idx % 2 === 1,
          cells: [
            { text: dateStr, x: 54 },
            { text: tx.label.slice(0, 26), x: 120 },
            { text: envName.slice(0, 18), x: 270 },
            { text: noteStr, x: 375, colorRgb: [0.45, 0.5, 0.58] },
            { text: formatPdfCurrency(tx.amount), x: 480, bold: true }
          ]
        }
      });
    });

    // Regroupement par enveloppe puis par date
    lines.push({
      text: '',
      font: 'F1',
      size: 8,
      spacingAfter: 8
    });
    lines.push({
      text: 'Detail des depenses par enveloppe',
      font: 'F2',
      size: 12,
      spacingAfter: 16
    });
    const txsByEnvelope = new Map<string, TransactionItem[]>();
    for (const tx of sortedTxs) {
      const list = txsByEnvelope.get(tx.envelopeId) ?? [];
      list.push(tx);
      txsByEnvelope.set(tx.envelopeId, list);
    }
    for (const [envId, envTxs] of txsByEnvelope.entries()) {
      const envName = envelopeNameById.get(envId) ?? 'Enveloppe';
      lines.push({
        text: envName,
        font: 'F2',
        size: 10.5,
        colorRgb: [0.486, 0.227, 0.929],
        spacingAfter: 16
      });
      lines.push({
        text: 'Date | Libelle | Note | Montant',
        font: 'F2',
        size: 8.5,
        spacingAfter: 16,
        tableRow: {
          isHeader: true,
          cells: [
            { text: 'Date', x: 54, bold: true },
            { text: 'Libelle', x: 125, bold: true },
            { text: 'Note', x: 320, bold: true },
            { text: 'Montant', x: 480, bold: true }
          ]
        }
      });
      envTxs.forEach((tx, idx) => {
        const dateStr = formatPdfDateFr(tx.date);
        const noteStr = tx.notes ? tx.notes.slice(0, 26) : '-';
        lines.push({
          text: `${dateStr} | ${tx.label} : ${formatPdfCurrency(tx.amount)}`,
          font: 'F1',
          size: 9,
          spacingAfter: 15,
          tableRow: {
            isZebra: idx % 2 === 1,
            cells: [
              { text: dateStr, x: 54 },
              { text: tx.label.slice(0, 34), x: 125 },
              { text: noteStr, x: 320, colorRgb: [0.45, 0.5, 0.58] },
              { text: formatPdfCurrency(tx.amount), x: 480, bold: true }
            ]
          }
        });
      });
    }
  }

  return lines;
}

function drawFilledRect(
  bytes: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: readonly [number, number, number]
): void {
  appendAscii(
    bytes,
    `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg\n${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f\n`
  );
}

function drawTextAt(
  bytes: number[],
  text: string,
  x: number,
  y: number,
  font: 'F1' | 'F2',
  size: number,
  rgb: readonly [number, number, number]
): void {
  appendAscii(bytes, 'BT\n');
  appendAscii(bytes, `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg\n`);
  appendAscii(bytes, `/${font} ${size} Tf\n`);
  appendAscii(bytes, `1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm\n`);
  bytes.push(0x28);
  bytes.push(...encodeWinAnsiPdfLiteralBytes(text));
  appendAscii(bytes, ') Tj\nET\n');
}

function drawPieChart(
  bytes: number[],
  cx: number,
  cy: number,
  radius: number,
  slices: Array<{ label: string; percentage: number; colorRgb: readonly [number, number, number] }>
): void {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.percentage), 0);
  if (total <= 0) return;

  let startAngle = Math.PI / 2; // 12h
  const stepsPerFullCircle = 48;

  for (const slice of slices) {
    const ratio = Math.max(0, slice.percentage) / total;
    if (ratio <= 0.001) continue;
    const sweep = ratio * Math.PI * 2;
    const steps = Math.max(3, Math.ceil((sweep / (Math.PI * 2)) * stepsPerFullCircle));

    appendAscii(
      bytes,
      `${slice.colorRgb[0].toFixed(3)} ${slice.colorRgb[1].toFixed(3)} ${slice.colorRgb[2].toFixed(3)} rg\n`
    );
    appendAscii(bytes, `${cx.toFixed(1)} ${cy.toFixed(1)} m\n`);
    for (let i = 0; i <= steps; i += 1) {
      const angle = startAngle - (sweep * i) / steps;
      const px = cx + radius * Math.cos(angle);
      const py = cy + radius * Math.sin(angle);
      appendAscii(bytes, `${px.toFixed(1)} ${py.toFixed(1)} l\n`);
    }
    appendAscii(bytes, 'h f\n');
    startAngle -= sweep;
  }

  // Centre blanc pour un effet Donut moderne
  const innerR = radius * 0.52;
  appendAscii(bytes, '1.000 1.000 1.000 rg\n');
  appendAscii(bytes, `${(cx + innerR).toFixed(1)} ${cy.toFixed(1)} m\n`);
  for (let i = 1; i <= stepsPerFullCircle; i += 1) {
    const angle = (Math.PI * 2 * i) / stepsPerFullCircle;
    appendAscii(
      bytes,
      `${(cx + innerR * Math.cos(angle)).toFixed(1)} ${(cy + innerR * Math.sin(angle)).toFixed(1)} l\n`
    );
  }
  appendAscii(bytes, 'h f\n');

  // Légende à droite du camembert
  slices.forEach((slice, idx) => {
    const ly = cy + 16 - idx * 18;
    drawFilledRect(bytes, cx + radius + 24, ly - 1, 9, 9, slice.colorRgb);
    drawTextAt(
      bytes,
      `${slice.label} : ${slice.percentage} %`,
      cx + radius + 40,
      ly,
      'F1',
      9.5,
      [0.06, 0.09, 0.16]
    );
  });
}

function buildPdfPageContentBytes(
  lines: Array<{ spec: PdfLineSpec; y: number }>,
  input?: PeriodPdfReportInput,
  isFirstPage = false
): number[] {
  const bytes: number[] = [];

  if (isFirstPage && input) {
    // Bandeau d'en-tête violet Eparnio
    drawFilledRect(bytes, 0, 766, 595, 76, [0.486, 0.227, 0.929]);
    drawTextAt(bytes, 'EPARNIO - Bilan Budgetaire', 48, 808, 'F2', 18, [1, 1, 1]);
    drawTextAt(
      bytes,
      `${input.budgetName}  |  ${input.periodLabel}`,
      48,
      784,
      'F1',
      11,
      [0.93, 0.9, 1]
    );

    // 4 cartes KPI synthétiques
    const kpis: Array<{ label: string; value: string; accent: [number, number, number] }> = [
      {
        label: 'Revenus',
        value: formatPdfCurrency(input.analytics.cashFlow.plannedIncome),
        accent: [0.06, 0.45, 0.9]
      },
      {
        label: 'Fixes',
        value: formatPdfCurrency(input.analytics.cashFlow.plannedFixedCharges),
        accent: [0.49, 0.23, 0.93]
      },
      {
        label: 'Variables',
        value: formatPdfCurrency(input.analytics.cashFlow.spentVariables),
        accent: [0.23, 0.51, 0.96]
      },
      {
        label: 'Reste a vivre',
        value: formatPdfCurrency(input.analytics.cashFlow.remainingToLive),
        accent: [0.09, 0.64, 0.29]
      }
    ];

    kpis.forEach((kpi, idx) => {
      const cardX = 48 + idx * 126;
      const cardY = 696;
      drawFilledRect(bytes, cardX, cardY, 118, 52, [0.97, 0.98, 0.99]);
      drawFilledRect(bytes, cardX, cardY + 49, 118, 3, kpi.accent);
      drawTextAt(bytes, kpi.label, cardX + 10, cardY + 32, 'F1', 8.5, [0.39, 0.45, 0.55]);
      drawTextAt(bytes, kpi.value, cardX + 10, cardY + 14, 'F2', 11, [0.06, 0.09, 0.16]);
    });
  }

  for (const { spec, y } of lines) {
    if (!spec.text) continue;
    if (spec.pieChart) {
      drawPieChart(bytes, 92, y - 34, 34, spec.pieChart);
      continue;
    }
    if (spec.stackedBar) {
      drawFilledRect(bytes, 48, y - 2, 499, 12, [0.92, 0.94, 0.96]);
      let barX = 48;
      for (const seg of spec.stackedBar) {
        const segW = Math.max(0, seg.ratio * 499);
        if (segW > 0.5) {
          drawFilledRect(bytes, barX, y - 2, segW, 12, seg.colorRgb);
          barX += segW;
        }
      }
      continue;
    }
    if (spec.tableRow) {
      if (spec.tableRow.isHeader) {
        drawFilledRect(bytes, 48, y - 4, 499, 16, [0.91, 0.93, 0.96]);
      } else if (spec.tableRow.isZebra) {
        drawFilledRect(bytes, 48, y - 4, 499, 15, [0.97, 0.98, 0.99]);
      }
      for (const cell of spec.tableRow.cells) {
        drawTextAt(
          bytes,
          cell.text,
          cell.x,
          y,
          cell.bold ? 'F2' : 'F1',
          spec.size,
          cell.colorRgb ?? [0.06, 0.09, 0.16]
        );
      }
      continue;
    }
    if (spec.font === 'F2' && spec.size >= 12) {
      drawFilledRect(bytes, 48, y - 4, 499, 18, [0.95, 0.96, 0.98]);
      drawFilledRect(bytes, 48, y - 4, 3, 18, [0.486, 0.227, 0.929]);
      drawTextAt(bytes, spec.text, 56, y, spec.font, spec.size, [0.12, 0.16, 0.24]);
      continue;
    }
    const rgb = spec.colorRgb ?? [0.06, 0.09, 0.16];
    drawTextAt(bytes, spec.text, 48, y, spec.font, spec.size, rgb);
  }

  // Pied de page discret
  drawTextAt(
    bytes,
    'Document genere localement par Eparnio',
    48,
    28,
    'F1',
    8,
    [0.58, 0.64, 0.72]
  );

  return bytes;
}

/**
 * Génère un document PDF 1.4 valide (A4, multi-pages, sans dépendance ni DOM HTML).
 */
export function generatePeriodPdfBytes(input: PeriodPdfReportInput): Uint8Array {
  const specs = buildReportLineSpecs(input);
  const pages: Array<Array<{ spec: PdfLineSpec; y: number }>> = [[]];
  let currentY = 668;
  const bottomMargin = 54;

  for (const spec of specs) {
    if (currentY - spec.spacingAfter < bottomMargin && pages[pages.length - 1]!.length > 0) {
      pages.push([]);
      currentY = 790;
    }
    pages[pages.length - 1]!.push({ spec, y: currentY });
    currentY -= spec.spacingAfter;
  }

  const objects: number[][] = [];

  // 1: Catalog, 2: Pages, 3: Helvetica Regular (F1), 4: Helvetica Bold (F2)
  const firstPageObjId = 5;
  const pageObjIds = pages.map((_, index) => firstPageObjId + index * 2);

  const catalogObj: number[] = [];
  appendAscii(catalogObj, '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push(catalogObj);

  const pagesObj: number[] = [];
  appendAscii(
    pagesObj,
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`
  );
  objects.push(pagesObj);

  const fontRegularObj: number[] = [];
  appendAscii(
    fontRegularObj,
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
  );
  objects.push(fontRegularObj);

  const fontBoldObj: number[] = [];
  appendAscii(
    fontBoldObj,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
  );
  objects.push(fontBoldObj);

  pages.forEach((pageLines, index) => {
    const pageId = firstPageObjId + index * 2;
    const contentId = pageId + 1;

    const pageObj: number[] = [];
    appendAscii(
      pageObj,
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    objects.push(pageObj);

    const streamBytes = buildPdfPageContentBytes(pageLines, input, index === 0);
    const contentObj: number[] = [];
    appendAscii(contentObj, `${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    contentObj.push(...streamBytes);
    appendAscii(contentObj, 'endstream\nendobj\n');
    objects.push(contentObj);
  });

  const pdfBytes: number[] = [];
  appendAscii(pdfBytes, '%PDF-1.4\n');

  const offsets: number[] = [0];
  for (const objBytes of objects) {
    offsets.push(pdfBytes.length);
    pdfBytes.push(...objBytes);
  }

  const xrefOffset = pdfBytes.length;
  appendAscii(pdfBytes, `xref\n0 ${objects.length + 1}\n`);
  appendAscii(pdfBytes, '0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    appendAscii(pdfBytes, `${padded} 00000 n \n`);
  }

  appendAscii(
    pdfBytes,
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return new Uint8Array(pdfBytes);
}

/**
 * Génère et télécharge localement le bilan PDF synthétique de la période.
 */
export function downloadPeriodPdfReport(input: PeriodPdfReportInput): string {
  const bytes = generatePeriodPdfBytes(input);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const filename = `eparnio-bilan-${sanitizeFilenamePart(input.budgetName)}-${sanitizeFilenamePart(input.periodLabel)}.pdf`;
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Télécharge l'export CSV (UTF-8 avec BOM pour Excel) depuis le backend.
 */
export async function downloadBudgetCsv(
  budgetId: string,
  options: { budgetName: string; periodId?: string; year?: number; periodLabel?: string }
): Promise<string> {
  const params: Record<string, string | number> = {};
  if (options.periodId) {
    params.periodId = options.periodId;
  } else if (options.year) {
    params.year = options.year;
  }

  const { data } = await apiClient.get<string>(`/budgets/${budgetId}/export/csv`, {
    params: Object.keys(params).length > 0 ? params : undefined,
    responseType: 'text',
    transformResponse: [(raw) => raw]
  });

  const rawText = typeof data === 'string' ? data : String(data ?? '');
  const contentWithBom = rawText.startsWith('\uFEFF') ? rawText : `\uFEFF${rawText}`;
  const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });
  const scope = options.periodLabel
    ? sanitizeFilenamePart(options.periodLabel)
    : options.year
      ? String(options.year)
      : 'complet';
  const filename = `eparnio-${sanitizeFilenamePart(options.budgetName)}-${scope}.csv`;
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Télécharge la sauvegarde JSON complète de l'espace budgétaire depuis le backend.
 */
export async function downloadBudgetJsonBackup(
  budgetId: string,
  budgetName: string
): Promise<string> {
  const { data } = await apiClient.get<unknown>(`/budgets/${budgetId}/export/json`);
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const filename = `eparnio-backup-${sanitizeFilenamePart(budgetName)}.json`;
  triggerBlobDownload(blob, filename);
  return filename;
}
