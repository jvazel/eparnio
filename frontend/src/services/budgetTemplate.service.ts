import { apiClient } from './api';

export type TemplateItemPillar = 'variable_envelope' | 'savings';

export interface BudgetTemplateItem {
  pillar: TemplateItemPillar;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  linkedGoalId?: string;
  rolloverEnabled?: boolean;
  rolloverMode?: 'positive_only' | 'both';
  order?: number;
}

export interface BudgetTemplate {
  id: string;
  budgetId: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  items: BudgetTemplateItem[];
  totalVariableAmount: number;
  totalSavingsAmount: number;
  totalAllocatedAmount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateChangeEntry {
  pillar: TemplateItemPillar;
  name: string;
  icon: string;
  color: string;
  status: 'updated' | 'created' | 'reset_to_zero' | 'unchanged';
  previousAmount: number;
  newAmount: number;
  deltaAmount: number;
  spentOrPaidAmount: number;
  exceedsSpent: boolean;
  resetToZero: boolean;
  envelopeId?: string;
}

export interface TemplateSummarySnapshot {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedEnvelopes: number;
  plannedSavings: number;
  spentVariables: number;
  remainingToAllocate: number;
  remainingToLive: number;
}

export interface ApplyTemplateResult {
  dryRun: boolean;
  template: BudgetTemplate;
  changes: TemplateChangeEntry[];
  summaryBefore: TemplateSummarySnapshot;
  summaryAfter: TemplateSummarySnapshot;
  warnings: string[];
}

export async function fetchBudgetTemplates(budgetId: string): Promise<BudgetTemplate[]> {
  const { data } = await apiClient.get<{ status: string; templates: BudgetTemplate[] }>(
    `/budgets/${budgetId}/templates`
  );
  return data.templates;
}

export async function createBudgetTemplate(
  budgetId: string,
  payload: {
    name: string;
    icon?: string;
    color?: string;
    description?: string;
    sourcePeriodId?: string;
    items?: BudgetTemplateItem[];
  }
): Promise<BudgetTemplate> {
  const { data } = await apiClient.post<{ status: string; template: BudgetTemplate }>(
    `/budgets/${budgetId}/templates`,
    payload
  );
  return data.template;
}

export async function updateBudgetTemplate(
  budgetId: string,
  templateId: string,
  payload: {
    name?: string;
    icon?: string;
    color?: string;
    description?: string | null;
    items?: BudgetTemplateItem[];
  }
): Promise<BudgetTemplate> {
  const { data } = await apiClient.patch<{ status: string; template: BudgetTemplate }>(
    `/budgets/${budgetId}/templates/${templateId}`,
    payload
  );
  return data.template;
}

export async function deleteBudgetTemplate(
  budgetId: string,
  templateId: string
): Promise<void> {
  await apiClient.delete(`/budgets/${budgetId}/templates/${templateId}`);
}

export async function applyBudgetTemplate(
  periodId: string,
  templateId: string,
  dryRun = false
): Promise<ApplyTemplateResult> {
  const { data } = await apiClient.post<{ status: string } & ApplyTemplateResult>(
    `/periods/${periodId}/apply-template`,
    { templateId, dryRun }
  );
  return {
    dryRun: data.dryRun,
    template: data.template,
    changes: data.changes,
    summaryBefore: data.summaryBefore,
    summaryAfter: data.summaryAfter,
    warnings: data.warnings
  };
}
