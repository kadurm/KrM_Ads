"use client";

import React from 'react';
import { 
  Play, Pause, ShieldCheck, Zap, Activity, AlertTriangle, Fingerprint, ChevronRight 
} from 'lucide-react';
import { MetaCampaign } from '../../types/meta-campaigns';

/**
 * Meta Ads 2026 - Campaign Bento Card
 * Premium Aesthetic with Dynamic Alerts
 */

interface Props {
  campaign: MetaCampaign;
  onUpdate: (id: string, updates: Partial<MetaCampaign>) => Promise<void>;
  onNavigate?: (id: string) => void;
}

export const CampaignBentoCard: React.FC<Props> = ({ campaign, onUpdate, onNavigate }) => {
  const isCritical = campaign.cpmr > 30; // Threshold para borda dinâmica

  return (
    <div className={`
      group relative p-8 rounded-[2.5rem] bg-slate-900/40 backdrop-blur-3xl border transition-all duration-500
      ${isCritical ? 'border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'border-slate-800 hover:border-slate-700'}
      hover:scale-[1.02] active:scale-[0.98]
    `}>
      
      {/* GLOW EFFECT */}
      <div className={`absolute inset-0 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-blue-600/5 to-transparent`} />

      <div className="relative z-10 space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-slate-950 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest border border-slate-800">
                {campaign.objective}
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${campaign.capi_status === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">CAPI</span>
              </div>
            </div>
            <h3 
              onClick={() => onNavigate?.(campaign.id)}
              className="text-xl font-black text-white tracking-tighter uppercase leading-tight cursor-pointer hover:text-blue-400 transition-colors"
            >
              {campaign.name}
            </h3>
          </div>

          <button 
            onClick={() => onUpdate(campaign.id, { status: campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${campaign.status === 'ACTIVE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-950 text-slate-700 border border-slate-800'}`}
          >
            {campaign.status === 'ACTIVE' ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
        </div>

        {/* 2026 METRICS */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
              <span>Hook Rate</span>
              <span className="text-blue-400">{campaign.hook_rate.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${campaign.hook_rate}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
              <span>Ad Fatigue</span>
              <span className={campaign.creative_fatigue_score > 70 ? 'text-red-500' : 'text-emerald-500'}>{campaign.creative_fatigue_score}%</span>
            </div>
            <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div className={`h-full transition-all duration-1000 ${campaign.creative_fatigue_score > 70 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${campaign.creative_fatigue_score}%` }} />
            </div>
          </div>
        </div>

        {/* CPMR ALERT PANEL */}
        <div className={`p-5 rounded-[2rem] border flex items-center justify-between ${isCritical ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-950/40 border-slate-800'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCritical ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
               {isCritical ? <AlertTriangle size={18} /> : <Activity size={18} />}
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">CPMr Andromeda</p>
              <p className={`text-lg font-black ${isCritical ? 'text-amber-500' : 'text-white'}`}>R$ {campaign.cpmr.toFixed(2)}</p>
            </div>
          </div>
          {isCritical && <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />}
        </div>

        {/* GEM CONTROLS */}
        <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-800/50">
          <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
             <ShieldCheck size={14} className={campaign.multi_advertiser_ads_enabled ? 'text-blue-500' : 'text-slate-700'} />
             <button 
               onClick={() => onUpdate(campaign.id, { multi_advertiser_ads_enabled: !campaign.multi_advertiser_ads_enabled })}
               className={`w-8 h-4 rounded-full relative transition-all ${campaign.multi_advertiser_ads_enabled ? 'bg-blue-600' : 'bg-slate-800'}`}
             >
               <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${campaign.multi_advertiser_ads_enabled ? 'right-0.5' : 'left-0.5'}`} />
             </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
             <Fingerprint size={14} className={campaign.is_synthetic_content ? 'text-purple-500' : 'text-slate-700'} />
             <input 
               type="checkbox"
               checked={campaign.is_synthetic_content}
               onChange={() => onUpdate(campaign.id, { is_synthetic_content: !campaign.is_synthetic_content })}
               className="w-4 h-4 rounded border-slate-800 bg-slate-900 checked:bg-purple-600 focus:ring-0 transition-all cursor-pointer"
             />
          </div>
        </div>

        {/* BUDGET INPUT */}
        <div className="relative group/input">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700 font-black text-xs">R$</span>
          <input 
            type="number" 
            defaultValue={campaign.daily_budget}
            onBlur={(e) => onUpdate(campaign.id, { daily_budget: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-4 pl-12 text-xs font-black text-blue-400 outline-none focus:border-blue-500/50 transition-all"
          />
          <Zap size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-800 group-hover/input:text-blue-500" />
        </div>

      </div>
    </div>
  );
};
