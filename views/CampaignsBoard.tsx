"use client";

import React from 'react';
import { 
  Loader2, 
  Megaphone, 
  Plus, 
  RefreshCw, 
  Search, 
  Settings2,
  AlertCircle,
  Database
} from 'lucide-react';
import { CampaignBentoCard } from '@/components/campaigns/CampaignBentoCard';
import { MetaCampaign } from '@/types/meta-campaigns';

interface CampaignsBoardProps {
  campaigns: MetaCampaign[];
  loading: boolean;
  onUpdate: (id: string, updates: Partial<MetaCampaign>) => Promise<void>;
  onRefresh: () => void;
  onCreateNew: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  campaignsLevel: string;
  setCampaignsLevel: (level: string, parentId?: string | null) => void;
}

export const CampaignsBoard: React.FC<CampaignsBoardProps> = ({
  campaigns,
  loading,
  onUpdate,
  onRefresh,
  onCreateNew,
  searchTerm,
  setSearchTerm,
  campaignsLevel,
  setCampaignsLevel
}) => {

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-8 animate-in fade-in duration-700">
        <div className="relative">
          <Loader2 className="animate-spin text-blue-600" size={64} strokeWidth={1} />
          <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-black uppercase tracking-[0.4em] text-white">Motor Andromeda</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sincronizando com motor Andromeda e validando eventos CAPI...</p>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0 && !loading) {
    return (
      <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-[4rem] p-32 text-center flex flex-col items-center gap-8 animate-in zoom-in-95 duration-700">
        <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-700 shadow-inner">
          <Database size={40} />
        </div>
        <div className="space-y-4 max-w-sm">
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Database Vazia</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-widest">Nenhuma estrutura detectada sob os protocolos atuais da Meta Marketing API.</p>
        </div>
        <button 
          onClick={onCreateNew}
          className="px-10 py-5 bg-white text-black rounded-full font-black text-[11px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/10"
        >
          Inicializar Estrutura
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* TOOLBAR HIGH-END */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           {['campaign', 'adset', 'ad'].map((lvl) => (
             <button
               key={lvl}
               onClick={() => setCampaignsLevel(lvl)}
               className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${campaignsLevel === lvl ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
             >
               {lvl}s
             </button>
           ))}
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-xl">
           <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search Andromeda database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-16 pr-8 text-xs text-white outline-none focus:border-blue-600/50 transition-all shadow-inner font-medium"
              />
           </div>
           <button onClick={onRefresh} className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-900 transition-all">
              <RefreshCw size={20} />
           </button>
        </div>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
        {campaigns
          .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((campaign) => (
          <CampaignBentoCard 
            key={campaign.id} 
            campaign={campaign} 
            onUpdate={onUpdate}
            onNavigate={(id) => {
              if (campaignsLevel === 'campaign') setCampaignsLevel('adset', id);
              else if (campaignsLevel === 'adset') setCampaignsLevel('ad', id);
            }}
          />
        ))}
      </div>

    </div>
  );
};
