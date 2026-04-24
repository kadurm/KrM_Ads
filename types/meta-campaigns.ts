/**
 * Meta Ads 2026 - Type definitions for Andromeda & GEM ecosystem
 */

export type MetaStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
export type CapiStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DISCONNECTED';

export interface MetaCampaign {
  id: string;
  name: string;
  status: MetaStatus;
  effective_status?: string;
  objective: string;
  daily_budget?: number;
  lifetime_budget?: number;
  updated_time?: string;
  
  // 2026 Infrastructure Fields
  advantage_plus_budget: boolean;
  multi_advertiser_ads_enabled: boolean;
  is_synthetic_content: boolean;
  
  // Andromeda Metrics
  capi_status: CapiStatus;
  creative_fatigue_score: number; // 0-100
  cpmr: number; // Cost Per Meaningful Result
  hook_rate: number; // Percentage
  
  // Predictive Analytics
  predictive_roas?: number;
  conversion_probability?: number;
  
  // Relationships
  campaign_id?: string;
  adset_id?: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
  
  // Real-time Insights
  spend: number;
  results: number;
  ctr: number;
  impressions: number;
}

export interface MetaAPIResponse {
  success: boolean;
  items?: MetaCampaign[];
  error?: string;
}
