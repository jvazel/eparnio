import mongoose, { type Document, Schema, type Types } from 'mongoose';

export interface IBudgetPeriodSummary {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedEnvelopes: number;
  plannedSavings: number;
  spentVariables: number;
  remainingToAllocate: number;
  remainingToLive: number;
}

export interface IBudgetPeriod extends Document {
  budgetId: Types.ObjectId;
  year: number;
  month: number;
  label: string;
  startDate: Date;
  endDate: Date;
  summary: IBudgetPeriodSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetPeriodResponse {
  id: string;
  budgetId: string;
  year: number;
  month: number;
  label: string;
  startDate: string;
  endDate: string;
  summary: IBudgetPeriodSummary;
  createdAt: string;
  updatedAt: string;
}

const summarySchema = new Schema<IBudgetPeriodSummary>(
  {
    plannedIncome: { type: Number, default: 0 },
    plannedFixedCharges: { type: Number, default: 0 },
    plannedEnvelopes: { type: Number, default: 0 },
    plannedSavings: { type: Number, default: 0 },
    spentVariables: { type: Number, default: 0 },
    remainingToAllocate: { type: Number, default: 0 },
    remainingToLive: { type: Number, default: 0 }
  },
  { _id: false }
);

const budgetPeriodSchema = new Schema<IBudgetPeriod>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: 'Budget',
      required: true
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    summary: {
      type: summarySchema,
      default: () => ({
        plannedIncome: 0,
        plannedFixedCharges: 0,
        plannedEnvelopes: 0,
        plannedSavings: 0,
        spentVariables: 0,
        remainingToAllocate: 0,
        remainingToLive: 0
      })
    }
  },
  {
    timestamps: true
  }
);

budgetPeriodSchema.index({ budgetId: 1, year: 1, month: 1 }, { unique: true });
budgetPeriodSchema.index({ budgetId: 1, startDate: -1 });

/**
 * Sérialise une période budgétaire Mongoose pour la réponse JSON de l'API.
 */
export function toBudgetPeriodResponse(period: IBudgetPeriod): BudgetPeriodResponse {
  return {
    id: period._id.toString(),
    budgetId: period.budgetId.toString(),
    year: period.year,
    month: period.month,
    label: period.label,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
    summary: {
      plannedIncome: period.summary.plannedIncome,
      plannedFixedCharges: period.summary.plannedFixedCharges,
      plannedEnvelopes: period.summary.plannedEnvelopes,
      plannedSavings: period.summary.plannedSavings,
      spentVariables: period.summary.spentVariables,
      remainingToAllocate: period.summary.remainingToAllocate,
      remainingToLive: period.summary.remainingToLive
    },
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString()
  };
}

export const BudgetPeriodModel = mongoose.model<IBudgetPeriod>('BudgetPeriod', budgetPeriodSchema);
