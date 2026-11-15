import mongoose, { type Document, Schema, type Types } from 'mongoose';

export interface ISavingsGoal extends Document {
  budgetId: Types.ObjectId;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  initialAmount: number;
  currentAmount: number;
  deadline?: Date;
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
  order: number;
  createdAt: string;
  updatedAt: string;
}

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
    order: goal.order,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString()
  };
}

export const SavingsGoalModel = mongoose.model<ISavingsGoal>('SavingsGoal', savingsGoalSchema);
