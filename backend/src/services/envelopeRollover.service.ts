import type { Types } from 'mongoose';
import { EnvelopeModel } from '../models/Envelope.model';

/**
 * Calcule le montant de report (rollover) qu'une enveloppe variable transmet au mois suivant.
 */
export function computeEnvelopeRolloverAmount(envelope: {
  pillar: string;
  allocatedAmount: number;
  rolloverAmount?: number;
  spentOrPaidAmount: number;
  rolloverEnabled?: boolean;
  rolloverMode?: string;
}): number {
  if (envelope.pillar !== 'variable_envelope' || !envelope.rolloverEnabled) {
    return 0;
  }
  const available = envelope.allocatedAmount + (envelope.rolloverAmount ?? 0);
  const remaining = Math.round((available - envelope.spentOrPaidAmount) * 100) / 100;
  if (envelope.rolloverMode === 'both') {
    return remaining;
  }
  return Math.max(0, remaining);
}

/**
 * Propage le recalcul de `rolloverAmount` vers les périodes suivantes chaînées via `previousEnvelopeId`.
 */
export async function propagateEnvelopeRollover(envelopeId: Types.ObjectId | string): Promise<void> {
  let current = await EnvelopeModel.findById(envelopeId);
  const visited = new Set<string>();

  while (current && !visited.has(current._id.toString())) {
    visited.add(current._id.toString());
    const next = await EnvelopeModel.findOne({ previousEnvelopeId: current._id });
    if (!next) break;

    const nextRollover = computeEnvelopeRolloverAmount(current);
    if (next.rolloverAmount !== nextRollover) {
      next.rolloverAmount = nextRollover;
      await next.save();
    }
    current = next;
  }
}
