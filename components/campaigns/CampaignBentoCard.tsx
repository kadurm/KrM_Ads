"use client";

import React from 'react';
import { 
  Play, 
  Pause, 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  Sparkles, 
  Activity,
  AlertTriangle,
  Fingerprint
} from 'lucide-react';
import { MetaCampaign } from '@/types/meta-campaigns';

interface CampaignBentoCardProps {
  campaign: MetaCampaign;
  onUpdate: (id: string, updates: Partial<MetaCampaign>) => Promise<void>;
  onNavigate?: (id: string) => void;
}

export const CampaignBentoCard: React.FC<CampaignBentoCardProps> = ({ 
  campaign, 
  onUpdate,
  onNavigate
}) => {
  const isCriticalCPMr = (campaign.cpmr || 0) > 25; // Exemplo de threshold de alerta

  return (
    <div className={`group relative bg-slate-900/40 backdrop-blur-2xl border ${isCriticalCPMr ? 'border-amber-500/40 shadow-[0_0_50px_rgba(245,158,11,0.1)]' : 'border-slate-800'} rounded-[3rem] p-8 flex flex-col gap-8 transition-all duration-700 hover:bg-slate-900/60 hover:border-slate-700`}>
      
      {/* CAPI & GEM GLOWS */}
      <div className="absolute -top-px -left-px w-32 h-32 bg-blue-600/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* HEADER */}
      <div className="flex justify-between items-start z-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {campaign.objective?.replace('OUTCOME_', '') || 'OPTIMIZED'}
            </span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${campaign.capi_status === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]'}`} />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">CAPI Status</span>
            </div>
          </div>
          <h3 
            onClick={() => onNavigate?.(campaign.id)}
            className="text-2xl font-black text-white tracking-tighter uppercase leading-none cursor-pointer hover:text-blue-400 transition-colors"
          >
            {campaign.name}
          </h3>
        </div>

        <button 
          onClick={() => onUpdate(campaign.id, { status: campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${campaign.status === 'ACTIVE' ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 hover:scale-110' : 'bg-slate-950 text-slate-700 border border-slate-800'}`}
        >
          {campaign.status === 'ACTIVE' ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </button>
      </div>

      {/* METRICS GRID 2026 */}
      <div className="grid grid-cols-2 gap-6 z-10">
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hook Rate</p>
            <span className="text-sm font-black text-blue-400">{campaign.hook_rate?.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
            <div 
              className="bg-blue-500 h-full transition-all duration-1000" 
              style={{ width: `${Math.min(campaign.hook_rate || 0, 100)}%` }} 
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ad Fatigue</p>
            <span className={`text-sm font-black ${ (campaign.creative_fatigue_score || 0) > 70 ? 'text-red-500' : 'text-emerald-500' }`}>
              {campaign.creative_fatigue_score || 0}/100
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
            <div 
              className={`h-full transition-all duration-1000 ${ (campaign.creative_fatigue_score || 0) > 70 ? 'bg-red-500' : 'bg-emerald-500' }`} 
              style={{ width: `${campaign.creative_fatigue_score || 0}%` }} 
            />
          </div>
        </div>
      </div>

      {/* CPMR ALERT PANEL */}
      <div className={`p-6 rounded-3xl border flex items-center justify-between transition-all duration-500 ${isCriticalCPMr ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-950/30 border-slate-800'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCriticalCPMr ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
             {isCriticalCPMr ? <AlertTriangle size={20} /> : <Activity size={20} />}
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Andromeda CPMr</p>
            <p className={`text-xl font-black ${isCriticalCPMr ? 'text-amber-500' : 'text-white'}`}>R$ {campaign.cpmr?.toFixed(2)}</p>
          </div>
        </div>
        {isCriticalCPMr && <span className="text-[10px] font-black text-amber-500 animate-pulse uppercase tracking-widest">Critical Trend</span>}
      </div>

      {/* CONTROLS (GEM & BRAND SAFETY) */}
      <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-800/50">
        <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-slate-800">
           <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={campaign.multi_advertiser_ads_enabled ? 'text-blue-500' : 'text-slate-700'} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand Safety</span>
           </div>
           <button 
             onClick={() => onUpdate(campaign.id, { multi_advertiser_ads_enabled: !campaign.multi_advertiser_ads_enabled })}
             className={`w-10 h-6 rounded-full relative transition-all duration-300 ${campaign.multi_advertiser_ads_enabled ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-800'}`}
           >
             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${campaign.multi_advertiser_ads_enabled ? 'right-1' : 'left-1'}`} />
           </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-slate-800">
           <div className="flex items-center gap-2">
              <Fingerprint size={16} className={campaign.is_synthetic_content ? 'text-purple-500' : 'text-slate-700'} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA Content</span>
           </div>
           <input 
             type="checkbox"
             checked={campaign.is_synthetic_content}
             onChange={() => onUpdate(campaign.id, { is_synthetic_content: !campaign.is_synthetic_content })}
             className="w-5 h-5 rounded-lg border-slate-800 bg-slate-900 checked:bg-purple-600 focus:ring-0 transition-all cursor-pointer"
           />
        </div>
      </div>

      {/* BUDGET EDIT */}
      <div className="group/budget relative">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2 ml-2">Energy Allocation (Daily)</p>
        <div className="relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 font-black text-sm">R$</span>
          <input 
            type="number" 
            defaultValue={campaign.daily_budget}
            onBlur={(e) => onUpdate(campaign.id, { daily_budget: parseFloat(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-5 pl-14 text-sm font-black text-blue-400 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-inner"
          />
          <Zap size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-800 group-hover/budget:text-blue-500 transition-colors" />
        </div>
      </div>

    </div>
  );
};
