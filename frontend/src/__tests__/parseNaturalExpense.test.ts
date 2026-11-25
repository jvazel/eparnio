import { describe, expect, it } from 'vitest';
import { parseNaturalExpense } from '../utils/parseNaturalExpense';

const ENVELOPES = [
  { id: 'env-courses', name: 'Courses', icon: '🛒' },
  { id: 'env-resto', name: 'Restaurants', icon: '🍽️' },
  { id: 'env-transport', name: 'Transports', icon: '🚗' },
  { id: 'env-sante', name: 'Santé', icon: '💊' }
];

const SUGGESTIONS = [
  { label: 'Carrefour', envelopeName: 'Courses' },
  { label: 'TotalEnergies', envelopeName: 'Transports' }
];

const MEMBERS = [
  { userId: 'u1', displayName: 'Johann' },
  { userId: 'u2', displayName: 'Julie Martin' }
];

// Mercredi 25 novembre 2026
const REF_DATE = new Date(2026, 10, 25);

describe('Étape 50 — parseNaturalExpense (parsing 100 % local)', () => {
  it('extrait le montant parlé « 42 euros 50 », le libellé, l’enveloppe directe et la date « hier »', () => {
    const res = parseNaturalExpense('42 euros 50 chez Carrefour courses hier', {
      envelopes: ENVELOPES,
      referenceDate: REF_DATE
    });

    expect(res.amount).toBe(42.5);
    expect(res.label).toBe('Carrefour');
    expect(res.envelopeId).toBe('env-courses');
    expect(res.envelopeMatchedBy).toBe('direct');
    expect(res.date).toBe('2026-11-24');
    expect(res.dateLabel).toBe('Hier');
  });

  it('supporte les formats variés : virgule, point, 42€50, balles', () => {
    expect(
      parseNaturalExpense('12,90 € boulangerie', { envelopes: ENVELOPES }).amount
    ).toBe(12.9);
    expect(
      parseNaturalExpense('9.50 café', { envelopes: ENVELOPES }).amount
    ).toBe(9.5);
    expect(
      parseNaturalExpense('42€50 pharmacie santé', { envelopes: ENVELOPES })
    ).toMatchObject({
      amount: 42.5,
      label: 'Pharmacie',
      envelopeId: 'env-sante'
    });
    expect(
      parseNaturalExpense('15 balles resto', { envelopes: ENVELOPES })
    ).toMatchObject({
      amount: 15,
      envelopeId: 'env-resto'
    });
  });

  it('détecte l’enveloppe via le fallback sur l’historique suggestions quand elle n’est pas nommée', () => {
    const res = parseNaturalExpense('58,40 € Carrefour', {
      envelopes: ENVELOPES,
      suggestions: SUGGESTIONS
    });

    expect(res.amount).toBe(58.4);
    expect(res.label).toBe('Carrefour');
    expect(res.envelopeId).toBe('env-courses');
    expect(res.envelopeMatchedBy).toBe('suggestion');
  });

  it('extrait les #tags, avant-hier et le payeur en budget commun', () => {
    const res = parseNaturalExpense(
      '35 euros Pizzeria restaurants avant-hier payé par Julie #vacances #soiree',
      {
        envelopes: ENVELOPES,
        members: MEMBERS,
        isSharedBudget: true,
        referenceDate: REF_DATE
      }
    );

    expect(res.amount).toBe(35);
    expect(res.label).toBe('Pizzeria');
    expect(res.envelopeId).toBe('env-resto');
    expect(res.date).toBe('2026-11-23');
    expect(res.dateLabel).toBe('Avant-hier');
    expect(res.paidByUserId).toBe('u2');
    expect(res.paidByName).toBe('Julie Martin');
    expect(res.tags).toEqual(['vacances', 'soiree']);
  });

  it('gère proprement les entrées vides ou sans montant', () => {
    const empty = parseNaturalExpense('   ', { envelopes: ENVELOPES });
    expect(empty.amount).toBeUndefined();
    expect(empty.label).toBeUndefined();
    expect(empty.tags).toEqual([]);

    const noAmount = parseNaturalExpense('Boulangerie courses', { envelopes: ENVELOPES });
    expect(noAmount.amount).toBeUndefined();
    expect(noAmount.label).toBe('Boulangerie');
    expect(noAmount.envelopeId).toBe('env-courses');
  });
});
