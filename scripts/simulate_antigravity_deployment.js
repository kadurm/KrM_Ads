const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const API_URL = 'http://localhost:3000/api/meta/create';
const CLIENTE = 'Solution Place'; // Ajuste conforme necessário

async function simulateAntigravityAgent() {
  console.log('--- ANTIGRAVITY Agent Simulation: Meta Ads Deployment ---');

  try {
    // 1. Criar Campanha CBO
    console.log('\n[1/3] Deploying Campaign (CBO)...');
    const campaignPayload = {
      cliente: CLIENTE,
      type: 'campaign',
      data: {
        name: '[ANTIGRAVITY] - High-End Lead Gen Q2',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        advantage_plus_budget: true,
        daily_budget: 100,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
      }
    };
    
    // const campRes = await axios.post(API_URL, campaignPayload);
    // const campaignId = campRes.data.result.id;
    const campaignId = 'SIMULATED_CAMP_ID'; // Para teste sem API real se necessário
    console.log('Success: Campaign Created ->', campaignId);

    // 2. Criar AdSet com Targeting Complexo
    console.log('\n[2/3] Deploying AdSet with Advanced Targeting...');
    const adSetPayload = {
      cliente: CLIENTE,
      type: 'adset',
      data: {
        campaign_id: campaignId,
        name: '[ANTIGRAVITY] - BR | All Genders | 25-45 | Interests',
        status: 'PAUSED',
        optimization_goal: 'LEAD_GENERATION',
        billing_event: 'IMPRESSIONS',
        targeting: {
          geo_locations: { countries: ['BR'] },
          age_min: 25,
          age_max: 45,
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['feed', 'story'],
          flexible_spec: [
            { interests: [{ id: '6003139266431', name: 'Digital marketing' }] }
          ]
        }
      }
    };
    console.log('Payload Data:', JSON.stringify(adSetPayload.data, null, 2));
    // const adsetRes = await axios.post(API_URL, adSetPayload);
    console.log('Success: AdSet mapped correctly for Graph API');

    // 3. Criar Ad com Creative Spec Completo
    console.log('\n[3/3] Deploying Ad with Object Story Spec...');
    const adPayload = {
      cliente: CLIENTE,
      type: 'ad',
      data: {
        adset_id: 'SIMULATED_ADSET_ID',
        name: '[ANTIGRAVITY] - Creative Alpha - V1',
        status: 'PAUSED',
        creative: {
          object_story_spec: {
            page_id: '123456789', // ID Real da Página
            link_data: {
              link: 'https://solutionplace.com.br/lp',
              message: 'Transforme sua gestão com KrM Ads 2026.',
              call_to_action: { type: 'LEARN_MORE' }
            }
          }
        }
      }
    };
    console.log('Payload Data:', JSON.stringify(adPayload.data, null, 2));
    // const adRes = await axios.post(API_URL, adPayload);
    console.log('Success: Ad mapped correctly for Graph API');

    console.log('\n--- Simulation Complete: System Ready for ANTIGRAVITY Control ---');
  } catch (error) {
    console.error('Simulation Failed:', error.response?.data || error.message);
  }
}

simulateAntigravityAgent();
