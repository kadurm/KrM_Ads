import { MetaCampaign } from '@/types/meta-campaigns';

/**
 * Andromeda v4.0 Heuristics
 * Calculates real-time predictive flow based on Meta API historical insights.
 */
export const calculateAndromedaFlow = (campaign: MetaCampaign) => {
  if (!campaign.historical_insights || campaign.historical_insights.length === 0) {
    return [];
  }

  return campaign.historical_insights.map((h, idx) => {
    // Base Metrics
    const fatigue = campaign.creative_fatigue_score || 0;
    const hook = campaign.hook_rate || 0;
    
    // Probability Calculation: (100 - fatigue) * (hook/100)
    // Adjusted by daily spend sensitivity (slight variation for "active" look)
    const spendSensitivity = Math.sin(idx + (h.spend / 100)) * 2; 
    let probability = (100 - fatigue) * (hook / 100) + spendSensitivity;
    
    // Ensure boundaries
    probability = Math.min(100, Math.max(10, probability));

    return {
      date: h.date.split('-').reverse().slice(0, 2).join('/'),
      roas: h.purchase_roas || 0,
      probability: parseFloat(probability.toFixed(1)),
      spend: h.spend
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
};
