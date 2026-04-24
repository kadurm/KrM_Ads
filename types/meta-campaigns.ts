/**
 * Meta Ads 2026 - Type definitions for Andromeda & GEM ecosystem
 * Updated with Graceful Degradation (Optional Properties)
 */

export type MetaStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
export type CapiStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DISCONNECTED';

export interface MetaCampaign {
  // Guaranteed Fields (Legacy & 2026)
  id: string;
  name: string;
  status: MetaStatus;
  objective: string;
  
  // Optional Legacy Fields
  effective_status?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  updated_time?: string;
  
  // 2026 Infrastructure Fields (Optional for Legacy Support)
  advantage_plus_budget?: boolean;
  multi_advertiser_ads_enabled?: boolean;
  is_synthetic_content?: boolean;
  
  // Andromeda Metrics (Optional for Legacy Support)
  capi_status?: CapiStatus;
  creative_fatigue_score?: number; // 0-100
  cpmr?: number; // Cost Per Meaningful Result
  hook_rate?: number; // Percentage
  
  // Predictive Analytics (Optional)
  predictive_roas?: number;
  conversion_probability?: number;
  
  // Relationships (Optional)
  campaign_id?: string;
  adset_id?: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
  
  // Real-time Insights (Optional Fallbacks)
  spend?: number;
  results?: number;
  ctr?: number;
  impressions?: number;
}

export interface MetaAPIResponse {
  success: boolean;
  items?: MetaCampaign[];
  error?: string;
}
