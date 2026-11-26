import mongoose, { type Document, Schema, type Types } from 'mongoose';
import type { RolloverMode } from './Envelope.model';

export type TemplateItemPillar = 'variable_envelope' | 'savings';

export interface IBudgetTemplateItem {
  pillar: TemplateItemPillar;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  linkedGoalId?: Types.ObjectId;
  rolloverEnabled?: boolean;
  rolloverMode?: RolloverMode;
  order: number;
}

export interface IBudgetTemplate extends Document {
  budgetId: Types.ObjectId;
  name: string;
  icon: string;
  color: string;
  description?: string;
  items: IBudgetTemplateItem[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetTemplateItemResponse {
  pillar: TemplateItemPillar;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  linkedGoalId?: string;
  rolloverEnabled?: boolean;
  rolloverMode?: RolloverMode;
  order: number;
}

export interface BudgetTemplateResponse {
  id: string;
  budgetId: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  items: BudgetTemplateItemResponse[];
  totalVariableAmount: number;
  totalSavingsAmount: number;
  totalAllocatedAmount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const budgetTemplateItemSchema = new Schema<IBudgetTemplateItem>(
  {
    pillar: {
      type: String,
      enum: ['variable_envelope', 'savings'],
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    icon: {
      type: String,
      default: '💡',
      trim: true,
      maxlength: 16
    },
    color: {
      type: String,
      default: '#38BDF8',
      trim: true,
      maxlength: 32
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    linkedGoalId: {
      type: Schema.Types.ObjectId,
      ref: 'SavingsGoal'
    },
    rolloverEnabled: {
      type: Boolean,
      default: false
    },
    rolloverMode: {
      type: String,
      enum: ['positive_only', 'both'],
      default: 'positive_only'
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const budgetTemplateSchema = new Schema<IBudgetTemplate>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: 'Budget',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    icon: {
      type: String,
      default: '🎭',
      trim: true,
      maxlength: 16
    },
    color: {
      type: String,
      default: '#7C3AED',
      trim: true,
      maxlength: 32
    },
    description: {
      type: String,
      trim: true,
      maxlength: 160
    },
    items: {
      type: [budgetTemplateItemSchema],
      default: []
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

budgetTemplateSchema.index({ budgetId: 1, name: 1 });

export const BudgetTemplateModel = mongoose.model<IBudgetTemplate>(
  'BudgetTemplate',
  budgetTemplateSchema
);

function roundCurrency(val: number): number {
  return Math.round(val * 100) / 100;
}

export function toBudgetTemplateResponse(doc: IBudgetTemplate): BudgetTemplateResponse {
  const items: BudgetTemplateItemResponse[] = (doc.items ?? []).map((item, idx) => ({
    pillar: item.pillar,
    name: item.name,
    icon: item.icon,
    color: item.color,
    allocatedAmount: item.allocatedAmount,
    ...(item.linkedGoalId ? { linkedGoalId: item.linkedGoalId.toString() } : {}),
    ...(item.rolloverEnabled !== undefined ? { rolloverEnabled: item.rolloverEnabled } : {}),
    ...(item.rolloverMode ? { rolloverMode: item.rolloverMode } : {}),
    order: item.order ?? idx
  }));

  const totalVariableAmount = roundCurrency(
    items
      .filter((i) => i.pillar === 'variable_envelope')
      .reduce((acc, i) => acc + i.allocatedAmount, 0)
  );
  const totalSavingsAmount = roundCurrency(
    items
      .filter((i) => i.pillar === 'savings')
      .reduce((acc, i) => acc + i.allocatedAmount, 0)
  );

  return {
    id: doc._id.toString(),
    budgetId: doc.budgetId.toString(),
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    ...(doc.description ? { description: doc.description } : {}),
    items,
    totalVariableAmount,
    totalSavingsAmount,
    totalAllocatedAmount: roundCurrency(totalVariableAmount + totalSavingsAmount),
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}
