import mongoose, { type Document, Schema, type Types } from 'mongoose';

export interface ISavingsWithdrawal {
  _id: Types.ObjectId;
  amount: number;
  label: string;
  date: Date;
  memberId?: Types.ObjectId;
  notes?: string;
  createdAt?: Date;
}

export interface SavingsWithdrawalResponse {
  id: string;
  amount: number;
  label: string;
  date: string;
  memberId?: string;
  notes?: string;
  createdAt?: string;
}

export interface ISavingsGoal extends Document {
  budgetId: Types.ObjectId;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  initialAmount: number;
  currentAmount: number;
  deadline?: Date;
  withdrawals: ISavingsWithdrawal[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsGoalResponse {
  id: string;
  budgetId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  initialAmount: number;
  currentAmount: number;
  deadline?: string;
  withdrawals: SavingsWithdrawalResponse[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

const savingsWithdrawalSchema = new Schema<ISavingsWithdrawal>(
  {
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
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const savingsGoalSchema = new Schema<ISavingsGoal>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: 'Budget',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    icon: {
      type: String,
      default: '🐷',
      trim: true
    },
    color: {
      type: String,
      default: '#16A34A',
      trim: true
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0
    },
    initialAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    deadline: {
      type: Date
    },
    withdrawals: {
      type: [savingsWithdrawalSchema],
      default: []
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

savingsGoalSchema.index({ budgetId: 1, order: 1, createdAt: 1 });

/**
 * Sérialise un objectif d'épargne Mongoose pour la réponse JSON de l'API.
 */
export function toSavingsGoalResponse(goal: ISavingsGoal): SavingsGoalResponse {
  const sortedWithdrawals = [...(goal.withdrawals ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    id: goal._id.toString(),
    budgetId: goal.budgetId.toString(),
    name: goal.name,
    icon: goal.icon,
    color: goal.color,
    targetAmount: goal.targetAmount,
    initialAmount: goal.initialAmount ?? 0,
    currentAmount: goal.currentAmount,
    ...(goal.deadline ? { deadline: goal.deadline.toISOString() } : {}),
    withdrawals: sortedWithdrawals.map((item) => ({
      id: item._id.toString(),
      amount: item.amount,
      label: item.label,
      date: new Date(item.date).toISOString(),
      ...(item.memberId ? { memberId: item.memberId.toString() } : {}),
      ...(item.notes ? { notes: item.notes } : {}),
      ...(item.createdAt ? { createdAt: new Date(item.createdAt).toISOString() } : {})
    })),
    order: goal.order,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString()
  };
}

export const SavingsGoalModel = mongoose.model<ISavingsGoal>('SavingsGoal', savingsGoalSchema);
