import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';
import {
  type BudgetMemberProfileInfo,
  BudgetModel,
  type BudgetResponse,
  type ContributionMode,
  type IBudget,
  toBudgetResponse
} from '../models/Budget.model';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { UserModel } from '../models/User.model';
import { assertBudgetAccess } from './budgetAccess.service';
import { recalculatePeriodSummary } from './remainingToLive.service';
import { roundCurrency } from './zeroBasedBudget.service';

export const MEMBER_COLOR_PALETTE = [
  '#7C3AED',
  '#EC4899',
  '#06B6D4',
  '#16A34A',
  '#F59E0B',
  '#3B82F6',
  '#EF4444',
  '#8B5CF6'
] as const;

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_TTL_MS = env.INVITE_CODE_TTL_HOURS * 60 * 60 * 1000;

export interface ContributionSplitMemberResult {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  color: string;
  role: string;
  declaredMonthlyIncome: number;
  sharePercentage: number;
  recommendedContribution: number;
}

export interface ContributionSplitResult {
  mode: ContributionMode;
  targetAmount: number;
  totalDeclaredIncome: number;
  members: ContributionSplitMemberResult[];
}

export interface CalculateSplitMemberInput {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  color: string;
  role: string;
  declaredMonthlyIncome: number;
  customAmount?: number;
}

async function fetchUserProfilesMap(
  userIds: string[]
): Promise<Map<string, BudgetMemberProfileInfo>> {
  const uniqueObjectIds = Array.from(new Set(userIds))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const profilesMap = new Map<string, BudgetMemberProfileInfo>();
  if (uniqueObjectIds.length === 0) {
    return profilesMap;
  }

  const users = await UserModel.find({ _id: { $in: uniqueObjectIds } })
    .select('displayName avatarEmoji email')
    .lean();

  for (const user of users) {
    profilesMap.set(user._id.toString(), {
      displayName: user.displayName,
      avatarEmoji: user.avatarEmoji,
      email: user.email
    });
  }

  return profilesMap;
}

/**
 * Sérialise un budget en enrichissant ses membres avec leurs profils utilisateur.
 */
export async function buildBudgetResponseWithUsers(budget: IBudget): Promise<BudgetResponse> {
  const profiles = await fetchUserProfilesMap(budget.members.map((m) => m.userId.toString()));
  return toBudgetResponse(budget, profiles);
}

/**
 * Sérialise une liste de budgets en mutualisant le chargement des profils membres.
 */
export async function buildBudgetsListResponseWithUsers(
  budgets: IBudget[]
): Promise<BudgetResponse[]> {
  const allUserIds = budgets.flatMap((budget) => budget.members.map((m) => m.userId.toString()));
  const profiles = await fetchUserProfilesMap(allUserIds);
  return budgets.map((budget) => toBudgetResponse(budget, profiles));
}

function buildRandomCode(): string {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const idx = bytes[i] % INVITE_CODE_ALPHABET.length;
    code += INVITE_CODE_ALPHABET[idx];
  }
  return code;
}

/**
 * Génère un code d'invitation alphanumérique unique de 8 caractères.
 */
