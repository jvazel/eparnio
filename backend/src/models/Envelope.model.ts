import mongoose, { type Document, Schema, type Types } from 'mongoose';

export type EnvelopePillar = 'income' | 'fixed_charge' | 'variable_envelope' | 'savings';

export interface IEnvelope extends Document {
  budgetId: Types.ObjectId;
  budgetPeriodId: Types.ObjectId;
  pillar: EnvelopePillar;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  spentOrPaidAmount: number;
  date: Date;
  isRecurring: boolean;
  isPaid: boolean;
  memberId?: Types.ObjectId;
  linkedGoalId?: Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvelopeResponse {
  id: string;
  budgetId: string;
  budgetPeriodId: string;
  pillar: EnvelopePillar;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  spentOrPaidAmount: number;
  date: string;
  isRecurring: boolean;
  isPaid: boolean;
  memberId?: string;
  linkedGoalId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const envelopeSchema = new Schema<IEnvelope>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: 'Budget',
      required: true
    },
    budgetPeriodId: {
      type: Schema.Types.ObjectId,
      ref: 'BudgetPeriod',
      required: true
    },
    pillar: {
      type: String,
      enum: ['income', 'fixed_charge', 'variable_envelope', 'savings'],
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    icon: {
      type: String,
      default: '💡',
      trim: true
    },
    color: {
      type: String,
      default: '#38BDF8',
      trim: true
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    spentOrPaidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    linkedGoalId: {
      type: Schema.Types.ObjectId,
      ref: 'SavingsGoal'
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

envelopeSchema.index({ budgetPeriodId: 1, pillar: 1, order: 1 });

/**
 * Sérialise une enveloppe ou ligne budgétaire Mongoose pour la réponse JSON de l'API.
 */
export function toEnvelopeResponse(envelope: IEnvelope): EnvelopeResponse {
  return {
    id: envelope._id.toString(),
    budgetId: envelope.budgetId.toString(),
    budgetPeriodId: envelope.budgetPeriodId.toString(),
    pillar: envelope.pillar,
    name: envelope.name,
    icon: envelope.icon,
    color: envelope.color,
    allocatedAmount: envelope.allocatedAmount,
    spentOrPaidAmount: envelope.spentOrPaidAmount,
    date: envelope.date.toISOString(),
    isRecurring: envelope.isRecurring,
    isPaid: envelope.isPaid,
    ...(envelope.memberId ? { memberId: envelope.memberId.toString() } : {}),
    ...(envelope.linkedGoalId ? { linkedGoalId: envelope.linkedGoalId.toString() } : {}),
    order: envelope.order,
    createdAt: envelope.createdAt.toISOString(),
    updatedAt: envelope.updatedAt.toISOString()
  };
}

export const EnvelopeModel = mongoose.model<IEnvelope>('Envelope', envelopeSchema);
