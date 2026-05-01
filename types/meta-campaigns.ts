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
  bid_strategy?: string;
  
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
  creative?: MetaAdCreative;
  
  // Real-time Insights (Optional Fallbacks)
  spend?: number;
  results?: number;
  ctr?: number;
  impressions?: number;

  // Andromeda Historical Data
  historical_insights?: {
    date: string;
    spend: number;
    purchase_roas: number;
    results: number;
  }[];

  // ANTIGRAVITY Advanced Config (Graph API 1:1)
  targeting?: MetaAdSetTargeting;
  promoted_object?: MetaPromotedObject;
  billing_event?: string;
  optimization_goal?: string;
  bid_amount?: number;
  start_time?: string;
  end_time?: string;
}

export interface MetaAdSetTargeting {
  geo_locations?: {
    countries?: string[];
    regions?: { key: string }[];
    cities?: { key: string, distance_unit: string, radius: number }[];
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1=Male, 2=Female
  flexible_spec?: {
    interests?: { id: string, name: string }[];
    behaviors?: { id: string, name: string }[];
  }[];
  custom_audiences?: { id: string, name?: string }[];
  excluded_custom_audiences?: { id: string, name?: string }[];
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  device_platforms?: string[];
}

export interface MetaAdCreative {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  object_story_spec?: {
    page_id: string;
    instagram_actor_id?: string;
    link_data?: {
      link: string;
      message: string;
      image_hash?: string;
      video_id?: string;
      call_to_action?: {
        type: string;
        value?: { link: string };
      };
    };
  };
}

export interface MetaPromotedObject {
  pixel_id?: string;
  custom_event_type?: string;
  page_id?: string;
}

/**
 * Contract for ANTIGRAVITY Agents
 * This structure is used by the AI to produce configurations.
 */
export interface AntigravityPayload {
  cliente: string;
  type: 'campaign' | 'adset' | 'ad';
  data: Partial<MetaCampaign> & Record<string, any>;
}

export interface MetaAPIResponse {
  success: boolean;
  items?: MetaCampaign[];
  error?: string;
}
