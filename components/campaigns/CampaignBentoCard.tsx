"use client";

import React from 'react';
import { 
  Play, Pause, ShieldCheck, Zap, Activity, AlertTriangle, Fingerprint 
} from 'lucide-react';
import { MetaCampaign } from '@/types/meta-campaigns';
import AndromedaPredictiveChart from './AndromedaPredictiveChart';

/**
 * Meta Ads 2026 - Campaign Bento Card
 * Updated with Graceful Degradation & Optional Chaining
 */

interface Props {
  campaign: MetaCampaign;
  onUpdate: (id: string, updates: Partial<MetaCampaign>) => Promise<void>;
  onNavigate?: (id: string) => void;
}

export const CampaignBentoCard: React.FC<Props> = ({ campaign, onUpdate, onNavigate }) => {
  // Safe Metrics with Fallbacks
  const cpmr = campaign.cpmr ?? 0;
  const hookRate = campaign.hook_rate ?? 0;
  const fatigueScore = campaign.creative_fatigue_score ?? 0;
  const isCritical = cpmr > 30;

  return (
    <div className={`
      group relative p-6 rounded-[2rem] bg-slate-900/40 backdrop-blur-3xl border transition-all duration-500
      ${isCritical ? 'border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'border-slate-800 hover:border-slate-700'}
      hover:scale-[1.02] active:scale-[0.98]
    `}>
      
      {/* GLOW EFFECT */}
      <div className={`absolute inset-0 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-blue-600/5 to-transparent`} />

      <div className="relative z-10 space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-slate-950 rounded-full text-[7px] font-black text-slate-500 uppercase tracking-widest border border-slate-800">
                {campaign.objective || 'TRAFFIC'}
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1 h-1 rounded-full ${campaign.capi_status === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-700'}`} />
                <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">CAPI</span>
              </div>
            </div>
            <h3 
              onClick={() => onNavigate?.(campaign.id)}
              className="text-base font-black text-white tracking-tighter uppercase leading-tight cursor-pointer hover:text-blue-400 transition-colors"
            >
              {campaign.name || 'Untitled Campaign'}
            </h3>
          </div>

          <button 
            onClick={() => onUpdate(campaign.id, { status: campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${campaign.status === 'ACTIVE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-950 text-slate-700 border border-slate-800'}`}
          >
            {campaign.status === 'ACTIVE' ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>
        </div>

        {/* 2026 METRICS (With Placeholders) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[7px] font-black uppercase tracking-widest text-slate-600">
              <span>Hook Rate</span>
              <span className="text-blue-400">{campaign.hook_rate !== undefined ? `${hookRate.toFixed(1)}%` : '—'}</span>
            </div>
            <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${hookRate}%` }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[7px] font-black uppercase tracking-widest text-slate-600">
              <span>Ad Fatigue</span>
              <span className={fatigueScore > 70 ? 'text-red-500' : 'text-emerald-500'}>
                {campaign.creative_fatigue_score !== undefined ? `${fatigueScore}%` : 'N/A'}
              </span>
            </div>
            <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div className={`h-full transition-all duration-1000 ${fatigueScore > 70 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${fatigueScore}%` }} />
            </div>
          </div>
        </div>
        
        {/* PREDICTIVE FLOW CHART */}
        <AndromedaPredictiveChart campaign={campaign} />

        {/* CPMR ALERT PANEL */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${isCritical ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-950/40 border-slate-800'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCritical ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
               {isCritical ? <AlertTriangle size={14} /> : <Activity size={14} />}
            </div>
            <div>
              <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">CPMr Andromeda</p>
              <p className={`text-base font-black ${isCritical ? 'text-amber-500' : 'text-white'}`}>
                {campaign.cpmr !== undefined ? `R$ ${cpmr.toFixed(2)}` : 'R$ 0.00'}
              </p>
            </div>
          </div>
          {isCritical && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />}
        </div>

        {/* GEM CONTROLS (Safety Guaranteed) */}
        <div className="pt-3 grid grid-cols-2 gap-3 border-t border-slate-800/50">
          <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800">
             <ShieldCheck size={12} className={campaign.multi_advertiser_ads_enabled ? 'text-blue-500' : 'text-slate-700'} />
             <button 
               onClick={() => onUpdate(campaign.id, { multi_advertiser_ads_enabled: !campaign.multi_advertiser_ads_enabled })}
               className={`w-6 h-3 rounded-full relative transition-all ${campaign.multi_advertiser_ads_enabled ? 'bg-blue-600' : 'bg-slate-800'}`}
             >
               <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${campaign.multi_advertiser_ads_enabled ? 'right-0.5' : 'left-0.5'}`} />
             </button>
          </div>
          <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800">
             <Fingerprint size={12} className={campaign.is_synthetic_content ? 'text-purple-500' : 'text-slate-700'} />
             <input 
               type="checkbox"
               checked={!!campaign.is_synthetic_content}
               onChange={() => onUpdate(campaign.id, { is_synthetic_content: !campaign.is_synthetic_content })}
               className="w-3 h-3 rounded border-slate-800 bg-slate-900 checked:bg-purple-600 focus:ring-0 transition-all cursor-pointer"
             />
          </div>
        </div>

        {/* BUDGET INPUT */}
        <div className="relative group/input">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black text-[10px]">R$</span>
          <input 
            type="number" 
            value={campaign.daily_budget || 0}
            onChange={(e) => onUpdate(campaign.id, { daily_budget: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 pl-10 text-[10px] font-black text-blue-400 outline-none focus:border-blue-500/50 transition-all"
          />
          <Zap size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-800 group-hover/input:text-blue-500" />
        </div>

      </div>
    </div>
  );
};
