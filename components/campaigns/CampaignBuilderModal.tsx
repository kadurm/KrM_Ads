"use client";

import React, { useState } from 'react';
import { 
  X, Target, Zap, TrendingUp, MessageSquare, Smartphone, ShoppingBag, Eye, Loader2
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  clienteName: string;
}

const OBJECTIVES = [
  { id: 'OUTCOME_AWARENESS', label: 'Awareness', icon: Eye, description: 'Maximize reach and brand recall' },
  { id: 'OUTCOME_TRAFFIC', label: 'Traffic', icon: TrendingUp, description: 'Send people to a destination' },
  { id: 'OUTCOME_ENGAGEMENT', label: 'Engagement', icon: MessageSquare, description: 'Get more messages or video views' },
  { id: 'OUTCOME_LEADS', label: 'Leads', icon: Target, description: 'Collect leads for your business' },
  { id: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', icon: Smartphone, description: 'Get more people to install your app' },
  { id: 'OUTCOME_SALES', label: 'Sales', icon: ShoppingBag, description: 'Find people likely to purchase' },
];

export const CampaignBuilderModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, clienteName }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    objective: 'OUTCOME_LEADS',
    advantage_plus_budget: true,
    daily_budget: 50,
  });

  if (!isOpen) return null;

  const handleHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        cliente: clienteName,
        type: 'campaign',
        data: {
          ...formData,
          status: 'PAUSED',
        }
      });
      onClose();
    } catch (error) {
      console.error('Error creating campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* BACKDROP */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={onClose} />

      {/* MODAL */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 space-y-8">
          
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Andromeda Protocol</p>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Initialize New Campaign</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleHandleSubmit} className="space-y-8">
            {/* NAME INPUT */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Campaign Name</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: [ANDROMEDA] - Leads Q1 2026"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50 transition-all font-medium"
              />
            </div>

            {/* OBJECTIVES GRID (BENTO) */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Strategic Objective</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {OBJECTIVES.map((obj) => (
                  <div 
                    key={obj.id}
                    onClick={() => setFormData({ ...formData, objective: obj.id })}
                    className={`
                      cursor-pointer p-4 rounded-2xl border transition-all group
                      ${formData.objective === obj.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}
                    `}
                  >
                    <obj.icon size={20} className={formData.objective === obj.id ? 'text-blue-500' : 'text-slate-600 group-hover:text-slate-400'} />
                    <p className={`text-[11px] font-black mt-3 uppercase tracking-tighter ${formData.objective === obj.id ? 'text-white' : 'text-slate-400'}`}>
                      {obj.label}
                    </p>
                    <p className="text-[8px] text-slate-600 mt-1 uppercase font-bold leading-tight">
                      {obj.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ADVANTAGE+ TOGGLE & BUDGET */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Advantage+ Campaign Budget</h4>
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Machine Learning dynamic allocation (CBO)</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, advantage_plus_budget: !formData.advantage_plus_budget })}
                  className={`w-12 h-6 rounded-full relative transition-all ${formData.advantage_plus_budget ? 'bg-blue-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.advantage_plus_budget ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {formData.advantage_plus_budget && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Daily Budget (BRL)</label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black text-[11px]">R$</span>
                      <input 
                        type="number" 
                        value={formData.daily_budget}
                        onChange={(e) => setFormData({ ...formData, daily_budget: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pl-12 text-[13px] text-blue-400 outline-none focus:border-blue-600/50 transition-all font-black"
                      />
                   </div>
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800/50 transition-all"
              >
                Cancel Protocol
              </button>
              <button 
                disabled={loading || !formData.name}
                type="submit"
                className="flex-[2] py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : 'Execute Deployment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
