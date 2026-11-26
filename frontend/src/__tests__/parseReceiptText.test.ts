import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../utils/parseReceiptText';

const REF_DATE = new Date('2026-11-26T12:00:00.000Z');

describe('parseReceiptText — Parseur de tickets de caisse français (Étape 61)', () => {
  it('extrait le montant TOTAL TTC, le marchand et la date sur un ticket de supermarché classique', () => {
    const raw = `
      CARREFOUR MARKET SAS
      12 RUE DE LA PAIX
      75002 PARIS
      SIRET 12345678900012
      24/11/2026 18:42
      PAIN COMPLET        2,10
      LAIT DEMI ECREME    1,45
      SOUS-TOTAL         38,50
      TVA 5.5%            2,01
      TOTAL TTC          42,80 EUR
      ESPECES            50,00
      RENDU               7,20
    `;

    const parsed = parseReceiptText(raw, REF_DATE);
    expect(parsed.amount).toBe(42.8);
    expect(parsed.merchant).toBe('Carrefour Market');
    expect(parsed.date).toBe('2026-11-24');
    expect(parsed.confidence).toBe('high');
  });

  it('gère les erreurs OCR classiques (O -> 0, espace avant centimes) et NET A PAYER', () => {
    const raw = `
      BISTROT DU COIN
      NET A PAYER : 28, 5O €
      15 nov. 2026
    `;

    const parsed = parseReceiptText(raw, REF_DATE);
    expect(parsed.amount).toBe(28.5);
    expect(parsed.merchant).toBe('Bistrot Du Coin');
    expect(parsed.date).toBe('2026-11-15');
    expect(parsed.confidence).toBe('high');
  });

  it('retombe sur le montant le plus élevé sans mot-clé TOTAL et expose les montants candidats', () => {
    const raw = `
      BOULANGERIE PAUL
      12/11/26
      BAGUETTE       1,30
      CROISSANT      1,50
      FORMULE MIDI   9,90
    `;

    const parsed = parseReceiptText(raw, REF_DATE);
    expect(parsed.amount).toBe(9.9);
    expect(parsed.candidateAmounts).toContain(9.9);
    expect(parsed.candidateAmounts.length).toBeGreaterThanOrEqual(2);
    expect(parsed.date).toBe('2026-11-12');
    expect(parsed.confidence).toBe('medium');
  });

  it('retourne confidence low et valeurs nulles sur un texte vide ou illisible', () => {
    const parsed = parseReceiptText('   \n  ', REF_DATE);
    expect(parsed.amount).toBeNull();
    expect(parsed.candidateAmounts).toEqual([]);
    expect(parsed.merchant).toBeNull();
    expect(parsed.date).toBeNull();
    expect(parsed.confidence).toBe('low');
  });
});
