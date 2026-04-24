"use client";

import React, { useMemo } from 'react';
import { 
  Loader2, RefreshCw, Search, Database, LayoutGrid, Filter, ArrowUpDown
} from 'lucide-react';
import { CampaignBentoCard } from '@/components/campaigns/CampaignBentoCard';
import { MetaCampaign } from '@/types/meta-campaigns';

/**
 * Meta Ads 2026 - Campaigns Board View
 * Performance Optimized Grid System
 */

interface Props {
  campaigns: MetaCampaign[];
  loading: boolean;
  onUpdate: (id: string, updates: Partial<MetaCampaign>) => Promise<void>;
  onRefresh: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  level: string;
  setLevel: (level: string, parentId?: string | null) => void;
}

export const CampaignsBoard: React.FC<Props> = ({
  campaigns, loading, onUpdate, onRefresh, searchTerm, setSearchTerm, level, setLevel
}) => {

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [campaigns, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 animate-pulse">
        <Loader2 className="animate-spin text-blue-600" size={48} strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Andromeda Sync</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Sincronizando com motor Andromeda e validando eventos CAPI...</p>
        </div>
      </div>
    );
  }

  if (filteredCampaigns.length === 0 && !loading) {
    return (
      <div className="bg-slate-900/10 border-2 border-dashed border-slate-800 rounded-[3rem] p-24 text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-slate-800 border border-slate-800">
          <Database size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Database Vazia</h3>
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Protocolos Andromeda sem registros ativos</p>
        </div>
        <button className="px-8 py-4 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">
          Initialize Sync
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ADVANCED TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/20 p-6 rounded-[2rem] border border-slate-800/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
           {['campaign', 'adset', 'ad'].map((lvl) => (
             <button
               key={lvl}
               onClick={() => setLevel(lvl)}
               className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${level === lvl ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950 text-slate-600 hover:text-slate-400'}`}
             >
               {lvl}s
             </button>
           ))}
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-lg">
           <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search Andromeda database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-14 pr-6 text-[11px] text-white outline-none focus:border-blue-600/50 transition-all font-medium"
              />
           </div>
           <button onClick={onRefresh} className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600 hover:text-white transition-all">
              <RefreshCw size={18} />
           </button>
        </div>
      </div>

      {/* BENTO MASONRY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filteredCampaigns.map((campaign) => (
          <CampaignBentoCard 
            key={campaign.id} 
            campaign={campaign} 
            onUpdate={onUpdate}
            onNavigate={(id) => {
              if (level === 'campaign') setLevel('adset', id);
              else if (level === 'adset') setLevel('ad', id);
            }}
          />
        ))}
      </div>

    </div>
  );
};
