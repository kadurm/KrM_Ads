"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  MessageCircle, 
  Phone, 
  Clock, 
  Search, 
  ChevronRight, 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  Loader2,
  TrendingUp,
  History,
  MoreVertical,
  Send,
  Building,
  LayoutDashboard,
  Megaphone,
  Database
} from 'lucide-react';

export default function AtendimentoPage() {
  const pathname = usePathname();
  const clienteUrl = pathname.split('/').pop() || 'solutionplace';
  
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [novaNota, setNovaNota] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ nome: '', contato: '', origem: 'Canal Solution' });

  const loadLeads = useCallback(async () => {
    if (!clienteUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm?cliente=${encodeURIComponent(clienteUrl)}`);
      const data = await res.json();
      if (data.success) setLeads(data.leads);
      else console.error('Erro API:', data.error);
    } catch (e) {
      console.error('Erro ao carregar leads:', e);
    } finally {
      setLoading(false);
    }
  }, [clienteUrl]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus })
      });
      loadLeads();
      if (selectedLead?.id === leadId) setSelectedLead(prev => ({ ...prev, status: newStatus }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNota = async (e) => {
    e.preventDefault();
    if (!novaNota.trim() || !selectedLead) return;
    try {
      const res = await fetch('/api/crm/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead_id: selectedLead.id, 
          texto: novaNota, 
          autor: 'Equipe Solution' 
        })
      });
      const data = await res.json();
      if (data.success) {
        setNovaNota('');
        loadLeads();
        setSelectedLead(prev => ({
          ...prev,
          notas: [data.nota, ...(prev.notas || [])]
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: clienteUrl, ...newLead })
      });
      if (res.ok) {
        setShowAddLead(false);
        setNewLead({ nome: '', contato: '', origem: 'Canal Solution' });
        loadLeads();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredLeads = leads.filter(l => 
    l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contato?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-6 py-4 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-900/50">
               <Database size={24} />
             </div>
             <div>
               <h1 className="text-xl font-black tracking-tighter text-white uppercase">{clienteUrl === 'solutionplace' ? 'Solution Place' : clienteUrl}</h1>
               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Painel de Operações Solution</p>
             </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-1.5 px-4 rounded-full border border-slate-700">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em]">Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Localizar lead por nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-[2rem] py-5 pl-16 pr-6 text-base text-white outline-none focus:border-blue-600/50 focus:ring-4 ring-blue-600/5 transition-all shadow-xl shadow-black/20"
            />
          </div>
          <button 
            onClick={() => setShowAddLead(true)}
            className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/40 hover:scale-105 hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Plus size={32} />
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
             <div className="flex justify-center py-20 flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={40}/>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sincronizando Solution Hub...</p>
             </div>
          ) : filteredLeads.length === 0 ? (
             <div className="text-center py-24 bg-slate-900/50 rounded-[3rem] border border-dashed border-slate-800">
                <Users className="mx-auto text-slate-800 mb-6" size={64} />
                <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Nenhum registro encontrado.</p>
             </div>
          ) : (
            filteredLeads.map(lead => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-lg flex items-center gap-5 active:scale-98 active:bg-slate-800 transition-all cursor-pointer group hover:border-slate-700"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black uppercase shadow-inner ${
                  lead.status === 'FECHADO' ? 'bg-emerald-600/20 text-emerald-400' :
                  lead.status === 'PERDIDO' ? 'bg-red-600/20 text-red-400' :
                  lead.status === 'NEGOCIACAO' ? 'bg-amber-600/20 text-amber-400' :
                  'bg-blue-600/20 text-blue-400'
                }`}>
                  {lead.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white text-lg tracking-tight truncate">{lead.nome}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                       lead.status === 'FECHADO' ? 'bg-emerald-600/10 text-emerald-400' :
                       lead.status === 'PERDIDO' ? 'bg-red-600/10 text-red-400' :
                       'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-slate-600 font-black tracking-widest uppercase">{new Date(lead.data).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-all">
                   <ChevronRight size={20} />
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {selectedLead && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedLead(null)} />
           <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col animate-in slide-in-from-right duration-500">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
                <button onClick={() => setSelectedLead(null)} className="w-12 h-12 flex items-center justify-center hover:bg-slate-800 rounded-2xl text-slate-500 transition-all"><X size={24}/></button>
                <div className="text-right">
                  <h2 className="font-black text-white uppercase text-base tracking-tighter">Gestão Solution</h2>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">{selectedLead.origem || 'Origem não informada'}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                 <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-blue-600/10 text-blue-400 rounded-[2rem] border border-blue-500/20 flex items-center justify-center text-4xl font-black mb-6 shadow-inner">
                      {selectedLead.nome.charAt(0)}
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tighter leading-tight">{selectedLead.nome}</h3>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">{selectedLead.contato || 'Sem contato cadastrado'}</p>
                    
                    <div className="flex gap-3 mt-8 w-full">
                       <a href={`https://wa.me/${selectedLead.contato?.replace(/\D/g,'')}`} target="_blank" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-900/20 active:scale-95 transition-all">
                         <MessageCircle size={20}/> WhatsApp
                       </a>
                       <a href={`tel:${selectedLead.contato?.replace(/\D/g,'')}`} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-900/20 active:scale-95 transition-all">
                         <Phone size={20}/> Ligar
                       </a>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Fase do Lead</p>
                    <div className="grid grid-cols-2 gap-2">
                       {['CONTATO', 'NEGOCIACAO', 'FECHADO', 'PERDIDO'].map(st => (
                         <button 
                           key={st}
                           onClick={() => handleUpdateStatus(selectedLead.id, st)}
                           className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                             selectedLead.status === st 
                             ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-900/50' 
                             : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                           }`}
                         >
                           {st}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between ml-2">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Atendimentos / Notas</p>
                       <History size={16} className="text-slate-700" />
                    </div>
                    
                    <form onSubmit={handleAddNota} className="relative">
                       <textarea 
                         value={novaNota}
                         onChange={e => setNovaNota(e.target.value)}
                         placeholder="Descreva o atendimento aqui..."
                         className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-6 pr-16 text-sm text-white outline-none focus:border-blue-600/50 min-h-[120px] resize-none shadow-inner"
                       />
                       <button className="absolute right-4 bottom-4 w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-blue-500 active:scale-90 transition-all">
                         <Send size={20}/>
                       </button>
                    </form>

                    <div className="space-y-4 pt-4">
                       {selectedLead.notas?.map(nota => (
                         <div key={nota.id} className="bg-slate-800/50 p-6 rounded-[2rem] border border-slate-800">
                           <div className="flex justify-between items-start mb-3">
                             <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{nota.autor}</span>
                             <span className="text-[9px] text-slate-600 font-black uppercase">{new Date(nota.criado_em).toLocaleDateString()}</span>
                           </div>
                           <p className="text-sm text-slate-300 leading-relaxed font-medium">{nota.texto}</p>
                         </div>
                       ))}
                       {(!selectedLead.notas || selectedLead.notas.length === 0) && (
                         <div className="text-center py-10 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
                            <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">Inicie o histórico deste lead.</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowAddLead(false)} />
           <div className="relative bg-slate-900 w-full max-w-lg rounded-t-[3.5rem] sm:rounded-[3.5rem] p-10 shadow-[0_-20px_100px_rgba(0,0,0,0.5)] border-t border-slate-800 sm:border-l animate-in slide-in-from-bottom-20 duration-500">
              <div className="flex justify-between items-center mb-10">
                 <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Novo Registro</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Solution Operational Sync</p>
                 </div>
                 <button onClick={() => setShowAddLead(false)} className="w-12 h-12 bg-slate-800 rounded-2xl text-slate-500 flex items-center justify-center"><X size={24}/></button>
              </div>
              <form onSubmit={handleAddLead} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Nome do Prospect</label>
                    <input required value={newLead.nome} onChange={e => setNewLead({...newLead, nome: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-base text-white outline-none focus:border-blue-600/50 transition-all" placeholder="Nome Completo" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">WhatsApp / Contato</label>
                    <input required value={newLead.contato} onChange={e => setNewLead({...newLead, contato: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-base text-white outline-none focus:border-blue-600/50 transition-all" placeholder="55 00 00000-0000" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Origem da Entrada</label>
                    <input value={newLead.origem} onChange={e => setNewLead({...newLead, origem: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-base text-white outline-none focus:border-blue-600/50 transition-all" placeholder="Ex: Canal Solution" />
                 </div>
                 <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-900/40 mt-6 active:scale-95 transition-all">
                   Registrar no Solution Hub
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
