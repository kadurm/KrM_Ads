"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Calendar,
  Shield,
  Car,
  Trash2,
  Table,
  Kanban,
  LayoutDashboard,
  LogOut,
  Edit3,
  DollarSign,
  Briefcase,
  Layers,
  MapPin,
  ChevronLeft
} from 'lucide-react';

export default function AtendimentoPage() {
  const pathname = usePathname();
  const clienteUrl = pathname.split('/').pop() || 'solutionplace';
  
  const [leads, setLeads] = useState([]);
  
  // Helper de Formatação de Data
  const formatDateLocal = (d) => {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // Estados de Datas (Padrão: Últimos 30 Dias)
  const [startDate, setStartDate] = useState(() => {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    return formatDateLocal(trintaDiasAtras);
  });
  const [endDate, setEndDate] = useState(() => formatDateLocal(new Date()));
  const [activeShortcut, setActiveShortcut] = useState(null);

  const handleShortcut = (shortcut) => {
    const hojeObj = new Date();
    setActiveShortcut(shortcut);
    if (shortcut === 'hoje') {
      const d = formatDateLocal(hojeObj);
      setStartDate(d); setEndDate(d);
    } else if (shortcut === 'ontem') {
      const ontem = new Date(hojeObj);
      ontem.setDate(hojeObj.getDate() - 1);
      const d = formatDateLocal(ontem);
      setStartDate(d); setEndDate(d);
    } else if (shortcut === '7d') {
      const past = new Date(hojeObj);
      past.setDate(hojeObj.getDate() - 7);
      setStartDate(formatDateLocal(past));
      setEndDate(formatDateLocal(hojeObj));
    } else if (shortcut === 'este_mes') {
      const pri = new Date(hojeObj.getFullYear(), hojeObj.getMonth(), 1);
      setStartDate(formatDateLocal(pri));
      setEndDate(formatDateLocal(hojeObj));
    } else if (shortcut === 'mes_passado') {
      const pri = new Date(hojeObj.getFullYear(), hojeObj.getMonth() - 1, 1);
      const ult = new Date(hojeObj.getFullYear(), hojeObj.getMonth(), 0);
      setStartDate(formatDateLocal(pri));
      setEndDate(formatDateLocal(ult));
    }
  };

  const getShortcutClass = (id) => {
    const base = "px-3 py-1.5 text-[10px] font-bold rounded transition-all";
    return activeShortcut === id 
      ? `${base} bg-red-700 text-white shadow-md border border-red-600/20` 
      : `${base} text-slate-400 hover:bg-[#1b1c24] hover:text-white`;
  };

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [novaNota, setNovaNota] = useState('');
  
  // Modos de Visualização: 'TABELA', 'KANBAN', 'DASHBOARD', 'SEGUIDORES', 'AGENDAMENTOS'
  const [activeView, setActiveView] = useState('TABELA');
  
  // Modals e Forms
  const [showAddLead, setShowAddLead] = useState(false);
  const [customComercial, setCustomComercial] = useState('');
  const [newLead, setNewLead] = useState({
    nome: '',
    contato: '',
    origem: 'INSTAGRAM',
    primeira_mensagem: '',
    tipo_servico: 'BLINDAGEM',
    veiculo: '',
    comercial: 'X',
    conversao: '',
    status: 'NOVO',
    valor: '0',
    data: new Date().toISOString().split('T')[0]
  });

  // Edição de Lead selecionado
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState({});

  // Instagram Followers and Direct Message States
  const [sendingDirect, setSendingDirect] = useState(false);
  const [directStatus, setDirectStatus] = useState('');

  // Agendamento States
  const [agendamentos, setAgendamentos] = useState([]);
  const [showAddAgendamento, setShowAddAgendamento] = useState(false);
  const [newAgendamento, setNewAgendamento] = useState({ tipo: 'PRONTA_ENTREGA', data_hora: '', observacao: '' });
  const [submittingAgendamento, setSubmittingAgendamento] = useState(false);

  // Authentication States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const session = sessionStorage.getItem('solution_session');
      if (session === 'authenticated') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('solution_session', 'authenticated');
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || 'Credenciais inválidas.');
      }
    } catch (err) {
      setAuthError('Falha na comunicação com o servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('solution_session');
    setIsAuthenticated(false);
    setLoginUsername('');
    setLoginPassword('');
    setAuthError('');
  };

  const loadLeads = useCallback(async () => {
    if (!clienteUrl || !isAuthenticated) return;
    setLoading(true);
    try {
      const [leadsRes, agendamentosRes] = await Promise.all([
        fetch(`/api/crm?cliente=${encodeURIComponent(clienteUrl)}`),
        fetch(`/api/crm/agendamentos?cliente=${encodeURIComponent(clienteUrl)}`)
      ]);
      const leadsData = await leadsRes.json();
      const agendamentosData = await agendamentosRes.json();

      if (leadsData.success) setLeads(leadsData.leads);
      else console.error('Erro API Leads:', leadsData.error);

      if (agendamentosData.success) setAgendamentos(agendamentosData.agendamentos);
      else console.error('Erro API Agendamentos:', agendamentosData.error);
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  }, [clienteUrl, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadLeads();
    }
  }, [loadLeads, isAuthenticated]);

  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus })
      });
      loadLeads();
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => ({ ...prev, status: newStatus }));
      }
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
      const finalComercial = newLead.comercial === 'ADICIONAR_NOVO' ? customComercial : newLead.comercial;
      const payload = {
        cliente: clienteUrl,
        nome: newLead.nome,
        contato: newLead.contato,
        origem: newLead.origem,
        primeira_mensagem: newLead.primeira_mensagem || null,
        tipo_servico: newLead.tipo_servico || null,
        veiculo: newLead.veiculo || null,
        comercial: finalComercial || null,
        conversao: newLead.conversao || null,
        status: newLead.status,
        valor: parseFloat(newLead.valor || 0),
        data: newLead.data ? new Date(newLead.data).toISOString() : new Date().toISOString()
      };

      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setShowAddLead(false);
        setCustomComercial('');
        setNewLead({
          nome: '',
          contato: '',
          origem: 'INSTAGRAM',
          primeira_mensagem: '',
          tipo_servico: 'BLINDAGEM',
          veiculo: '',
          comercial: 'X',
          conversao: '',
          status: 'NOVO',
          valor: '0',
          data: new Date().toISOString().split('T')[0]
        });
        loadLeads();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateLeadDetails = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const res = await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLead.id,
          nome: editedLead.nome,
          contato: editedLead.contato,
          status: editedLead.status,
          valor: parseFloat(editedLead.valor || 0),
          origem: editedLead.origem,
          primeira_mensagem: editedLead.primeira_mensagem,
          tipo_servico: editedLead.tipo_servico,
          veiculo: editedLead.veiculo,
          comercial: editedLead.comercial,
          conversao: editedLead.conversao
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        loadLeads();
        setSelectedLead(data.lead);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendDirect = async (leadId, mensagem) => {
    setSendingDirect(true);
    setDirectStatus('');
    try {
      const res = await fetch('/api/meta/instagram-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, mensagem })
      });
      const data = await res.json();
      if (data.success) {
        setDirectStatus('Mensagem Enviada!');
        loadLeads();
        setSelectedLead(prev => ({
          ...prev,
          notas: [data.nota, ...(prev.notas || [])]
        }));
      } else {
        setDirectStatus('Falha ao enviar');
      }
    } catch (e) {
      setDirectStatus('Erro de Conexão');
    } finally {
      setSendingDirect(false);
      setTimeout(() => setDirectStatus(''), 3000);
    }
  };

  const handleAddAgendamento = async (e) => {
    e.preventDefault();
    if (!newAgendamento.data_hora || !selectedLead) return;
    setSubmittingAgendamento(true);
    try {
      const res = await fetch('/api/crm/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          tipo: newAgendamento.tipo,
          data_hora: newAgendamento.data_hora,
          observacao: newAgendamento.observacao
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddAgendamento(false);
        setNewAgendamento({ tipo: 'PRONTA_ENTREGA', data_hora: '', observacao: '' });
        loadLeads();
        
        const formattedDate = new Date(data.agendamento.data_hora).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const tipoLegivel = data.agendamento.tipo === 'PRONTA_ENTREGA' ? 'Compra de veículo pronta entrega' : 'Blindagem do veículo do cliente';
        
        const newNota = {
          id: Math.random().toString(),
          texto: `[Agendamento] Comprometido: ${tipoLegivel} marcado para ${formattedDate}.${data.agendamento.observacao ? ` Obs: ${data.agendamento.observacao}` : ''}`,
          autor: 'Sistema',
          criado_em: new Date().toISOString()
        };
        
        setSelectedLead(prev => ({
          ...prev,
          agendamentos: [...(prev.agendamentos || []), data.agendamento],
          notas: [newNota, ...(prev.notas || [])]
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAgendamento(false);
    }
  };

  const handleUpdateAgendamentoStatus = async (agendamentoId, newStatus) => {
    try {
      const res = await fetch('/api/crm/agendamentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agendamentoId, status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        loadLeads();
        
        if (selectedLead) {
          const statusLegivel = newStatus === 'REALIZADO' ? 'Realizado' : newStatus === 'CANCELADO' ? 'Cancelado' : newStatus;
          const oldAg = selectedLead.agendamentos?.find(a => a.id === agendamentoId);
          const tipoLegivel = oldAg?.tipo === 'PRONTA_ENTREGA' ? 'Compra de veículo pronta entrega' : 'Blindagem do veículo do cliente';
          
          const newNota = {
            id: Math.random().toString(),
            texto: `[Agendamento Atualizado] O agendamento para ${tipoLegivel} foi marcado como: ${statusLegivel}.`,
            autor: 'Sistema',
            criado_em: new Date().toISOString()
          };

          setSelectedLead(prev => ({
            ...prev,
            agendamentos: prev.agendamentos?.map(a => a.id === agendamentoId ? { ...a, status: newStatus } : a),
            notas: [newNota, ...(prev.notas || [])]
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAgendamento = async (agendamentoId) => {
    if (!confirm('Deseja realmente excluir este agendamento?')) return;
    try {
      const res = await fetch(`/api/crm/agendamentos?id=${agendamentoId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        loadLeads();
        if (selectedLead) {
          const newNota = {
            id: Math.random().toString(),
            texto: `[Agendamento Removido] O agendamento anterior foi excluído do sistema.`,
            autor: 'Sistema',
            criado_em: new Date().toISOString()
          };

          setSelectedLead(prev => ({
            ...prev,
            agendamentos: prev.agendamentos?.filter(a => a.id !== agendamentoId),
            notas: [newNota, ...(prev.notas || [])]
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtra os leads normais (ocultando seguidores do Instagram) e aplica filtro de datas
  const leadsFiltrados = useMemo(() => {
    const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
    const endMs = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;
    return leads.filter(l => {
      const matchesSearch = l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            l.contato?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            l.veiculo?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isSeguidor = l.origem === 'Seguidor Instagram';
      const leadDate = new Date(l.data).getTime();
      const inRange = leadDate >= startMs && leadDate <= endMs;
      return matchesSearch && !isSeguidor && inRange;
    });
  }, [leads, searchTerm, startDate, endDate]);

  // Lista de vendedores/comerciais dinâmicos baseada nos leads do banco de dados
  const vendedoresDisponiveis = useMemo(() => {
    const list = new Set(['X', 'RUTE', 'VALÉRIA', 'RAYANE']);
    leads.forEach(l => {
      if (l.comercial && l.comercial.trim() !== '' && l.comercial !== 'X') {
        list.add(l.comercial.trim().toUpperCase());
      }
    });
    return Array.from(list);
  }, [leads]);

  // Cálculos do Dashboard
  const dashboardStats = useMemo(() => {
    const leadsNormais = leads.filter(l => l.origem !== 'Seguidor Instagram');
    const totalLeads = leadsNormais.length;
    
    // Considera closedLeads tanto as vendas fechadas quanto as assistências que geraram faturamento
    const closedLeads = leadsNormais.filter(l => l.status === 'FECHADO' || (l.tipo_servico === 'ASSISTÊNCIA' && Number(l.valor || 0) > 0));
    
    const faturamentoTotal = closedLeads.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
    const faturamentoAssistencia = leadsNormais
      .filter(l => l.tipo_servico === 'ASSISTÊNCIA' && Number(l.valor || 0) > 0)
      .reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
      
    const taxaConversao = totalLeads > 0 ? ((closedLeads.length / totalLeads) * 100).toFixed(1) : '0';
    
    // Leads ativos excluem perdidos, vendas fechadas e assistências concluídas/pagas
    const leadsAtivos = leadsNormais.filter(l => 
      l.status !== 'FECHADO' && 
      !(l.tipo_servico === 'ASSISTÊNCIA' && Number(l.valor || 0) > 0) && 
      l.status !== 'PERDIDO'
    ).length;

    // Veículos Procurados (Ativos)
    const procuradosMap = {};
    leadsNormais.forEach(l => {
      if (
        l.veiculo && 
        l.veiculo !== 'X' && 
        l.veiculo !== 'NÃO IDENTIFICADO' && 
        l.status !== 'FECHADO' && 
        !(l.tipo_servico === 'ASSISTÊNCIA' && Number(l.valor || 0) > 0) &&
        l.status !== 'PERDIDO'
      ) {
        const cleanName = l.veiculo.trim().toUpperCase();
        procuradosMap[cleanName] = (procuradosMap[cleanName] || 0) + 1;
      }
    });
    const topProcurados = Object.entries(procuradosMap)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Veículos Vendidos (Fechados)
    const vendidosMap = {};
    leadsNormais.forEach(l => {
      if (l.veiculo && l.veiculo !== 'X' && l.status === 'FECHADO' && l.tipo_servico !== 'ASSISTÊNCIA') {
        const cleanName = l.veiculo.trim().toUpperCase();
        if (!vendidosMap[cleanName]) {
          vendidosMap[cleanName] = { count: 0, valor: 0 };
        }
        vendidosMap[cleanName].count += 1;
        vendidosMap[cleanName].valor += Number(l.valor || 0);
      }
    });
    const topVendidos = Object.entries(vendidosMap)
      .map(([nome, data]) => ({ nome, count: data.count, valor: data.valor }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Veículos de Assistência Técnica (Ganhos)
    const assistenciasMap = {};
    leadsNormais.forEach(l => {
      if (l.veiculo && l.veiculo !== 'X' && l.tipo_servico === 'ASSISTÊNCIA' && Number(l.valor || 0) > 0) {
        const cleanName = l.veiculo.trim().toUpperCase();
        assistenciasMap[cleanName] = (assistenciasMap[cleanName] || 0) + 1;
      }
    });
    const topAssistencias = Object.entries(assistenciasMap)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Origens de Entrada
    const origensMap = {};
    leadsNormais.forEach(l => {
      const cleanOrigem = l.origem ? l.origem.trim().toUpperCase() : 'NÃO IDENTIFICADO';
      origensMap[cleanOrigem] = (origensMap[cleanOrigem] || 0) + 1;
    });
    const topOrigens = Object.entries(origensMap)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalLeads,
      faturamentoTotal,
      faturamentoAssistencia,
      taxaConversao,
      leadsAtivos,
      topProcurados,
      topVendidos,
      topAssistencias,
      topOrigens
    };
  }, [leads]);

  // Abre edição
  const startEditing = (lead) => {
    setEditedLead({
      ...lead,
      valor: lead.valor ? Number(lead.valor).toString() : '0'
    });
    setIsEditing(true);
  };

  if (!isMounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0b0e] text-slate-100 font-sans flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-950/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-950/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#11131a]/85 backdrop-blur-md rounded-[3rem] p-10 border border-[#1b1c24] shadow-2xl relative z-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-[#1b1c24] rounded-3xl flex items-center justify-center overflow-hidden border border-red-900/30 shadow-inner mx-auto">
              <img src="/solutionplace_logo.jpeg" alt="Solution Place Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Acesso Restrito</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Solution Place Operational Hub</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="login-username" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Usuário</label>
              <input 
                id="login-username"
                required 
                type="text" 
                value={loginUsername} 
                onChange={e => setLoginUsername(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-900 rounded-2xl p-5 text-base text-white outline-none focus:border-red-800/40 transition-all" 
                placeholder="Insira seu usuário" 
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Senha</label>
              <input 
                id="login-password"
                required 
                type="password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-900 rounded-2xl p-5 text-base text-white outline-none focus:border-red-800/40 transition-all" 
                placeholder="••••••••" 
              />
            </div>

            {authError && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-xs font-semibold animate-shake">
                <AlertCircle size={18} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              id="login-submit-btn"
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-red-700 hover:bg-red-600 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-red-950/40 active:scale-95 transition-all border border-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Entrar no Hub</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-slate-100 font-sans pb-20 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-950/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-red-950/5 rounded-full blur-[150px] pointer-events-none" />

      <header className="bg-[#11131a]/90 backdrop-blur-md border-b border-red-950/20 sticky top-0 z-40 px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-[#1b1c24] rounded-2xl flex items-center justify-center overflow-hidden border border-red-900/30 shadow-inner">
               <img src="/solutionplace_logo.jpeg" alt="Solution Place Logo" className="w-full h-full object-cover" />
             </div>
             <div>
               <h1 className="text-lg font-black tracking-tighter text-white uppercase">
                 Solution Place
               </h1>
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Painel de Operações Solution</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 px-4 rounded-full border border-slate-800">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-glow" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Live</span>
            </div>
            <button 
              id="btn-logout"
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-950/40 active:scale-95 transition-all"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8 relative z-10">
        
        {/* Barra superior de busca e adição */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-500 transition-colors" size={20} />
            <input 
              id="search-input"
              type="text" 
              placeholder="Localizar lead por nome, celular ou carro..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#11131a] border border-[#1b1c24] rounded-[2rem] py-5 pl-16 pr-6 text-base text-white outline-none focus:border-red-800/40 focus:ring-4 ring-red-950/10 transition-all shadow-xl shadow-black/30"
            />
          </div>
          <button 
            id="btn-add-lead"
            onClick={() => setShowAddLead(true)}
            className="w-16 h-16 bg-red-700 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-red-950/50 hover:scale-105 hover:bg-red-600 active:scale-95 transition-all border border-red-600/30 shrink-0"
            title="Adicionar Novo Lead"
          >
            <Plus size={32} />
          </button>
        </div>

        {/* Abas e Filtro de Datas */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Abas Principais do CRM */}
          <div className="flex flex-wrap gap-2 bg-[#11131a]/80 p-1.5 rounded-3xl border border-[#1b1c24] w-fit shadow-md">
            <button 
              onClick={() => setActiveView('TABELA')} 
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'TABELA' ? 'bg-red-700 text-white shadow-lg shadow-red-950/35 border border-red-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Table size={14} />
              Planilha
            </button>
            <button 
              onClick={() => setActiveView('KANBAN')} 
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'KANBAN' ? 'bg-red-700 text-white shadow-lg shadow-red-950/35 border border-red-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Kanban size={14} />
              Kanban
            </button>
            <button 
              onClick={() => setActiveView('DASHBOARD')} 
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'DASHBOARD' ? 'bg-red-700 text-white shadow-lg shadow-red-950/35 border border-red-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </button>

            <button 
              onClick={() => setActiveView('AGENDAMENTOS')} 
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'AGENDAMENTOS' ? 'bg-red-700 text-white shadow-lg shadow-red-950/35 border border-red-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Calendar size={14} />
              Agenda / Visitas
            </button>
          </div>

          {/* Filtro de Datas (Estilo Solution) */}
          <div className="flex items-center gap-3 bg-[#11131a]/80 p-2 rounded-3xl border border-[#1b1c24] shadow-md flex-wrap lg:flex-nowrap">
            <div className="flex gap-1 bg-slate-950/50 p-1 rounded-2xl">
              {[
                { id: 'hoje', label: 'Hoje' },
                { id: 'ontem', label: 'Ontem' },
                { id: '7d', label: '7 Dias' },
                { id: 'este_mes', label: 'Este Mês' },
                { id: 'mes_passado', label: 'Mês Passado' },
              ].map(s => (
                <button 
                  key={s.id} 
                  onClick={() => handleShortcut(s.id)} 
                  className={getShortcutClass(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => { setStartDate(e.target.value); setActiveShortcut(null); }} 
                className="bg-slate-950/60 text-[10px] font-black text-slate-300 p-2.5 rounded-2xl border border-red-950/20 outline-none focus:border-red-700/40 transition-all text-center uppercase" 
              />
              <span className="text-red-900/50 text-xs">→</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => { setEndDate(e.target.value); setActiveShortcut(null); }} 
                className="bg-slate-950/60 text-[10px] font-black text-slate-300 p-2.5 rounded-2xl border border-red-950/20 outline-none focus:border-red-700/40 transition-all text-center uppercase" 
              />
            </div>
          </div>
        </div>

        {/* CONTAINER DE CONTEÚDO PRINCIPAL */}
        <div className="space-y-4">
          {loading ? (
             <div className="flex justify-center py-20 flex-col items-center gap-4">
                <Loader2 className="animate-spin text-red-600" size={40}/>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sincronizando Solution Hub...</p>
             </div>
          ) : activeView === 'AGENDAMENTOS' ? (
             agendamentos.length === 0 ? (
               <div className="text-center py-24 bg-[#11131a]/40 rounded-[3rem] border border-dashed border-[#1b1c24]">
                  <Calendar className="mx-auto text-slate-800 mb-6" size={64} />
                  <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Nenhum agendamento programado.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {agendamentos.map(ag => {
                   const dataFormatada = new Date(ag.data_hora).toLocaleString('pt-BR', {
                     day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                   });
                   const isProntaEntrega = ag.tipo === 'PRONTA_ENTREGA';
                   
                   return (
                     <div 
                       key={ag.id}
                       className="bg-[#11131a]/60 p-6 rounded-[2.5rem] border border-[#1b1c24] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-red-950/50 hover:bg-[#13151f]/80 transition-all group"
                     >
                       <div className="flex items-center gap-5 cursor-pointer flex-1" onClick={() => setSelectedLead(ag.lead)}>
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black uppercase shadow-inner border shrink-0 ${
                           isProntaEntrega ? 'bg-amber-950/30 text-amber-400 border-amber-900/30' : 'bg-red-950/30 text-red-400 border-red-900/30'
                         }`}>
                           {isProntaEntrega ? <Car size={24} /> : <Shield size={24} />}
                         </div>
                         <div>
                           <h3 className="font-black text-white text-lg tracking-tight group-hover:text-red-400 transition-colors flex items-center gap-2">
                             {ag.lead.nome}
                           </h3>
                           <div className="flex flex-wrap items-center gap-3 mt-1">
                             <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                               ag.status === 'REALIZADO' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/20' :
                               ag.status === 'CANCELADO' ? 'bg-rose-950/20 text-rose-400 border-rose-900/20' :
                               'bg-blue-950/20 text-blue-400 border-blue-900/20'
                             }`}>
                               {ag.status === 'REALIZADO' ? 'Realizado' : ag.status === 'CANCELADO' ? 'Cancelado' : 'Agendado'}
                             </span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase">{ag.lead.contato}</span>
                             <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">{dataFormatada}</span>
                           </div>
                           {ag.observacao && (
                             <p className="text-xs text-slate-400 mt-2 font-medium bg-slate-950/30 px-3 py-1.5 rounded-lg border border-slate-900/50 w-fit">
                               {ag.observacao}
                             </p>
                           )}
                         </div>
                       </div>
                       <div className="flex items-center gap-2 self-end md:self-center">
                         {ag.status === 'AGENDADO' && (
                           <>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleUpdateAgendamentoStatus(ag.id, 'REALIZADO');
                               }}
                               className="w-10 h-10 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all"
                               title="Marcar como realizado"
                             >
                               <Check size={18} />
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleUpdateAgendamentoStatus(ag.id, 'CANCELADO');
                               }}
                               className="w-10 h-10 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                               title="Marcar como cancelado"
                             >
                               <X size={18} />
                             </button>
                           </>
                         )}
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             handleDeleteAgendamento(ag.id);
                           }}
                           className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-500 hover:bg-red-950/40 hover:text-red-400 flex items-center justify-center transition-all"
                           title="Excluir agendamento"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )
          ) : activeView === 'TABELA' ? (
             /* --- MODO PLANILHA (LINHAS DETALHADAS) --- */
             leadsFiltrados.length === 0 ? (
               <div className="text-center py-24 bg-[#11131a]/40 rounded-[3rem] border border-dashed border-[#1b1c24]">
                  <Users className="mx-auto text-slate-800 mb-6" size={64} />
                  <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Nenhum registro encontrado.</p>
               </div>
             ) : (
               <div className="overflow-x-auto rounded-[2rem] border border-[#1b1c24] bg-[#11131a]/60 shadow-2xl">
                 <table className="w-full text-left border-collapse min-w-[1200px]">
                   <thead>
                     <tr className="border-b border-[#1b1c24] bg-[#151722]/80 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                       <th className="py-5 px-6">Data</th>
                       <th className="py-5 px-6">Nome do Cliente</th>
                       <th className="py-5 px-6">Telefone</th>
                       <th className="py-5 px-6">Veio de</th>
                       <th className="py-5 px-6 max-w-[200px]">1ª Mensagem</th>
                       <th className="py-5 px-6">Serviço</th>
                       <th className="py-5 px-6">Veículo</th>
                       <th className="py-5 px-6">Comercial</th>
                       <th className="py-5 px-6">Conversão</th>
                       <th className="py-5 px-6">Status</th>
                       <th className="py-5 px-6 text-right">Faturado</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#1b1c24]/50 text-sm text-slate-300">
                     {leadsFiltrados.map(lead => {
                       const formattedDate = new Date(lead.data).toLocaleDateString('pt-BR');
                       const rowColorClass = 
                          lead.status === 'PERDIDO' ? 'bg-red-950/15 hover:bg-red-900/25 text-red-200' :
                          lead.status === 'FECHADO' ? 'bg-emerald-950/15 hover:bg-emerald-900/25 text-emerald-200' :
                          lead.status === 'NOVO' ? 'bg-blue-950/15 hover:bg-blue-900/25 text-blue-200' :
                          'bg-amber-950/10 hover:bg-amber-900/20 text-amber-200';

                       return (
                         <tr 
                           key={lead.id}
                           onClick={() => setSelectedLead(lead)}
                           className={`${rowColorClass} transition-all cursor-pointer group`}
                         >
                           <td className="py-4 px-6 font-bold text-xs">{formattedDate}</td>
                           <td className="py-4 px-6 font-black">{lead.nome}</td>
                           <td className="py-4 px-6 font-bold text-xs">{lead.contato || '-'}</td>
                           <td className="py-4 px-6">
                             <span className="text-[9px] font-black tracking-widest uppercase bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-md">
                               {lead.origem || '-'}
                             </span>
                           </td>
                           <td className="py-4 px-6 text-xs max-w-[200px] truncate text-slate-400" title={lead.primeira_mensagem}>
                             {lead.primeira_mensagem || '-'}
                           </td>
                           <td className="py-4 px-6 text-xs font-semibold">{lead.tipo_servico || '-'}</td>
                           <td className="py-4 px-6 text-xs font-black text-slate-200">{lead.veiculo || '-'}</td>
                           <td className="py-4 px-6 text-xs font-semibold">{lead.comercial || '-'}</td>
                           <td className="py-4 px-6">
                             <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                               lead.status === 'FECHADO' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/20' :
                               lead.status === 'PERDIDO' ? 'bg-rose-950/20 text-rose-400 border-rose-900/20' :
                               lead.status === 'NEGOCIACAO' ? 'bg-amber-950/20 text-amber-400 border-amber-900/20' :
                               lead.status === 'CONTATO' ? 'bg-blue-950/20 text-blue-400 border-blue-900/20' :
                               'bg-slate-900 text-slate-500 border-slate-800'
                             }`}>
                               {lead.status}
                             </span>
                           </td>
                           <td className="py-4 px-6 text-xs font-medium text-slate-400 max-w-[200px] truncate" title={lead.conversao || ''}>
                              {lead.conversao || '-'}
                            </td>
                           <td className="py-4 px-6 text-right font-black text-xs text-white">
                             {lead.valor && Number(lead.valor) > 0 
                               ? `R$ ${Number(lead.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                               : '-'
                             }
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             )
          ) : activeView === 'KANBAN' ? (
             /* --- MODO KANBAN BOARD --- */
             <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-h-[500px] pb-6">
               {[
                 { key: 'NOVO', title: 'Novo', color: 'border-slate-800 text-slate-400 bg-slate-950/20' },
                 { key: 'CONTATO', title: 'Contato', color: 'border-blue-950 text-blue-400 bg-blue-950/10' },
                 { key: 'NEGOCIACAO', title: 'Negociação', color: 'border-amber-950 text-amber-400 bg-amber-950/10' },
                 { key: 'FECHADO', title: 'Fechado (Ganho)', color: 'border-emerald-950 text-emerald-400 bg-emerald-950/10' },
                 { key: 'PERDIDO', title: 'Perdido', color: 'border-rose-950 text-rose-400 bg-rose-950/10' }
               ].map(col => {
                 const colLeads = leadsFiltrados.filter(l => l.status === col.key);
                 return (
                   <div 
                     key={col.key} 
                     className="bg-[#11131a]/70 rounded-[2rem] border border-[#1b1c24] p-4 flex flex-col gap-4 min-w-[220px]"
                   >
                     {/* Header do Kanban */}
                     <div className={`p-4 rounded-2xl border shrink-0 ${col.color} flex justify-between items-center`}>
                       <span className="text-[10px] font-black uppercase tracking-widest">{col.title}</span>
                       <span className="text-[11px] font-black bg-[#0a0b0e] px-2 py-0.5 rounded-md text-slate-300">{colLeads.length}</span>
                     </div>

                     {/* Cards do Kanban */}
                     <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] scrollbar-thin">
                       {colLeads.map(lead => (
                         <div 
                           key={lead.id}
                           onClick={() => setSelectedLead(lead)}
                           className="bg-[#0e0f14] border border-[#1b1c24] hover:border-red-950/40 p-4 rounded-2xl cursor-pointer hover:bg-[#13151f] transition-all group space-y-3 relative"
                         >
                           <div>
                             <h4 className="font-black text-sm text-white group-hover:text-red-400 transition-colors line-clamp-1">{lead.nome}</h4>
                             <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">{new Date(lead.data).toLocaleDateString('pt-BR')}</p>
                           </div>

                           {(lead.veiculo || lead.comercial) && (
                             <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60">
                               {lead.veiculo && lead.veiculo !== 'X' && (
                                 <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300">
                                   <Car size={10} className="text-red-500 shrink-0" />
                                   <span className="truncate">{lead.veiculo}</span>
                                 </div>
                               )}
                               {lead.comercial && lead.comercial !== 'X' && (
                                 <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                                   <span className="text-red-500">👤</span>
                                   <span>Vendedor: {lead.comercial}</span>
                                 </div>
                               )}
                             </div>
                           )}

                           {/* Valor Faturado rápido no card */}
                           {lead.valor && Number(lead.valor) > 0 && (
                             <div className="text-[10px] font-black text-emerald-400 flex items-center gap-0.5 bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-900/20 w-fit">
                               <DollarSign size={10} />
                               <span>{Number(lead.valor).toLocaleString('pt-BR')}</span>
                             </div>
                           )}

                           {/* Botões Rápidos de Mudança de Status */}
                           <div className="flex justify-between items-center border-t border-[#1b1c24]/50 pt-2 shrink-0">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 const phases = ['NOVO', 'CONTATO', 'NEGOCIACAO', 'FECHADO', 'PERDIDO'];
                                 const currIdx = phases.indexOf(lead.status);
                                 if (currIdx > 0) handleUpdateStatus(lead.id, phases[currIdx - 1]);
                               }}
                               disabled={lead.status === 'NOVO'}
                               className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-500 flex items-center justify-center disabled:opacity-30 disabled:hover:text-slate-400"
                               title="Recuar Fase"
                             >
                               <ChevronLeft size={12} />
                             </button>
                             <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Fase</span>
                             <button
                               onClick={(e) => {

                                 const phases = ['NOVO', 'CONTATO', 'NEGOCIACAO', 'FECHADO', 'PERDIDO'];
                                 const currIdx = phases.indexOf(lead.status);
                                 if (currIdx < phases.length - 1) handleUpdateStatus(lead.id, phases[currIdx + 1]);
                               }}
                               disabled={lead.status === 'PERDIDO'}
                               className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-500 flex items-center justify-center disabled:opacity-30 disabled:hover:text-slate-400"
                               title="Avançar Fase"
                             >
                               <ChevronRight size={12} />
                             </button>
                           </div>
                         </div>
                       ))}
                       {colLeads.length === 0 && (
                         <div className="py-8 text-center text-[10px] text-slate-600 font-black uppercase tracking-wider border border-dashed border-slate-900 rounded-2xl">
                           Coluna Vazia
                         </div>
                       )}
                     </div>
                   </div>
                 );
               })}
             </div>
          ) : (
             /* --- MODO DASHBOARD --- */
             <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total de Leads</p>
                      <p className="text-3xl font-black text-white mt-2">{dashboardStats.totalLeads}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-red-950/20 border border-red-900/20 text-red-500 flex items-center justify-center">
                      <Users size={20} />
                    </div>
                  </div>

                  <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Leads Ativos</p>
                      <p className="text-3xl font-black text-amber-500 mt-2">{dashboardStats.leadsAtivos}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-950/20 border border-amber-900/20 text-amber-500 flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                  </div>

                  <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Faturamento Real</p>
                      <p className="text-2xl font-black text-emerald-400 mt-2">
                        R$ {dashboardStats.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-950/20 border border-emerald-900/20 text-emerald-500 flex items-center justify-center">
                      <DollarSign size={20} />
                    </div>
                  </div>

                  <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Taxa de Conversão</p>
                      <p className="text-3xl font-black text-white mt-2">{dashboardStats.taxaConversao}%</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-950/20 border border-blue-900/20 text-blue-500 flex items-center justify-center">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                </div>

               {/* Gráficos de Veículos (Mais Procurados vs Vendidos vs Assistência) */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Veículos Procurados (Active) */}
                 <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2.5rem] shadow-xl space-y-4">
                   <div className="flex items-center gap-2.5 border-b border-[#1b1c24] pb-3">
                     <Car className="text-amber-500" size={18} />
                     <h3 className="text-sm font-black uppercase tracking-widest text-white">Carros Mais Procurados</h3>
                   </div>
                   <div className="space-y-4">
                     {dashboardStats.topProcurados.length === 0 ? (
                       <p className="text-xs text-slate-500 italic">Sem registros suficientes de veículos ativos.</p>
                     ) : (
                       dashboardStats.topProcurados.map((item, idx) => {
                         const max = Math.max(...dashboardStats.topProcurados.map(i => i.count));
                         const percentage = max > 0 ? (item.count / max) * 100 : 0;
                         return (
                           <div key={idx} className="space-y-1.5">
                             <div className="flex justify-between text-xs font-bold text-slate-300">
                               <span>{item.nome}</span>
                               <span className="text-amber-500 font-black">{item.count} leads</span>
                             </div>
                             <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                               <div className="bg-amber-600 h-full rounded-full" style={{ width: `${percentage}%` }} />
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                 </div>

                 {/* Veículos Vendidos */}
                 <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2.5rem] shadow-xl space-y-4">
                   <div className="flex items-center gap-2.5 border-b border-[#1b1c24] pb-3">
                     <Shield className="text-emerald-500" size={18} />
                     <h3 className="text-sm font-black uppercase tracking-widest text-white">Carros Vendidos (Ganhos)</h3>
                   </div>
                   <div className="space-y-4">
                     {dashboardStats.topVendidos.length === 0 ? (
                       <p className="text-xs text-slate-500 italic">Nenhum veículo vendido ainda.</p>
                     ) : (
                       dashboardStats.topVendidos.map((item, idx) => {
                         const max = Math.max(...dashboardStats.topVendidos.map(i => i.count));
                         const percentage = max > 0 ? (item.count / max) * 100 : 0;
                         return (
                           <div key={idx} className="space-y-1.5">
                             <div className="flex justify-between text-xs font-bold text-slate-300">
                               <span>{item.nome}</span>
                               <span className="text-emerald-400 font-black">
                                 {item.count} {item.count === 1 ? 'fechado' : 'fechados'}
                                 {item.valor > 0 && ` • R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                               </span>
                             </div>
                             <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                               <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                 </div>

                 {/* Assistência Técnica (Ganhos) */}
                 <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2.5rem] shadow-xl space-y-4">
                   <div className="flex items-center justify-between border-b border-[#1b1c24] pb-3">
                     <div className="flex items-center gap-2.5">
                       <Briefcase className="text-blue-400" size={18} />
                       <h3 className="text-sm font-black uppercase tracking-widest text-white">Assistência Técnica</h3>
                     </div>
                     <span className="text-xs font-black text-emerald-400">
                       R$ {dashboardStats.faturamentoAssistencia.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                     </span>
                   </div>
                   <div className="space-y-4">
                     {dashboardStats.topAssistencias.length === 0 ? (
                       <p className="text-xs text-slate-500 italic">Nenhum veículo em assistência ainda.</p>
                     ) : (
                       dashboardStats.topAssistencias.map((item, idx) => {
                         const max = Math.max(...dashboardStats.topAssistencias.map(i => i.count));
                         const percentage = max > 0 ? (item.count / max) * 100 : 0;
                         return (
                           <div key={idx} className="space-y-1.5">
                             <div className="flex justify-between text-xs font-bold text-slate-300">
                               <span>{item.nome}</span>
                               <span className="text-blue-400 font-black">{item.count} concluídos</span>
                             </div>
                             <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                               <div className="bg-blue-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                 </div>
               </div>

               {/* Origem de Canais */}
               <div className="bg-[#11131a]/60 border border-[#1b1c24] p-6 rounded-[2.5rem] shadow-xl space-y-4 max-w-2xl">
                 <div className="flex items-center gap-2.5 border-b border-[#1b1c24] pb-3">
                   <TrendingUp className="text-red-500" size={18} />
                   <h3 className="text-sm font-black uppercase tracking-widest text-white">Origem dos Leads (De Onde Vêm)</h3>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                   {dashboardStats.topOrigens.length === 0 ? (
                     <p className="text-xs text-slate-500 italic col-span-2">Sem informações de origens registradas.</p>
                   ) : (
                     dashboardStats.topOrigens.map((item, idx) => {
                       const total = dashboardStats.totalLeads;
                       const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : '0';
                       return (
                         <div key={idx} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-900 flex items-center justify-between">
                           <div>
                             <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.nome}</span>
                             <p className="text-xl font-black text-white mt-1">{item.count} leads</p>
                           </div>
                           <span className="text-xs font-black bg-red-950/20 text-red-400 border border-red-900/20 px-3 py-1.5 rounded-xl">
                             {pct}%
                           </span>
                         </div>
                       );
                     })
                   )}
                 </div>
               </div>
             </div>
          )}
        </div>
      </main>

      {/* --- DETALHE LATERAL DO LEAD COM EDICÃO --- */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-[#06070a]/90 backdrop-blur-md" onClick={() => { setSelectedLead(null); setIsEditing(false); }} />
           <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[#0e0f14] border-l border-red-950/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col animate-in slide-in-from-right duration-500">
              
              {/* Header do Detalhe */}
              <div className="p-6 border-b border-red-950/10 flex items-center justify-between bg-[#11131a]/40">
                <button 
                  onClick={() => { setSelectedLead(null); setIsEditing(false); }} 
                  className="w-12 h-12 flex items-center justify-center hover:bg-slate-900 rounded-2xl text-slate-500 hover:text-slate-300 transition-all"
                >
                  <X size={24}/>
                </button>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={() => {
                       if (isEditing) {
                         setIsEditing(false);
                       } else {
                         setIsEditing(true);
                       }
                     }}
                     className="px-5 py-2.5 rounded-xl bg-red-950/20 hover:bg-red-900/10 border border-red-900/30 text-red-500 hover:text-red-400 text-xs font-black uppercase tracking-widest transition-all"
                   >
                     {isEditing ? 'Cancelar' : 'Editar'}
                   </button>
                 </div>
               </div>

               {/* Body do Detalhe */}
               <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {isEditing ? (
                   <form onSubmit={handleUpdateLeadDetails} className="space-y-6">
                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Contato</label>
                       <input 
                         required
                         type="text" 
                         value={editedLead.contato || ''} 
                         onChange={e => setEditedLead({...editedLead, contato: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                       />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Origem (Veio)</label>
                         <input 
                           type="text" 
                           value={editedLead.origem || ''} 
                           onChange={e => setEditedLead({...editedLead, origem: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                         />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vendedor (Comercial)</label>
                         <input 
                           type="text" 
                           value={editedLead.comercial || ''} 
                           onChange={e => setEditedLead({...editedLead, comercial: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                         />
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Serviço</label>
                         <input 
                           type="text" 
                           value={editedLead.tipo_servico || ''} 
                           onChange={e => setEditedLead({...editedLead, tipo_servico: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                         />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Status (Detalhamento/Observação)</label>
                         <input 
                           type="text" 
                           value={editedLead.conversao || ''} 
                           onChange={e => setEditedLead({...editedLead, conversao: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                         />
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Veículo</label>
                         <input 
                           type="text" 
                           value={editedLead.veiculo || ''} 
                           onChange={e => setEditedLead({...editedLead, veiculo: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                         />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Faturamento (R$)</label>
                         <input 
                           type="number" 
                           step="any"
                           value={editedLead.valor || '0'} 
                           onChange={e => setEditedLead({...editedLead, valor: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                         />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Primeira Mensagem</label>
                       <textarea 
                         value={editedLead.primeira_mensagem || ''} 
                         onChange={e => setEditedLead({...editedLead, primeira_mensagem: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all min-h-[60px]"
                       />
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Fase do Lead (Conversão)</label>
                       <select 
                         value={editedLead.status || 'NOVO'} 
                         onChange={e => setEditedLead({...editedLead, status: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                       >
                         <option value="NOVO">NOVO</option>
                         <option value="CONTATO">CONTATO</option>
                         <option value="NEGOCIACAO">NEGOCIACAO</option>
                         <option value="FECHADO">FECHADO</option>
                         <option value="PERDIDO">PERDIDO</option>
                       </select>
                     </div>

                     <button
                       type="submit"
                       className="w-full bg-red-700 hover:bg-red-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-4"
                     >
                       Salvar Alterações
                     </button>
                   </form>
                 ) : (
                   /* --- VISUALIZAÇÃO DE INFORMAÇÕES DO LEAD --- */
                   <>
                     <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-red-950/20 text-red-400 rounded-[2rem] border border-red-950/40 flex items-center justify-center text-3xl font-black mb-4 shadow-inner">
                          {selectedLead.nome.charAt(0)}
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tighter leading-tight">{selectedLead.nome}</h3>
                        <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-1.5">{selectedLead.contato || 'Sem contato cadastrado'}</p>
                        
                        {selectedLead.origem === 'Seguidor Instagram' ? (
                          <div className="flex flex-col gap-2.5 mt-6 w-full">
                            <button 
                              id="btn-send-welcome-direct"
                              onClick={() => handleSendDirect(selectedLead.id, `Olá! Obrigado por seguir a Solution Place. Seja bem-vindo à nossa Factory Boutique. Somos especialistas em blindagem inteligente e ultraleve (Solution Air) e parceiros oficiais das maiores concessionárias do Rio. Para te atender com exclusividade, gostaria de agendar uma consultoria técnica em nossa fábrica ou prefere conhecer nosso catálogo de veículos blindados a pronta-entrega?`)}
                              disabled={sendingDirect}
                              className="w-full bg-red-700 hover:bg-red-600 text-white p-4 rounded-xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            >
                              {sendingDirect ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Send size={14} />
                              )}
                              <span>{directStatus || 'Enviar Boas-vindas (Direct)'}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3 mt-6 w-full">
                             <a href={`https://wa.me/${selectedLead.contato?.replace(/\D/g,'')}`} target="_blank" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all">
                               <MessageCircle size={16}/> WhatsApp
                             </a>
                             <a href={`tel:${selectedLead.contato?.replace(/\D/g,'')}`} className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 p-4 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest border border-slate-850 active:scale-95 transition-all">
                               <Phone size={16}/> Ligar
                             </a>
                          </div>
                        )}
                     </div>

                     {/* Grid de Informações Offline Nativas */}
                     <div className="bg-slate-950/50 p-5 rounded-[2rem] border border-slate-900 space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-900 pb-2">Informações Operacionais</h4>
                       
                       <div className="grid grid-cols-2 gap-4 text-xs">
                         <div>
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Veículo</span>
                           <p className="font-black text-slate-200 mt-0.5">{selectedLead.veiculo || 'X'}</p>
                         </div>
                         <div>
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Comercial</span>
                           <p className="font-bold text-slate-200 mt-0.5">{selectedLead.comercial || 'X'}</p>
                         </div>
                         <div>
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Tipo de Serviço</span>
                           <p className="font-bold text-slate-200 mt-0.5">{selectedLead.tipo_servico || 'X'}</p>
                         </div>
                         <div>
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Status</span>
                           <p className="font-bold text-slate-200 mt-0.5">{selectedLead.conversao || 'X'}</p>
                         </div>
                         <div>
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Faturamento</span>
                           <p className="font-black text-emerald-400 mt-0.5">
                             {selectedLead.valor && Number(selectedLead.valor) > 0 
                               ? `R$ ${Number(selectedLead.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                               : 'R$ 0,00'
                             }
                           </p>
                         </div>
                         <div>
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Origem</span>
                           <p className="font-bold text-slate-200 mt-0.5">{selectedLead.origem || 'X'}</p>
                         </div>
                       </div>

                       {selectedLead.primeira_mensagem && (
                         <div className="border-t border-slate-900 pt-3">
                           <span className="text-[9px] font-bold text-slate-500 uppercase">1ª Mensagem do Cliente</span>
                           <p className="text-xs text-slate-300 mt-1 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-900">
                             "{selectedLead.primeira_mensagem}"
                           </p>
                         </div>
                       )}
                     </div>

                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Conversão do Lead (Fase)</p>
                        <div className="grid grid-cols-2 gap-2">
                           {['CONTATO', 'NEGOCIACAO', 'FECHADO', 'PERDIDO'].map(st => (
                             <button 
                               key={st}
                               onClick={() => handleUpdateStatus(selectedLead.id, st)}
                               className={`p-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                 selectedLead.status === st 
                                 ? 'bg-red-700 border-red-600 text-white shadow-md' 
                                 : 'bg-slate-900 border-[#1b1c24] text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                               }`}
                             >
                               {st}
                             </button>
                           ))}
                        </div>
                     </div>

                     {/* Agendamentos do Lead */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between ml-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agendamentos e Visitas</p>
                           <button
                             onClick={() => setShowAddAgendamento(!showAddAgendamento)}
                             className="flex items-center gap-1.5 text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                           >
                             {showAddAgendamento ? <X size={14} /> : <Plus size={14} />}
                             <span>{showAddAgendamento ? 'Cancelar' : 'Agendar'}</span>
                           </button>
                        </div>

                        {showAddAgendamento ? (
                           <form onSubmit={handleAddAgendamento} className="bg-slate-950/80 p-5 rounded-2xl border border-red-950/20 space-y-4 animate-in slide-in-from-top duration-300">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Serviço</label>
                                 <div className="grid grid-cols-2 gap-2">
                                    <button
                                       type="button"
                                       onClick={() => setNewAgendamento({ ...newAgendamento, tipo: 'PRONTA_ENTREGA' })}
                                       className={`p-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                          newAgendamento.tipo === 'PRONTA_ENTREGA'
                                          ? 'bg-red-700 border-red-600 text-white shadow-md'
                                          : 'bg-slate-900 border-[#1b1c24] text-slate-500'
                                       }`}
                                    >
                                       Pronta Entrega
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => setNewAgendamento({ ...newAgendamento, tipo: 'BLINDAGEM' })}
                                       className={`p-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                          newAgendamento.tipo === 'BLINDAGEM'
                                          ? 'bg-red-700 border-red-600 text-white shadow-md'
                                          : 'bg-slate-900 border-[#1b1c24] text-slate-500'
                                       }`}
                                    >
                                       Blindagem Própria
                                    </button>
                                 </div>
                              </div>

                              <div className="space-y-2">
                                 <label htmlFor="agendamento-data" className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Data e Hora</label>
                                 <input
                                    id="agendamento-data"
                                    required
                                    type="datetime-local"
                                    value={newAgendamento.data_hora}
                                    onChange={e => setNewAgendamento({ ...newAgendamento, data_hora: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-white outline-none focus:border-red-800/40 transition-all"
                                 />
                              </div>

                              <div className="space-y-2">
                                 <label htmlFor="agendamento-obs" className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Observações / Detalhes</label>
                                 <textarea
                                    id="agendamento-obs"
                                    placeholder="Modelo do veículo, detalhes do atendimento..."
                                    value={newAgendamento.observacao}
                                    onChange={e => setNewAgendamento({ ...newAgendamento, observacao: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-white outline-none focus:border-red-800/40 min-h-[60px] resize-none"
                                 />
                              </div>

                              <button
                                 type="submit"
                                 disabled={submittingAgendamento}
                                 className="w-full bg-red-700 hover:bg-red-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                 {submittingAgendamento && <Loader2 className="animate-spin" size={14} />}
                                 Confirmar Agendamento
                              </button>
                           </form>
                        ) : (
                           <div className="space-y-3">
                              {selectedLead.agendamentos && selectedLead.agendamentos.length > 0 ? (
                                 selectedLead.agendamentos.map(ag => {
                                    const formattedDate = new Date(ag.data_hora).toLocaleString('pt-BR', {
                                       day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    });
                                    const isProntaEntrega = ag.tipo === 'PRONTA_ENTREGA';
                                    return (
                                       <div key={ag.id} className="bg-slate-900/60 p-4 rounded-2xl border border-[#1b1c24] flex items-start justify-between gap-3">
                                          <div className="flex items-center gap-3">
                                             <div className={`w-9 h-9 rounded-xl flex items-center justify-center border text-xs shrink-0 ${
                                                isProntaEntrega ? 'bg-amber-950/30 text-amber-400 border-amber-900/20' : 'bg-red-950/30 text-red-400 border-red-950/40'
                                             }`}>
                                                {isProntaEntrega ? <Car size={16} /> : <Shield size={16} />}
                                             </div>
                                             <div>
                                                <p className="text-xs font-black text-white leading-tight">
                                                   {isProntaEntrega ? 'Compra Pronta Entrega' : 'Blindagem Veículo'}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{formattedDate}</p>
                                                {ag.observacao && <p className="text-[10px] text-slate-400 mt-1 italic font-medium">{ag.observacao}</p>}
                                                <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border mt-2 ${
                                                   ag.status === 'REALIZADO' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/20' :
                                                   ag.status === 'CANCELADO' ? 'bg-rose-950/20 text-rose-400 border-rose-900/20' :
                                                   'bg-blue-950/20 text-blue-400 border-blue-900/20'
                                                }`}>
                                                   {ag.status === 'REALIZADO' ? 'Realizado' : ag.status === 'CANCELADO' ? 'Cancelado' : 'Agendado'}
                                                </span>
                                             </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                             {ag.status === 'AGENDADO' && (
                                                <>
                                                   <button
                                                      onClick={() => handleUpdateAgendamentoStatus(ag.id, 'REALIZADO')}
                                                      className="w-7 h-7 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all"
                                                      title="Marcar Realizado"
                                                   >
                                                      <Check size={14} />
                                                   </button>
                                                   <button
                                                      onClick={() => handleUpdateAgendamentoStatus(ag.id, 'CANCELADO')}
                                                      className="w-7 h-7 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all"
                                                      title="Marcar Cancelado"
                                                   >
                                                      <X size={14} />
                                                   </button>
                                                </>
                                             )}
                                             <button
                                                onClick={() => handleDeleteAgendamento(ag.id)}
                                                className="w-7 h-7 rounded-lg bg-slate-950/50 border border-slate-900 text-slate-500 hover:bg-red-950/50 hover:text-red-400 flex items-center justify-center transition-all"
                                                title="Excluir"
                                             >
                                                <Trash2 size={13} />
                                             </button>
                                          </div>
                                       </div>
                                    );
                                 })
                              ) : (
                                 <div className="text-center py-6 bg-slate-950/30 rounded-2xl border border-dashed border-red-950/10">
                                    <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">Nenhum compromisso marcado.</p>
                                 </div>
                              )}
                           </div>
                        )}
                     </div>

                     {/* Histórico e Notas */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between ml-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Atendimentos / Notas</p>
                           <History size={16} className="text-slate-700" />
                        </div>
                        
                        <form onSubmit={handleAddNota} className="relative">
                           <textarea 
                             id="note-textarea"
                             value={novaNota}
                             onChange={e => setNovaNota(e.target.value)}
                             placeholder="Descreva o atendimento aqui..."
                             className="w-full bg-slate-950 border border-slate-900 rounded-[2rem] p-6 pr-16 text-sm text-white outline-none focus:border-red-800/40 min-h-[120px] resize-none shadow-inner"
                           />
                           <button id="send-note-btn" type="submit" className="absolute right-4 bottom-4 w-12 h-12 bg-red-700 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-red-600 active:scale-90 transition-all border border-red-600/20">
                             <Send size={20}/>
                           </button>
                        </form>

                        <div className="space-y-4 pt-4">
                           {selectedLead.notas?.map(nota => (
                              <div key={nota.id} className="bg-slate-900/50 p-6 rounded-[2rem] border border-[#1b1c24]">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{nota.autor}</span>
                                  <span className="text-[9px] text-slate-600 font-black uppercase">{new Date(nota.criado_em).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed font-medium">{nota.texto}</p>
                              </div>
                           ))}
                           {(!selectedLead.notas || selectedLead.notas.length === 0) && (
                              <div className="text-center py-10 bg-slate-950/30 rounded-3xl border border-dashed border-red-950/10">
                                 <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">Inicie o histórico deste lead.</p>
                              </div>
                           )}
                        </div>
                     </div>
                   </>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL PARA ADICIONAR NOVO LEAD (FORMULÁRIO ADAPTADO COMPLETO) --- */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-[#06070a]/90 backdrop-blur-md" onClick={() => setShowAddLead(false)} />
           <div className="relative bg-[#0e0f14] w-full max-w-2xl rounded-t-[3.5rem] sm:rounded-[3.5rem] p-8 sm:p-10 shadow-[0_-20px_100px_rgba(0,0,0,0.5)] border-t border-red-950/20 sm:border-l sm:border-t animate-in slide-in-from-bottom-20 duration-500 overflow-y-auto max-h-[90vh]">
              
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Novo Registro (Completo)</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Solution Operational Sync</p>
                 </div>
                 <button onClick={() => setShowAddLead(false)} className="w-12 h-12 bg-slate-900 rounded-2xl text-slate-500 flex items-center justify-center"><X size={24}/></button>
              </div>

              <form onSubmit={handleAddLead} className="space-y-5">
                  
                  {/* Linha 1: Data e Nome */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-date" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Data do Atendimento</label>
                       <input id="new-lead-date" required type="date" value={newLead.data} onChange={e => setNewLead({...newLead, data: e.target.value})} className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-name" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Nome do Cliente</label>
                       <input id="new-lead-name" required value={newLead.nome} onChange={e => setNewLead({...newLead, nome: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all" placeholder="Nome Completo" />
                    </div>
                  </div>

                  {/* Linha 2: Telefone e Origem */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-contact" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Telefone / Contato</label>
                       <input id="new-lead-contact" required value={newLead.contato} onChange={e => setNewLead({...newLead, contato: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all" placeholder="DDD + Número (Apenas números)" />
                    </div>
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-origin" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Veio de (Origem)</label>
                       <select id="new-lead-origin" value={newLead.origem} onChange={e => setNewLead({...newLead, origem: e.target.value})} className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all">
                         <option value="INSTAGRAM">INSTAGRAM</option>
                         <option value="FACEBOOK">FACEBOOK</option>
                         <option value="SITE">SITE</option>
                         <option value="OUTRO">OUTRO / OUTRAS INDICAÇÕES</option>
                       </select>
                    </div>
                  </div>

                  {/* Linha 3: Primeira Mensagem */}
                  <div className="space-y-1.5">
                     <label htmlFor="new-lead-msg" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">1ª Mensagem enviada pelo Cliente</label>
                     <textarea id="new-lead-msg" value={newLead.primeira_mensagem} onChange={e => setNewLead({...newLead, primeira_mensagem: e.target.value})} className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all min-h-[60px]" placeholder="Ex: Olá! Gostaria de um orçamento..." />
                  </div>

                  {/* Linha 4: Tipo de Serviço e Veículo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-service" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Tipo de Serviço</label>
                       <select id="new-lead-service" value={newLead.tipo_servico} onChange={e => setNewLead({...newLead, tipo_servico: e.target.value})} className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all">
                         <option value="BLINDAGEM">BLINDAGEM</option>
                         <option value="ASSISTÊNCIA">ASSISTÊNCIA</option>
                         <option value="COMPRA">COMPRA</option>
                         <option value="X">X (Nenhum)</option>
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-vehicle" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Veículo</label>
                       <input id="new-lead-vehicle" value={newLead.veiculo} onChange={e => setNewLead({...newLead, veiculo: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all" placeholder="Ex: BYD Song Plus" />
                    </div>
                  </div>

                  {/* Linha 5: Vendedor (Comercial) e Conversão (Fase) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-comercial" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Vendedor (Comercial)</label>
                       <select 
                         id="new-lead-comercial" 
                         value={newLead.comercial} 
                         onChange={e => {
                           if (e.target.value === 'ADICIONAR_NOVO') {
                             setNewLead({...newLead, comercial: 'ADICIONAR_NOVO'});
                           } else {
                             setNewLead({...newLead, comercial: e.target.value});
                           }
                         }} 
                         className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all"
                       >
                         {vendedoresDisponiveis.map(v => (
                           <option key={v} value={v}>{v}</option>
                         ))}
                         <option value="ADICIONAR_NOVO">➕ ADICIONAR NOVO VENDEDOR...</option>
                       </select>
                       
                       {newLead.comercial === 'ADICIONAR_NOVO' && (
                         <input 
                           type="text" 
                           required
                           placeholder="Nome do Novo Vendedor" 
                           value={customComercial} 
                           onChange={e => setCustomComercial(e.target.value.toUpperCase())}
                           className="w-full bg-slate-950 border border-red-900/30 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all mt-2 animate-in slide-in-from-top-2 duration-200"
                         />
                       )}
                    </div>
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-status" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Conversão (Fase Inicial)</label>
                       <select id="new-lead-status" value={newLead.status} onChange={e => setNewLead({...newLead, status: e.target.value})} className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all">
                         <option value="NOVO">NOVO</option>
                         <option value="CONTATO">CONTATO</option>
                         <option value="NEGOCIACAO">NEGOCIACAO</option>
                         <option value="FECHADO">FECHADO</option>
                         <option value="PERDIDO">PERDIDO</option>
                       </select>
                    </div>
                  </div>

                  {/* Linha 6: Status (Detalhamento) e Valor Faturado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-conversion" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Status (Detalhamento/Observação)</label>
                       <input id="new-lead-conversion" type="text" value={newLead.conversao} onChange={e => setNewLead({...newLead, conversao: e.target.value})} className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all" placeholder="Ex: Contrato em andamento / Rayane" />
                    </div>
                    <div className="space-y-1.5">
                       <label htmlFor="new-lead-value" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Valor Faturado (R$)</label>
                       <input id="new-lead-value" value={newLead.valor} onChange={e => setNewLead({...newLead, valor: e.target.value})} type="number" step="any" className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 text-sm text-white outline-none focus:border-red-800/40 transition-all" placeholder="0.00" />
                    </div>
                  </div>

                 <button id="btn-register-lead" type="submit" className="w-full bg-red-700 hover:bg-red-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-red-950/40 mt-6 active:scale-95 transition-all border border-red-600/30">
                   Registrar no Solution Hub
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
