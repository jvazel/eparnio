import mongoose, { type Document, Schema, type Types } from 'mongoose';

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface ITransaction extends Document {
  budgetId: Types.ObjectId;
  budgetPeriodId: Types.ObjectId;
  envelopeId: Types.ObjectId;
  authorId: Types.ObjectId;
  paidByUserId: Types.ObjectId;
  type: TransactionType;
  amount: number;
  label: string;
  date: Date;
  notes?: string;
  tags?: string[];
  splitGroupId?: string;
  isAnomalyDismissed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionResponse {
  id: string;
  budgetId: string;
  budgetPeriodId: string;
  envelopeId: string;
  authorId: string;
  paidByUserId: string;
  type: TransactionType;
  amount: number;
  label: string;
  date: string;
  notes?: string;
  tags?: string[];
  splitGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

const transactionSchema = new Schema<ITransaction>(
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
    envelopeId: {
      type: Schema.Types.ObjectId,
      ref: 'Envelope',
      required: true
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    paidByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['expense', 'income', 'transfer'],
      default: 'expense'
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300
    },
    tags: {
      type: [String],
      default: []
    },
    splitGroupId: {
      type: String,
      index: true
    },
    isAnomalyDismissed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ budgetPeriodId: 1, date: -1 });
transactionSchema.index({ envelopeId: 1, date: -1 });
transactionSchema.index({ budgetId: 1, date: -1 });
transactionSchema.index({ budgetId: 1, tags: 1 });

/**
 * Sérialise une transaction Mongoose pour la réponse JSON de l'API.
 */
export function toTransactionResponse(transaction: ITransaction): TransactionResponse {
  return {
    id: transaction._id.toString(),
    budgetId: transaction.budgetId.toString(),
    budgetPeriodId: transaction.budgetPeriodId.toString(),
    envelopeId: transaction.envelopeId.toString(),
    authorId: transaction.authorId.toString(),
    paidByUserId: transaction.paidByUserId.toString(),
    type: transaction.type,
    amount: transaction.amount,
    label: transaction.label,
    date: transaction.date.toISOString(),
    ...(transaction.notes ? { notes: transaction.notes } : {}),
    ...(transaction.tags && transaction.tags.length > 0 ? { tags: transaction.tags } : {}),
    ...(transaction.splitGroupId ? { splitGroupId: transaction.splitGroupId } : {}),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
}

export const TransactionModel = mongoose.model<ITransaction>('Transaction', transactionSchema);
