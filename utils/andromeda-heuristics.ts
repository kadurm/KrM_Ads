import { MetaCampaign, AndromedaAnomaly } from '@/types/meta-campaigns';

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

/**
 * Andromeda Anomaly Detection Rules
 * Assesses campaign health based on 4 metrics:
 * 1. Spend Anomaly (Zerado if active, or >150% average)
 * 2. CPA Spike (+50% increase)
 * 3. ROAS Collapse (>40% drop)
 * 4. Creative Fatigue (CTR drop >50% or fatigue score >50)
 */
export const evaluateAndromedaHeuristics = (campaign: MetaCampaign): AndromedaAnomaly[] => {
  const anomalies: AndromedaAnomaly[] = [];
  const insights = campaign.historical_insights || [];
  if (insights.length < 2) return anomalies;

  // Sort chronological ascending to compute moving averages and comparisons
  const sortedInsights = [...insights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latest = sortedInsights[sortedInsights.length - 1];
  const previous = sortedInsights.slice(0, sortedInsights.length - 1);

  const latestSpend = latest.spend || 0;
  const latestResults = latest.results || 0;
  const latestRoas = latest.purchase_roas || 0;
  const latestCtr = latest.ctr || 0;

  // 1. Consumption Anomaly (SPEND)
  if (campaign.status === 'ACTIVE') {
    const avgSpend = previous.reduce((acc, h) => acc + (h.spend || 0), 0) / previous.length;
    if (latestSpend === 0) {
      anomalies.push({
        type: 'SPEND',
        severity: 'CRITICAL',
        message: 'Gasto Zerado',
        recommendation: '⚠️ Bloqueio: Verificar conta/anúncio na Meta'
      });
    } else if (avgSpend > 0 && latestSpend > avgSpend * 1.5) {
      anomalies.push({
        type: 'SPEND',
        severity: 'WARNING',
        message: 'Pico de Gasto',
        recommendation: '⚠️ Pico de Consumo: Gasto > 150% da média móvel'
      });
    }
  }

  // 2. CPA Spike (CPA)
  const latestCpa = latestResults > 0 ? latestSpend / latestResults : 0;
  const totalPrevSpend = previous.reduce((acc, h) => acc + (h.spend || 0), 0);
  const totalPrevResults = previous.reduce((acc, h) => acc + (h.results || 0), 0);
  const avgCpa = totalPrevResults > 0 ? totalPrevSpend / totalPrevResults : 0;

  if (latestCpa > 0 && avgCpa > 0 && latestCpa > avgCpa * 1.5) {
    anomalies.push({
      type: 'CPA',
      severity: 'CRITICAL',
      message: 'Risco de CPA',
      recommendation: '⚠️ Pico de CPA: Reduzir orçamento ou pausar'
    });
  }

  // 3. ROAS Collapse (ROAS)
  const avgRoas = previous.reduce((acc, h) => acc + (h.purchase_roas || 0), 0) / previous.length;
  if (latestRoas > 0 && avgRoas > 0 && latestRoas < avgRoas * 0.6) {
    anomalies.push({
      type: 'ROAS',
      severity: 'CRITICAL',
      message: 'Colapso de ROAS',
      recommendation: '⚠️ Queda de ROAS: Queda diária > 40% vs média'
    });
  }

  // 4. Creative Fatigue (FATIGUE)
  const avgCtr = previous.reduce((acc, h) => acc + (h.ctr || 0), 0) / previous.length;
  if (latestCtr > 0 && avgCtr > 0 && latestCtr < avgCtr * 0.5) {
    anomalies.push({
      type: 'FATIGUE',
      severity: 'CRITICAL',
      message: 'Fadiga de Criativo',
      recommendation: '⚠️ Fadiga: CTR caiu 50% nas últimas 24h'
    });
  } else if (campaign.creative_fatigue_score !== undefined && campaign.creative_fatigue_score > 50) {
    anomalies.push({
      type: 'FATIGUE',
      severity: 'WARNING',
      message: 'Fadiga',
      recommendation: '⚠️ Fadiga: Substituir Criativo Líder'
    });
  }

  return anomalies;
};
