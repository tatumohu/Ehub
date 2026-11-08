export type ProjectContractType = 'participation' | 'completion' | 'joint_business';

export type LegalContractType = 
  | 'outsourcing_quasi_mandate' // 準委任（Project参加型基本）
  | 'outsourcing_contract'      // 請負（成果完成型基本）
  | 'joint_venture'             // 共同事業・組合的協業（共同事業型基本）
  | 'other';

export type CompensationType = 'fixed' | 'performance' | 'revenue_share' | 'negotiable';

export type ContractStatus = 'draft' | 'proposed' | 'agreed' | 'awaiting_payment' | 'active' | 'service_completed' | 'payout_completed' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'transferred' | 'refunded';

export interface PricingConfig {
  freeAiVisionMonthlyLimit: number;
  proMonthlyFee: number;
  orgLightMonthlyFee: number;
  orgStandardMonthlyFee: number;
  orgEnterpriseMonthlyFee: number;
  govBasicMonthlyFee: number;
  govStandardMonthlyFee: number;
  govEnterpriseMonthlyFee: number | string;
  projectOrgFeeRate: number; // 0.05 (5%)
  projectIndFeeRate: number; // 0.00 (0%)
  storeFeeRate: number;      // 0.10 (10%)
  buyoutFeeRate: number;     // 0.05 (5%)
}

export interface UserSubscription {
  id: number;
  user_id: number;
  plan: 'free' | 'pro' | 'light' | 'standard' | 'enterprise';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
}

export interface AIUsageStatus {
  feature: string;
  usage_count: number;
  monthly_limit: number;
  remaining: number;
  is_pro: boolean;
  can_generate_image: boolean;
  can_use_ai_vision: boolean;
}

export interface ProjectContract {
  id: number;
  project_id?: number | null;
  idea_id?: number | null;
  organization_account_id: number;
  individual_account_id: number;
  
  // Basic & Classification
  project_contract_type: ProjectContractType;
  legal_contract_type: LegalContractType;
  title: string;
  role?: string;
  objective?: string;
  scope_of_work?: string;
  deliverables?: string;
  delivery_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  duration?: string;
  activity_scale?: string;

  // Rewards & Money (項目13, 14: 個人側0%受取、組織側5%成功報酬)
  compensation_types: string | string[]; // JSON string or parsed array
  gross_amount: number; // 個人の契約報酬 (100%全額)
  platform_fee_rate: number; // 0.05 (組織側5%)
  platform_fee_amount: number; // 組織側手数料 (gross_amount * 0.05)
  organization_total_amount: number; // 組織支払合計 (gross_amount + platform_fee_amount)
  individual_net_amount: number; // 個人受取金額 (gross_amount * 1.00 = 100%)
  initial_reward_amount?: number;
  performance_reward_amount?: number;
  revenue_share_rate?: number;
  revenue_share_period?: string;
  revenue_share_target?: string;
  cost_burden?: string;
  ip_rights?: string;
  termination_conditions?: string;

  // Terms & Conditions
  payment_cycle?: string;
  payment_due_date?: string;
  inspection_conditions?: string;
  nda_required?: number;
  nda_body?: string;
  contract_body?: string;
  currency?: string;

  // Lifecycle & Signatures
  organization_agreed_at?: string | null;
  individual_agreed_at?: string | null;
  paid_at?: string | null;
  contract_started_at?: string | null;
  service_completed_at?: string | null;
  individual_payment_at?: string | null;
  contract_status: ContractStatus;
  payment_status: PaymentStatus;
  stripe_payment_id?: string | null;
  stripe_transfer_id?: string | null;
  contract_version: number;
  created_at: string;
  updated_at: string;

  // Joined fields
  organization_name?: string;
  organization_avatar?: string;
  organization_account_type?: string;
  individual_name?: string;
  individual_avatar?: string;
  individual_stripe_account_id?: string;
  project_title?: string;
  idea_title?: string;
  requires_offplatform_procedure?: number;

  versions?: ProjectContractVersion[];
  auditLogs?: ProjectContractAuditLog[];
}

export interface ProjectContractVersion {
  id: number;
  contract_id: number;
  contract_version: number;
  changed_by_user_id: number;
  changed_by_name?: string;
  snapshot_json: string;
  change_summary?: string;
  created_at: string;
}

export interface ProjectContractAuditLog {
  id: number;
  contract_id: number;
  user_id: number;
  user_name?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}
