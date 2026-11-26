import mongoose, { type Document, Schema, type Types } from 'mongoose';

export type AssetCategory =
  | 'cash'
  | 'investment'
  | 'real_estate'
  | 'crypto'
  | 'liability';

export interface AssetHistoryPoint {
  date: Date;
  balance: number;
}

export type AssetOperationType = 'add' | 'withdraw' | 'set' | 'transfer_in' | 'transfer_out';
export type AssetCounterpartyType = 'external' | 'asset' | 'savings_goal' | 'budget_period';

export interface AssetOperation {
  _id?: Types.ObjectId;
  date: Date;
  type: AssetOperationType;
  amount: number;
  label: string;
  balanceAfter: number;
  counterpartyType: AssetCounterpartyType;
  counterpartyId?: string;
  counterpartyName?: string;
}

export interface IAssetAccount extends Document {
  budgetId: Types.ObjectId;
  name: string;
  category: AssetCategory;
  icon: string;
  color: string;
  currentBalance: number;
  isCheckingAccount?: boolean;
  history: AssetHistoryPoint[];
  operations: AssetOperation[];
  createdAt: Date;
  updatedAt: Date;
}

const assetAccountSchema = new Schema<IAssetAccount>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: 'Budget',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    category: {
      type: String,
      enum: ['cash', 'investment', 'real_estate', 'crypto', 'liability'],
      required: true,
      default: 'cash',
    },
    icon: {
      type: String,
      default: '🏦',
      trim: true,
    },
    color: {
      type: String,
      default: '#3B82F6',
      trim: true,
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    isCheckingAccount: {
      type: Boolean,
      default: false,
    },
    history: [
      {
        date: { type: Date, required: true },
        balance: { type: Number, required: true },
      },
    ],
    operations: [
      {
        date: { type: Date, required: true },
        type: {
          type: String,
          enum: ['add', 'withdraw', 'set', 'transfer_in', 'transfer_out'],
          required: true,
        },
        amount: { type: Number, required: true },
        label: { type: String, required: true, trim: true, maxlength: 120 },
        balanceAfter: { type: Number, required: true },
        counterpartyType: {
          type: String,
          enum: ['external', 'asset', 'savings_goal', 'budget_period'],
          default: 'external',
        },
        counterpartyId: { type: String },
        counterpartyName: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const AssetAccountModel = mongoose.model<IAssetAccount>(
  'AssetAccount',
  assetAccountSchema
);
