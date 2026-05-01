"use client";

import React, { useMemo, useState } from 'react';
import { 
  Loader2, RefreshCw, Search, Database, LayoutGrid, Filter, ArrowUpDown, Plus
} from 'lucide-react';
import { CampaignBentoCard } from '@/components/campaigns/CampaignBentoCard';
import { CampaignBuilderModal } from '@/components/campaigns/CampaignBuilderModal';
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
  parentId?: string | null;
  setLevel: (level: string, parentId?: string | null) => void;
  clienteName: string;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  since?: string;
  until?: string;
}

export const CampaignsBoard: React.FC<Props> = ({
  campaigns, loading, onUpdate, onRefresh, searchTerm, setSearchTerm, level, parentId, setLevel, clienteName,
  selectedIds, onToggleSelect, onClearSelection, since, until
}) => {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<MetaCampaign | null>(null);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [campaigns, searchTerm]);

  const handleEdit = (obj: MetaCampaign) => {
    setEditingObject(obj);
    setIsBuilderOpen(true);
  };

  const handleTabClick = (newLevel: string) => {
    // Meta Ads Logic: If we have selected items, use them as filter for next level
    if (selectedIds.length > 0) {
      setLevel(newLevel, selectedIds.join(','));
    } else {
      setLevel(newLevel, null);
    }
  };

  const handleCreateObject = async (payload: any) => {
    try {
      const isEdit = !!editingObject;
      const endpoint = isEdit ? `/api/meta/campaigns` : '/api/meta/create';
      const method = isEdit ? 'PATCH' : 'POST';
      
      const body = isEdit ? {
        cliente: clienteName,
        id: editingObject.id,
        ...payload.data
      } : payload;

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        setIsBuilderOpen(false);
        setEditingObject(null);
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      console.error('Error handling meta object:', error);
      alert('Falha na comunicação com a API');
    }
  };

  const closeBuilder = () => {
    setIsBuilderOpen(false);
    setEditingObject(null);
  };

  if (loading && campaigns.length === 0) {
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

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ADVANCED TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/20 p-6 rounded-[2rem] border border-slate-800/50 backdrop-blur-md">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              {[
                { id: 'campaign', label: 'Campaigns' },
                { id: 'adset', label: 'Ad Sets' },
                { id: 'ad', label: 'Ads' }
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => handleTabClick(lvl.id)}
                  className={`
                    px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${level === lvl.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white'}
                  `}
                >
                  {lvl.label}
                </button>
              ))}
           </div>

           {selectedIds.length > 0 && (
             <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                <div className="h-8 w-px bg-slate-800" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  {selectedIds.length} Selected
                </span>
                <button 
                  onClick={onClearSelection}
                  className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-all"
                >
                  Clear
                </button>
             </div>
           )}
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-2xl">
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
           
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsBuilderOpen(true)}
               className="px-6 py-4 bg-white text-black rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
             >
               <Plus size={16} strokeWidth={3} />
               <span className="text-[9px] font-black uppercase tracking-widest">Initialize New Protocol</span>
             </button>

             <button onClick={onRefresh} className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600 hover:text-white transition-all">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             </button>
           </div>
        </div>
      </div>

      {filteredCampaigns.length === 0 && !loading ? (
        <div className="bg-slate-900/10 border-2 border-dashed border-slate-800 rounded-[3rem] p-24 text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-slate-800 border border-slate-800">
            <Database size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Database Vazia</h3>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Protocolos Andromeda sem registros ativos</p>
          </div>
          <button 
            onClick={() => setIsBuilderOpen(true)}
            className="px-8 py-4 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all"
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredCampaigns.map((campaign) => (
            <CampaignBentoCard 
              key={campaign.id} 
              campaign={campaign} 
              onUpdate={onUpdate}
              onEdit={handleEdit}
              onNavigate={(id) => {
                const nextLevel = level === 'campaign' ? 'adset' : level === 'adset' ? 'ad' : 'ad';
                setLevel(nextLevel, id);
              }}
              isSelected={selectedIds.includes(campaign.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}

      {/* MODAL SYSTEM */}
      <CampaignBuilderModal 
        isOpen={isBuilderOpen}
        onClose={closeBuilder}
        onSubmit={handleCreateObject}
        clienteName={clienteName}
        level={editingObject ? (editingObject.adset_id ? 'ad' : editingObject.campaign_id ? 'adset' : 'campaign') : level}
        parentId={parentId}
        initialData={editingObject}
      />

    </div>
  );
};