export async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = buildRandomCode();
    const exists = await BudgetModel.exists({ inviteCode: candidate });
    if (!exists) {
      return candidate;
    }
  }
  return `${buildRandomCode()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/**
 * Génère ou régénère le code d'invitation d'un espace budgétaire (révoque l'ancien lien).
 */
export async function generateOrRegenerateInviteCode(
  budgetId: string,
  actorUserId?: string
): Promise<{ budget: BudgetResponse; inviteCode: string; inviteExpiresAt: string }> {
  const { budget } = await assertBudgetAccess(budgetId, actorUserId, { requireWrite: true });

  const inviteCode = await generateUniqueInviteCode();
  const inviteExpiresAt = new Date(Date.now() + INVITE_CODE_TTL_MS);
  budget.inviteCode = inviteCode;
  budget.inviteExpiresAt = inviteExpiresAt;
  budget.type = 'shared';
  await budget.save();

  return {
    budget: await buildBudgetResponseWithUsers(budget),
    inviteCode,
    inviteExpiresAt: inviteExpiresAt.toISOString()
  };
}

function pickDistinctMemberColor(usedColors: string[]): string {
  const normalizedUsed = new Set(usedColors.map((c) => c.toUpperCase()));
  const unused = MEMBER_COLOR_PALETTE.find((color) => !normalizedUsed.has(color.toUpperCase()));
  if (unused) {
    return unused;
  }
  return MEMBER_COLOR_PALETTE[usedColors.length % MEMBER_COLOR_PALETTE.length];
}

/**
 * Ajoute l'utilisateur connecté comme éditeur à un budget partagé via son code d'invitation.
 */
export async function joinBudgetByInviteCode(
  rawInviteCode: string,
  userId?: string
): Promise<{ budget: BudgetResponse; alreadyMember: boolean }> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new AppError('Authentification requise pour rejoindre un espace budgétaire', 401);
  }

  const normalizedCode = rawInviteCode.trim().toUpperCase();
  const budget = await BudgetModel.findOne({ inviteCode: normalizedCode });
  if (!budget) {
    throw new AppError('Code d’invitation invalide ou expiré', 404);
  }

  if (budget.inviteExpiresAt && budget.inviteExpiresAt.getTime() < Date.now()) {
    throw new AppError(
      `Ce code d’invitation a expiré (validité ${env.INVITE_CODE_TTL_HOURS}h). Demandez un nouveau code au propriétaire.`,
      410
    );
  }

  const alreadyMember = budget.members.some((member) => member.userId.toString() === userId);
  if (alreadyMember) {
    return {
      budget: await buildBudgetResponseWithUsers(budget),
      alreadyMember: true
    };
  }

  const assignedColor = pickDistinctMemberColor(budget.members.map((m) => m.color));
  budget.members.push({
    userId: new Types.ObjectId(userId),
    role: 'editor',
    color: assignedColor,
    declaredMonthlyIncome: 0,
    joinedAt: new Date()
  });
  budget.type = 'shared';
  await budget.save();

  return {
    budget: await buildBudgetResponseWithUsers(budget),
    alreadyMember: false
  };
}

function roundPercentage(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Calcule les quotes-parts (%) et apports mensuels recommandés (€) selon le mode choisi.
 */
export function calculateContributionSplit(input: {
  mode: ContributionMode;
  targetAmount: number;
  members: CalculateSplitMemberInput[];
}): ContributionSplitResult {
  const safeTarget = roundCurrency(Math.max(0, input.targetAmount));
  const totalDeclaredIncome = roundCurrency(
    input.members.reduce((acc, m) => acc + Math.max(0, m.declaredMonthlyIncome), 0)
  );

  if (input.members.length === 0) {
    return {
      mode: input.mode,
      targetAmount: safeTarget,
      totalDeclaredIncome: 0,
      members: []
    };
  }

  let weights: number[];
  if (input.mode === 'equal_50_50') {
    weights = input.members.map(() => 1);
  } else if (input.mode === 'income_prorata') {
    const incomeWeights = input.members.map((m) => Math.max(0, m.declaredMonthlyIncome));
    const incomeSum = incomeWeights.reduce((acc, w) => acc + w, 0);
    weights = incomeSum > 0 ? incomeWeights : input.members.map(() => 1);
  } else {
    const customWeights = input.members.map((m) => Math.max(0, m.customAmount ?? 0));
    const customSum = customWeights.reduce((acc, w) => acc + w, 0);
    if (customSum > 0) {
      weights = customWeights;
    } else {
      const incomeWeights = input.members.map((m) => Math.max(0, m.declaredMonthlyIncome));
      const incomeSum = incomeWeights.reduce((acc, w) => acc + w, 0);
      weights = incomeSum > 0 ? incomeWeights : input.members.map(() => 1);
    }
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let remainingPercent = 100;
  let remainingAmount = safeTarget;

  const members: ContributionSplitMemberResult[] = input.members.map((member, index) => {
    const isLast = index === input.members.length - 1;
    const ratio = totalWeight > 0 ? weights[index] / totalWeight : 1 / input.members.length;

    const sharePercentage = isLast
      ? roundPercentage(Math.max(0, remainingPercent))
      : roundPercentage(ratio * 100);
    remainingPercent = roundPercentage(remainingPercent - sharePercentage);

    const recommendedContribution = isLast
      ? roundCurrency(Math.max(0, remainingAmount))
      : roundCurrency(safeTarget * ratio);
    remainingAmount = roundCurrency(remainingAmount - recommendedContribution);

    return {
      userId: member.userId,
      displayName: member.displayName,
      avatarEmoji: member.avatarEmoji,
      color: member.color,
      role: member.role,
      declaredMonthlyIncome: roundCurrency(Math.max(0, member.declaredMonthlyIncome)),
      sharePercentage,
      recommendedContribution
    };
  });

  return {
    mode: input.mode,
    targetAmount: safeTarget,
    totalDeclaredIncome,
    members
  };
}

export interface UpdateContributionSplitInput {
  contributionMode: ContributionMode;
  targetAmount?: number;
  periodId?: string;
  applyToPeriod?: boolean;
  members?: Array<{
    userId: string;
    declaredMonthlyIncome?: number;
    role?: 'editor' | 'viewer';
    customAmount?: number;
  }>;
}

/**
 * Met à jour le mode de répartition (50/50, prorata, personnalisé), les revenus déclarés
 * et applique optionnellement les apports calculés sur la période budgétaire cible.
 */
export async function updateBudgetContributionSplit(
  budgetId: string,
  actorUserId: string | undefined,
  payload: UpdateContributionSplitInput
): Promise<{
  budget: BudgetResponse;
  split: ContributionSplitResult;
  period?: IBudgetPeriod;
}> {
  const { budget } = await assertBudgetAccess(budgetId, actorUserId, { requireWrite: true });

  const isOwner = actorUserId === budget.ownerId.toString();
  const payloadMembersMap = new Map((payload.members ?? []).map((item) => [item.userId, item]));

  budget.contributionMode = payload.contributionMode;

  for (const member of budget.members) {
    const update = payloadMembersMap.get(member.userId.toString());
    if (!update) continue;

    if (update.declaredMonthlyIncome !== undefined) {
      member.declaredMonthlyIncome = roundCurrency(Math.max(0, update.declaredMonthlyIncome));
    }

    if (update.role !== undefined && member.role !== 'owner' && isOwner) {
      member.role = update.role;
    }
  }

  await budget.save();

  const targetPeriod = payload.periodId
    ? await BudgetPeriodModel.findOne({ _id: payload.periodId, budgetId: budget._id })
    : await BudgetPeriodModel.findOne({ budgetId: budget._id }).sort({ year: -1, month: -1 });

  let resolvedTargetAmount = payload.targetAmount;
  if (resolvedTargetAmount === undefined) {
    if (payload.contributionMode === 'custom' && payload.members?.some((m) => m.customAmount)) {
      resolvedTargetAmount = roundCurrency(
        payload.members.reduce((acc, m) => acc + Math.max(0, m.customAmount ?? 0), 0)
      );
    } else if (targetPeriod) {
      resolvedTargetAmount = roundCurrency(
        targetPeriod.summary.plannedFixedCharges +
          targetPeriod.summary.plannedEnvelopes +
          targetPeriod.summary.plannedSavings
      );
    } else {
      resolvedTargetAmount = 0;
    }
  }

  const profiles = await fetchUserProfilesMap(budget.members.map((m) => m.userId.toString()));

  const split = calculateContributionSplit({
    mode: budget.contributionMode,
    targetAmount: resolvedTargetAmount,
    members: budget.members.map((member, index) => {
      const uid = member.userId.toString();
      const profile = profiles.get(uid);
      const customAmount = payloadMembersMap.get(uid)?.customAmount;
      return {
        userId: uid,
        displayName: profile?.displayName ?? `Membre ${index + 1}`,
        avatarEmoji: profile?.avatarEmoji ?? '🧑',
        color: member.color,
        role: member.role,
        declaredMonthlyIncome: member.declaredMonthlyIncome,
        ...(customAmount !== undefined ? { customAmount } : {})
      };
    })
  });

  let updatedPeriod: IBudgetPeriod | undefined;

  if (payload.applyToPeriod && targetPeriod) {
    for (let index = 0; index < split.members.length; index += 1) {
      const item = split.members[index];
      const memberObjectId = new Types.ObjectId(item.userId);
      const existingApport = await EnvelopeModel.findOne({
        budgetPeriodId: targetPeriod._id,
        pillar: 'income',
        memberId: memberObjectId,
        name: { $regex: /^Apport\s/i }
      });

      if (existingApport) {
        existingApport.allocatedAmount = item.recommendedContribution;
        existingApport.name = `Apport ${item.displayName}`;
        existingApport.color = item.color;
        await existingApport.save();
      } else if (item.recommendedContribution > 0) {
        await EnvelopeModel.create({
          budgetId: budget._id,
          budgetPeriodId: targetPeriod._id,
          pillar: 'income',
          name: `Apport ${item.displayName}`,
          icon: '💵',
          color: item.color,
          allocatedAmount: item.recommendedContribution,
          spentOrPaidAmount: 0,
          date: targetPeriod.startDate,
          isRecurring: true,
          isPaid: false,
          memberId: memberObjectId,
          order: index
        });
      }
    }

    updatedPeriod = await recalculatePeriodSummary(targetPeriod._id);
  }

  return {
    budget: toBudgetResponse(budget, profiles),
    split,
    ...(updatedPeriod ? { period: updatedPeriod } : {})
  };
}

/**
 * Retire un membre d'un espace budgétaire partagé (propriétaire ou départ volontaire).
 */
export async function removeBudgetMember(
  budgetId: string,
  actorUserId: string | undefined,
  targetUserId: string
): Promise<{ budget: BudgetResponse; removedUserId: string }> {
  const { budget } = await assertBudgetAccess(budgetId, actorUserId);

  if (targetUserId === budget.ownerId.toString()) {
    throw new AppError(
      'Le propriétaire principal ne peut pas être retiré de son espace budgétaire',
      400
    );
  }

  const targetIndex = budget.members.findIndex(
    (member) => member.userId.toString() === targetUserId
  );
  if (targetIndex === -1) {
    throw new AppError('Membre introuvable dans cet espace budgétaire', 404);
  }

  const isOwner = actorUserId === budget.ownerId.toString();
  const isSelfLeaving = actorUserId === targetUserId;
  if (!isOwner && !isSelfLeaving) {
    throw new AppError('Seul le propriétaire peut retirer un autre membre de cet espace', 403);
  }

  budget.members.splice(targetIndex, 1);
  await budget.save();

  return {
    budget: await buildBudgetResponseWithUsers(budget),
    removedUserId: targetUserId
  };
}
