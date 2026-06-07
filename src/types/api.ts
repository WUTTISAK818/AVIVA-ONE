// src/types/api.ts
/**
 * API Type Definitions
 */

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIContextData {
  project: {
    total_units: number;
    sold_units: number;
    construction_progress: number;
    sellout_forecast?: string;
    revenue_target: number;
  };
  houses: Array<{
    house_number: string;
    status: string;
    delayed_days?: number;
  }>;
  leads: Array<{ status: string }>;
  installments: unknown[];
  pendingClaims: unknown[];
  campaigns: Array<{
    name: string;
    platform: string;
    status: string;
    leads_generated: number;
  }>;
  employees: Array<{ department: string }>;
  empByDept: Record<string, number>;
  newLeads: unknown[];
  bookingLeads: unknown[];
  closedLeads: unknown[];
  delayedHouses: Array<{ house_number: string }>;
  activeCampaigns: Array<{
    name: string;
    platform: string;
  }>;
  totalLeadsCampaign: number;
  transactions?: Array<{
    amount: number;
    created_at: string;
    transaction_type: string;
  }>;
}

export interface AIRequestBody {
  message: string;
  history?: AIMessage[];
}

export interface AIResponseBody {
  response: string;
  error?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    compressionApplied: boolean;
    retryCount: number;
    responseTimeMs: number;
  };
}

export interface UserContext {
  id: string;
  email: string;
  role: string;
  department: string;
  full_name: string;
  isManager: boolean;
}
