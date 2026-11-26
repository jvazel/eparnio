import mongoose, { type Document, Schema, type Types } from 'mongoose';

export type PayeeMatchType = 'contains' | 'starts_with' | 'exact';
export type PayeeRuleTransactionType = 'all' | 'expense' | 'income';

export interface IPayeeRule extends Document {
  budgetId: Types.ObjectId;
  pattern: string;
  matchType: PayeeMatchType;
  transactionType: PayeeRuleTransactionType;
  targetEnvelopeName?: string;
  renameLabel?: string;
  addTags: string[];
  autoExcludeFromImport: boolean;
  isActive: boolean;
  order: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayeeRuleResponse {
  id: string;
  budgetId: string;
  pattern: string;
  matchType: PayeeMatchType;
  transactionType: PayeeRuleTransactionType;
  targetEnvelopeName?: string;
  renameLabel?: string;
  addTags: string[];
  autoExcludeFromImport: boolean;
  isActive: boolean;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const payeeRuleSchema = new Schema<IPayeeRule>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: 'Budget',
      required: true,
      index: true
    },
    pattern: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    matchType: {
      type: String,
      enum: ['contains', 'starts_with', 'exact'],
      default: 'contains'
    },
    transactionType: {
      type: String,
      enum: ['all', 'expense', 'income'],
      default: 'all'
    },
    targetEnvelopeName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    renameLabel: {
      type: String,
      trim: true,
      maxlength: 80
    },
    addTags: {
      type: [String],
      default: []
    },
    autoExcludeFromImport: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
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

payeeRuleSchema.index({ budgetId: 1, order: 1 });

export const PayeeRuleModel = mongoose.model<IPayeeRule>('PayeeRule', payeeRuleSchema);

export function toPayeeRuleResponse(doc: IPayeeRule): PayeeRuleResponse {
  return {
    id: doc._id.toString(),
    budgetId: doc.budgetId.toString(),
    pattern: doc.pattern,
    matchType: doc.matchType,
    transactionType: doc.transactionType,
    ...(doc.targetEnvelopeName ? { targetEnvelopeName: doc.targetEnvelopeName } : {}),
    ...(doc.renameLabel ? { renameLabel: doc.renameLabel } : {}),
    addTags: doc.addTags ?? [],
    autoExcludeFromImport: Boolean(doc.autoExcludeFromImport),
    isActive: Boolean(doc.isActive),
    order: doc.order ?? 0,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}
