"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  Building
} from 'lucide-react';

export default function AtendimentoPage() {
  const params = useParams();
  const clienteUrl = decodeURIComponent(params.cliente || '');
  
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [novaNota, setNovaNota] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ nome: '', contato: '', origem: 'Atendimento Direto' });

  const loadLeads = useCallback(async () => {
    if (!clienteUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm?cliente=${encodeURIComponent(clienteUrl)}`);
      const data = await res.json();
      if (data.success) setLeads(data.leads);
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
          autor: 'Atendente Solution' 
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
        setNewLead({ nome: '', contato: '', origem: 'Atendimento Direto' });
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* HEADER DINÂMICO POR EMPRESA */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
               <Building size={20} />
             </div>
             <div>
               <h1 className="text-lg font-black tracking-tight text-slate-800 uppercase">{clienteUrl}</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Canal de Atendimento Solution Place</p>
             </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest">Sistema Ativo</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* BUSCA E AÇÕES */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar lead por nome ou contato..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:ring-2 ring-blue-500/20 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowAddLead(true)}
            className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={24} />
          </button>
        </div>

        {/* LISTA DE LEADS */}
        <div className="space-y-4">
          {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32}/></div>
          ) : filteredLeads.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-300">
                <Users className="mx-auto text-slate-200 mb-4" size={48} />
                <p className="text-slate-400 font-bold text-sm">Nenhum lead encontrado para {clienteUrl}.</p>
             </div>
          ) : (
            filteredLeads.map(lead => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 active:bg-slate-50 transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black uppercase ${
                  lead.status === 'FECHADO' ? 'bg-emerald-100 text-emerald-600' :
                  lead.status === 'PERDIDO' ? 'bg-red-100 text-red-600' :
                  lead.status === 'NEGOCIACAO' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {lead.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-base leading-tight truncate">{lead.nome}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                       lead.status === 'FECHADO' ? 'bg-emerald-50 text-emerald-600' :
                       lead.status === 'PERDIDO' ? 'bg-red-50 text-red-600' :
                       'bg-slate-100 text-slate-500'
                    }`}>
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">• {new Date(lead.data).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-all" size={20} />
              </div>
            ))
          )}
        </div>
      </main>

      {/* PAINEL DE DETALHES (DRAWER) */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
           <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"><X size={20}/></button>
                <div className="text-right">
                  <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">Detalhes do Lead</h2>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{selectedLead.origem || 'Origem não informada'}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                 <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center text-3xl font-black mb-4">
                      {selectedLead.nome.charAt(0)}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedLead.nome}</h3>
                    <p className="text-sm text-slate-500 font-medium">{selectedLead.contato || 'Sem contato cadastrado'}</p>
                    
                    <div className="flex gap-2 mt-6 w-full">
                       <a href={`https://wa.me/${selectedLead.contato?.replace(/\D/g,'')}`} target="_blank" className="flex-1 bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-all">
                         <MessageCircle size={18}/> WhatsApp
                       </a>
                       <a href={`tel:${selectedLead.contato?.replace(/\D/g,'')}`} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all">
                         <Phone size={18}/> Ligar
                       </a>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atualizar Status</p>
                    <div className="grid grid-cols-2 gap-2">
                       {['CONTATO', 'NEGOCIACAO', 'FECHADO', 'PERDIDO'].map(st => (
                         <button 
                           key={st}
                           onClick={() => handleUpdateStatus(selectedLead.id, st)}
                           className={`p-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                             selectedLead.status === st 
                             ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                             : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                           }`}
                         >
                           {st}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linha do Tempo / Notas</p>
                       <History size={14} className="text-slate-300" />
                    </div>
                    
                    <form onSubmit={handleAddNota} className="relative">
                       <textarea 
                         value={novaNota}
                         onChange={e => setNovaNota(e.target.value)}
                         placeholder="Adicionar nota de atendimento..."
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pr-14 text-sm outline-none focus:ring-2 ring-blue-500/10 min-h-[100px] resize-none"
                       />
                       <button className="absolute right-3 bottom-3 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                         <Send size={18}/>
                       </button>
                    </form>

                    <div className="space-y-4 pt-4">
                       {selectedLead.notas?.map(nota => (
                         <div key={nota.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <div className="flex justify-between items-start mb-2">
                             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{nota.autor}</span>
                             <span className="text-[9px] text-slate-400 font-bold">{new Date(nota.criado_em).toLocaleDateString()}</span>
                           </div>
                           <p className="text-xs text-slate-700 leading-relaxed font-medium">{nota.texto}</p>
                         </div>
                       ))}
                       {(!selectedLead.notas || selectedLead.notas.length === 0) && (
                         <div className="text-center py-6">
                            <p className="text-[10px] text-slate-300 font-bold uppercase">Sem interações registradas.</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL ADICIONAR LEAD */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddLead(false)} />
           <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Novo Lead {clienteUrl}</h2>
                 <button onClick={() => setShowAddLead(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-400"><X size={20}/></button>
              </div>
              <form onSubmit={handleAddLead} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input required value={newLead.nome} onChange={e => setNewLead({...newLead, nome: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/10 transition-all" placeholder="Nome do prospect..." />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contato (WhatsApp)</label>
                    <input required value={newLead.contato} onChange={e => setNewLead({...newLead, contato: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/10 transition-all" placeholder="55 (00) 00000-0000" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origem do Lead</label>
                    <input value={newLead.origem} onChange={e => setNewLead({...newLead, origem: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/10 transition-all" placeholder="Ex: Atendimento Local" />
                 </div>
                 <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 mt-4 active:scale-95 transition-all">
                   Registrar Lead
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
