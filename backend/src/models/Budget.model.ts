import mongoose, { type Document, Schema, type Types } from 'mongoose';

export type BudgetType = 'personal' | 'shared';
export type ContributionMode = 'equal_50_50' | 'income_prorata' | 'custom';
export type BudgetMemberRole = 'owner' | 'editor' | 'viewer';

export interface IBudgetMember {
  userId: Types.ObjectId;
  role: BudgetMemberRole;
  color: string;
  declaredMonthlyIncome: number;
  joinedAt: Date;
}

export interface IQuickTemplate {
  _id: mongoose.Types.ObjectId;
  label: string;
  envelopeName: string;
  defaultAmount?: number;
  order: number;
}

export interface IBudget extends Document {
  name: string;
  type: BudgetType;
  ownerId: Types.ObjectId;
  contributionMode: ContributionMode;
  members: IBudgetMember[];
  inviteCode?: string;
  inviteExpiresAt?: Date;
  budgetStartDay: number;
  quickTemplates: IQuickTemplate[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetMemberProfileInfo {
  displayName?: string;
  avatarEmoji?: string;
  email?: string;
}

export interface BudgetMemberResponse {
  userId: string;
  role: BudgetMemberRole;
  color: string;
  declaredMonthlyIncome: number;
  joinedAt: string;
  displayName?: string;
  avatarEmoji?: string;
  email?: string;
}

export interface BudgetResponse {
  id: string;
  name: string;
  type: BudgetType;
  ownerId: string;
  contributionMode: ContributionMode;
  members: BudgetMemberResponse[];
  inviteCode?: string;
  inviteExpiresAt?: string;
  budgetStartDay: number;
  quickTemplates: Array<{
    id: string;
    label: string;
    envelopeName: string;
    defaultAmount?: number;
    order: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const budgetMemberSchema = new Schema<IBudgetMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'editor'
    },
    color: {
      type: String,
      default: '#7C3AED'
    },
    declaredMonthlyIncome: {
      type: Number,
      min: 0,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const budgetSchema = new Schema<IBudget>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['personal', 'shared'],
      default: 'personal'
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contributionMode: {
      type: String,
      enum: ['equal_50_50', 'income_prorata', 'custom'],
      default: 'equal_50_50'
    },
    members: {
      type: [budgetMemberSchema],
      default: []
    },
    inviteCode: {
      type: String
    },
    quickTemplates: {
      type: [
        new Schema<IQuickTemplate>(
          {
            label: { type: String, required: true, trim: true },
            envelopeName: { type: String, required: true, trim: true },
            defaultAmount: { type: Number, min: 0 },
            order: { type: Number, default: 0 }
          },
          { _id: true }
        )
      ],
      default: []
    },
    inviteExpiresAt: {
      type: Date
    },
    budgetStartDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

budgetSchema.index({ 'members.userId': 1 });
budgetSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });

/**
 * Sérialise un espace budgétaire Mongoose en objet JSON consommable par le frontend.
 */
export function toBudgetResponse(
  budget: IBudget,
  userProfiles?: Map<string, BudgetMemberProfileInfo>
): BudgetResponse {
  return {
    id: budget._id.toString(),
    name: budget.name,
    type: budget.type,
    ownerId: budget.ownerId.toString(),
    contributionMode: budget.contributionMode,
    members: budget.members.map((member) => {
      const uid = member.userId.toString();
      const profile = userProfiles?.get(uid);
      return {
        userId: uid,
        role: member.role,
        color: member.color,
        declaredMonthlyIncome: member.declaredMonthlyIncome,
        joinedAt: member.joinedAt.toISOString(),
        ...(profile?.displayName ? { displayName: profile.displayName } : {}),
        ...(profile?.avatarEmoji ? { avatarEmoji: profile.avatarEmoji } : {}),
        ...(profile?.email ? { email: profile.email } : {})
      };
    }),
    ...(budget.inviteCode ? { inviteCode: budget.inviteCode } : {}),
    ...(budget.inviteExpiresAt ? { inviteExpiresAt: budget.inviteExpiresAt.toISOString() } : {}),
    budgetStartDay: budget.budgetStartDay,
    quickTemplates: (budget.quickTemplates ?? []).map((tpl) => ({
      id: tpl._id.toString(),
      label: tpl.label,
      envelopeName: tpl.envelopeName,
      ...(tpl.defaultAmount !== undefined ? { defaultAmount: tpl.defaultAmount } : {}),
      order: tpl.order
    })),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString()
  };
}

export const BudgetModel = mongoose.model<IBudget>('Budget', budgetSchema);
