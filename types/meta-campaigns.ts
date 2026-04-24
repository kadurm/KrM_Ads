/**
 * Meta Ads 2026 - Campaign Typing
 * Andromeda & Meta GEM Integration
 */

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: string;
  daily_budget?: number;
  lifetime_budget?: number;
  spend: number;
  results: number;
  
  // 2026 Core Infrastructure
  advantage_plus_budget: boolean; // CBO Evolution
  multi_advertiser_ads_enabled: boolean;
  is_synthetic_content: boolean; // Meta GEM Flag
  
  // Advanced Andromeda Metrics
  capi_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  creative_fatigue_score: number; // 0-100
  cpmr: number; // Cost Per Meaningful Result
  hook_rate: number; // Percentage
  
  // Predictive Andromeda Layer
  predictive_roas?: number;
  conversion_probability?: number;
  ad_quality_index?: number;

  creative?: {
    id: string;
    thumbnail_url?: string;
    is_gem_generated?: boolean;
  };
}

export interface MetaAdSet extends MetaCampaign {
  campaign_id: string;
}

export interface MetaAd extends MetaCampaign {
  adset_id: string;
}
