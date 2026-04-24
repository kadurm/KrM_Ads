// KrM Ads - Sistema de Gestao Profissional (Build v2)
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  LayoutDashboard,
  FileText,
  ImageIcon,
  Settings,
  Plus,
  Sparkles,
  Download,
  MessageCircle,
  TrendingUp,
  RefreshCw,
  Target,
  DollarSign,
  ShoppingCart,
  Eye,
  MousePointerClick,
  Database,
  Megaphone,
  Play,
  Pause,
  Pencil,
  Check,
  X,
  Loader2,
  Users,
  Trash2,
  Info,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Trophy,
  Medal
  } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

/** YYYY-MM-DD no fuso local. */
function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('relatorios');
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [clientesDisponiveis, setClientesDisponiveis] = useState([]);
  
  // Estados para Gestão de Clientes
  const [showNovoClienteForm, setShowNovoClienteForm] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: '', accountId: '' });
  const [isAddingCliente, setIsAddingCliente] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [perfilCliente, setPerfilCliente] = useState(null);
  
  const [analiseIA, setAnaliseIA] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [segmento, setSegmento] = useState('inside_sales');
  const [activeShortcut, setActiveShortcut] = useState('30d');
  
  const [startDate, setStartDate] = useState(() => {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    return formatDateLocal(trintaDiasAtras);
  });
  const [endDate, setEndDate] = useState(() => formatDateLocal(new Date()));
  
  const [relatorioDados, setRelatorioDados] = useState([]);
  const [criativosDados, setCriativosDados] = useState([]);
  const [investimento, setInvestimento] = useState(0); 
  const [faturamento, setFaturamento] = useState(0); 
  const [totalLeads, setTotalLeads] = useState(0); 
  const [totalCompras, setTotalCompras] = useState(0);
  const [vendasReais, setVendasReais] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mensagemPainel, setMensagemPainel] = useState(null);
  const [campaignsList, setCampaignsList] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [editBudget, setEditBudget] = useState('');
  const [dailyData, setDailyData] = useState([]);
  const [campaignsLevel, setCampaignsLevel] = useState('campaign'); // 'campaign', 'adset', 'ad'
  const [campaignsParentId, setCampaignsParentId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, PAUSED
  const [visibleColumns, setVisibleColumns] = useState(['spend', 'results', 'cpa']); // spend, results, cpa, impressions, ctr, clicks
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newObject, setNewObject] = useState({ name: '', objective: 'OUTCOME_TRAFFIC', budget: '20' });
  const reportRef = useRef(null);

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/clientes');
      const data = await res.json();
      if (data.success) {
        setClientesDisponiveis(data.clientes);
        if (data.clientes.length > 0 && !clienteSelecionado) {
          setClienteSelecionado(data.clientes[0].nome);
        }
      }
    } catch (e) { console.error("Erro ao carregar clientes:", e); }
  };

  const handleAddCliente = async (e) => {
    e.preventDefault();
    setIsAddingCliente(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoCliente.nome, meta_ads_account_id: novoCliente.accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setNovoCliente({ nome: '', accountId: '' });
        setShowNovoClienteForm(false);
        await loadClientes();
        setMensagemPainel({ tipo: 'sucesso', texto: 'Cliente vinculado com sucesso!' });
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao vincular cliente.' });
    } finally {
      setIsAddingCliente(false);
    }
  };

  const handleUpdateCliente = async (clienteData) => {
    try {
      const res = await fetch('/api/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clienteData),
      });
      const data = await res.json();
      if (data.success) {
        setEditingCliente(null);
        setPerfilCliente(null);
        await loadClientes();
        setMensagemPainel({ tipo: 'sucesso', texto: 'Cliente atualizado com sucesso!' });
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Erro ao atualizar cliente.' });
    }
  };

  const handleDeleteCliente = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      const res = await fetch(`/api/clientes?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadClientes();
        setMensagemPainel({ tipo: 'sucesso', texto: 'Cliente removido.' });
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Erro ao remover cliente.' });
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setMensagemPainel({ tipo: 'info', texto: 'Gerando PDF...' });
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        while (position < pdfHeight) {
          pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight);
          position += pageHeight;
          if (position < pdfHeight) pdf.addPage();
        }
      }
      pdf.save(`Relatorio_${clienteSelecionado.replace(/\s/g, '_')}_${startDate}_${endDate}.pdf`);
      setMensagemPainel(null);
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao gerar o PDF.' });
    }
  };

  const loadCampaigns = async (level = 'campaign', parentId = null) => {
    if (!clienteSelecionado) return;
    setCampaignsLoading(true);
    setCampaignsLevel(level);
    setCampaignsParentId(parentId);
    setSelectedIds([]); // Reseta seleção ao mudar de nível
    try {
      let url = `/api/meta/campaigns?cliente=${encodeURIComponent(clienteSelecionado)}&level=${level}`;
      if (parentId) url += `&parentId=${parentId}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setCampaignsList(data.items || []);
      else setMensagemPainel({ tipo: 'erro', texto: data.error });
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao carregar dados da Meta.' });
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleUpdateCampaign = async (id, updates) => {
    try {
      const res = await fetch('/api/meta/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: clienteSelecionado, id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingCampaign(null);
        await loadCampaigns(campaignsLevel, campaignsParentId);
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao atualizar objeto na Meta.' });
    }
  };

  const handleBulkUpdate = async (status) => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(`Deseja ${status === 'ACTIVE' ? 'ativar' : 'pausar'} os ${selectedIds.length} itens selecionados?`);
    if (!confirm) return;
    
    setCampaignsLoading(true);
    try {
      await Promise.all(selectedIds.map(id => 
        fetch('/api/meta/campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente: clienteSelecionado, id, status }),
        })
      ));
      await loadCampaigns(campaignsLevel, campaignsParentId);
      setMensagemPainel({ tipo: 'sucesso', texto: 'Ação em lote realizada com sucesso!' });
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha em algumas atualizações em lote.' });
    } finally {
      setCampaignsLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === campaignsList.length) setSelectedIds([]);
    else setSelectedIds(campaignsList.map(item => item.id));
  };

  const handleCreateObject = async (e) => {
    e.preventDefault();
    setCampaignsLoading(true);
    try {
      const payload = {
        cliente: clienteSelecionado,
        type: campaignsLevel,
        data: {
          name: newObject.name,
          status: 'PAUSED',
        }
      };

      if (campaignsLevel === 'campaign') {
        payload.data.objective = newObject.objective;
        payload.data.daily_budget = newObject.budget;
      } else if (campaignsLevel === 'adset') {
        payload.data.campaign_id = campaignsParentId;
        payload.data.daily_budget = newObject.budget;
      } else if (campaignsLevel === 'ad') {
        payload.data.adset_id = campaignsParentId;
        // Para anúncio, precisaríamos de um creative_id real. 
        // Aqui usaremos um placeholder ou o usuário precisará vincular depois.
        payload.data.creative_id = 'PLACEHOLDER'; 
      }

      const res = await fetch('/api/meta/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewObject({ name: '', objective: 'OUTCOME_TRAFFIC', budget: '20' });
        await loadCampaigns(campaignsLevel, campaignsParentId);
        setMensagemPainel({ tipo: 'sucesso', texto: 'Item criado com sucesso (Pausado por segurança).' });
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Erro ao criar objeto na Meta.' });
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadMetrics = useCallback(async () => {
    if (!clienteSelecionado) return;
    try {
      const url = new URL('/api/meta/sync', window.location.origin);
      url.searchParams.set('cliente', clienteSelecionado);
      url.searchParams.set('since', startDate);
      url.searchParams.set('until', endDate);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!data.success) {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
        return;
      }
      
      const mapped = (data.metrics || []).map((m) => {
        const valorInv = parseFloat(m.valor_investido) || 0;
        return {
          nome: m.campanha?.nome_gerado || 'Campanha',
          objetivo: m.objetivo || 'UNKNOWN',
          resultadoBruto: m.resultadoBruto || 0,
          impressoes: (m.impressoes || 0).toLocaleString(),
          rawImpressoes: m.impressoes || 0,
          alcance: (m.alcance || 0).toLocaleString(),
          rawAlcance: m.alcance || 0,
          cliques: (m.cliques || 0).toLocaleString(),
          rawCliques: m.cliques || 0,
          visitas: (m.visitas_perfil || 0).toLocaleString(),
          rawVisitas: m.visitas_perfil || 0,
          seguidores: (m.seguidores || 0).toLocaleString(),
          rawSeguidores: m.seguidores || 0,
          leads: m.conversas_leads || 0,
          compras: m.compras || 0,
          valor_compras: parseFloat(m.valor_compras) || 0,
          cpr: m.cpr > 0 ? `R$ ${m.cpr.toFixed(2)}` : '-',
          valor: `R$ ${valorInv.toFixed(2)}`,
          rawValor: valorInv,
          roas: parseFloat(m.roas) || 0
        };
      });
      
      setRelatorioDados(mapped);
      setInvestimento(mapped.reduce((acc, curr) => acc + curr.rawValor, 0).toFixed(2));
      setTotalLeads(mapped.reduce((acc, curr) => acc + curr.leads, 0));
      setTotalCompras(mapped.reduce((acc, curr) => acc + curr.compras, 0));
      setFaturamento(mapped.reduce((acc, curr) => acc + curr.valor_compras, 0).toFixed(2));
      if (data.criativos) setCriativosDados(data.criativos);
      if (data.dailyMetrics) setDailyData(data.dailyMetrics);

    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao carregar métricas.' });
    }
  }, [clienteSelecionado, startDate, endDate]);

  const handleSync = async () => {
    if (isSyncing || !clienteSelecionado) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since: startDate, until: endDate, cliente: clienteSelecionado }),
      });
      const data = await res.json();
      if (data.success) {
        setMensagemPainel(null);
        await loadMetrics();
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Erro na sincronização.' });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => { loadClientes(); }, []);
  useEffect(() => { if (clienteSelecionado) loadMetrics(); }, [loadMetrics, clienteSelecionado]);

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
    const base = "px-3 py-1.5 text-[11px] font-bold rounded transition-all";
    return activeShortcut === id ? `${base} bg-slate-700 text-blue-400 shadow-md border border-blue-500/20` : `${base} text-slate-400 hover:bg-slate-700/50`;
  };

  const dadosGrafico = React.useMemo(() => {
    const map = new Map();
    relatorioDados.forEach(item => {
      const nomeSimples = item.nome.split('][')[3]?.replace(']', '') || item.nome;
      const atual = map.get(nomeSimples) || 0;
      map.set(nomeSimples, atual + item.rawValor);
    });
    return Array.from(map.entries()).map(([nome, valor]) => ({ nome, rawValor: valor }))
      .sort((a, b) => b.rawValor - a.rawValor);
  }, [relatorioDados]);

  const handleGerarIA = async () => {
    setIsGenerating(true); setAnaliseIA("Gerando análise estratégica...");
    try {
      const totalImpressoes = relatorioDados.reduce((a,c) => a + c.rawImpressoes, 0);
      const totalCliques = relatorioDados.reduce((a,c) => a + c.rawCliques, 0);
      const totalLeadsCalc = relatorioDados.reduce((a,c) => a + c.leads, 0);
      const totalComprasCalc = relatorioDados.reduce((a,c) => a + c.compras, 0);

      const funil = {
        impressoes: totalImpressoes,
        engajamento: totalCliques,
        leads: totalLeadsCalc,
        conversoes: totalComprasCalc,
        taxaEngajamento: totalImpressoes > 0 ? ((totalCliques / totalImpressoes) * 100).toFixed(2) + '%' : '0%',
        taxaLeads: totalCliques > 0 ? ((totalLeadsCalc / totalCliques) * 100).toFixed(2) + '%' : '0%',
      };

      const criativosRanking = [...criativosDados]
        .map(c => ({
          nome: c.nome_anuncio,
          gasto: parseFloat(c.valor_investido).toFixed(2),
          leads: c.leads,
          impressoes: c.impressoes,
          ctr: parseFloat(c.ctr || 0).toFixed(2),
          cpa: c.leads > 0 ? (c.valor_investido / c.leads).toFixed(2) : 'Sem leads',
        }))
        .sort((a, b) => {
          const cpaA = a.cpa === 'Sem leads' ? Infinity : parseFloat(a.cpa);
          const cpaB = b.cpa === 'Sem leads' ? Infinity : parseFloat(b.cpa);
          return cpaA - cpaB;
        });

      const response = await fetch('/api/relatorios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeProjeto: clienteSelecionado,
          metricas: { faturamento, investimento, totalLeads, campanhas: relatorioDados },
          funil,
          criativosRanking,
          periodo: { de: startDate, ate: endDate },
        })
      });
      const data = await response.json();
      if (data.success) setAnaliseIA(data.analise);
      else setAnaliseIA("Erro na geração: " + data.error);
    } catch (error) {
      setAnaliseIA("Erro de comunicação.");
    } finally {
      setIsGenerating(false);
    }
  };

  const roas = investimento > 0 ? (faturamento / investimento).toFixed(2) : 0;

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      
      {/* SIDEBAR REORGANIZADA */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="text-blue-500" size={24} /> KrM Ads
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* SEÇÃO GLOBAL */}
          <div className="px-4 pt-6 pb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Administração Global</p>
            <nav className="space-y-1">
              <button onClick={() => setActiveTab('clientes')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'clientes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Users size={16} /> Gerenciar Empresas
              </button>
            </nav>
          </div>

          {/* SEÇÃO WORKSPACE (CLIENTE) */}
          <div className="px-4 pt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Workspace: {clienteSelecionado || '...'}</p>
            <nav className="space-y-1">
              <button onClick={() => setActiveTab('relatorios')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'relatorios' ? 'bg-slate-800 text-blue-400 border border-blue-500/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <FileText size={16} /> Auditoria de Resultados
              </button>
              <button onClick={() => { setActiveTab('campanhas'); loadCampaigns(); }} className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'campanhas' ? 'bg-slate-800 text-blue-400 border border-blue-500/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Megaphone size={16} /> Campanhas (Meta)
              </button>
              <button onClick={() => setActiveTab('entrada')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'entrada' ? 'bg-slate-800 text-blue-400 border border-blue-500/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Database size={16} /> Dados Adicionais (ROI)
              </button>
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
           <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-black uppercase tracking-tighter">KrM</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white truncate">Operador KrM</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">Sessão Ativa</p>
              </div>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
             <Briefcase className="text-blue-500/50" size={16} />
             <h2 className="font-semibold uppercase tracking-widest text-[10px] text-slate-400">Ambiente de Operação KrM Ads</h2>
          </div>
          <select value={clienteSelecionado} onChange={(e) => setClienteSelecionado(e.target.value)} className="bg-slate-800 text-[11px] font-black uppercase p-2 px-4 rounded-xl outline-none cursor-pointer border border-slate-700 hover:border-blue-500/50 transition-all text-blue-400 shadow-lg">
            {clientesDisponiveis.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {mensagemPainel && (
            <div className={`p-4 rounded-xl font-bold text-xs flex items-center gap-2 ${mensagemPainel.tipo === 'erro' ? 'bg-red-600/20 text-red-400 border border-red-500/20' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'}`}>
              {mensagemPainel.tipo === 'erro' ? <X size={14} /> : <Check size={14} />}
              {mensagemPainel.texto}
              <button onClick={() => setMensagemPainel(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14}/></button>
            </div>
          )}

          {activeTab === 'relatorios' && (
            <div ref={reportRef} className="space-y-6">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Performance Global</h1>
                  <p className="text-slate-500 text-sm mt-1">Dados auditados: <strong>{clienteSelecionado}</strong></p>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-sm flex-wrap">
                  <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
                    {[
                      { id: 'hoje', label: 'Hoje' },
                      { id: 'ontem', label: 'Ontem' },
                      { id: '7d', label: '7 Dias' },
                      { id: 'este_mes', label: 'Este Mês' },
                      { id: 'mes_passado', label: 'Mês Passado' },
                    ].map(s => (
                      <button key={s.id} onClick={() => handleShortcut(s.id)} className={getShortcutClass(s.id)}>{s.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveShortcut(null); }} className="bg-slate-800 text-[11px] font-bold text-slate-300 p-1.5 rounded-lg border border-slate-700 outline-none" />
                    <span className="text-slate-600 text-xs">→</span>
                    <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveShortcut(null); }} className="bg-slate-800 text-[11px] font-bold text-slate-300 p-1.5 rounded-lg border border-slate-700 outline-none" />
                  </div>
                  <button onClick={handleSync} disabled={isSyncing} title={isSyncing ? 'Sincronizando...' : 'Sincronizar Dados'} className="p-2 px-3 bg-blue-600/20 text-blue-400 rounded-lg font-bold border border-blue-500/20 hover:bg-blue-600/30 transition-all">
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider"><Target size={12}/> Investimento</span>
                  <div className="text-xl font-black mt-1 text-slate-100">R$ {investimento}</div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 border-l-4 border-l-emerald-500 shadow-xl">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-2 tracking-wider"><DollarSign size={12}/> Faturamento</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xl font-black text-slate-100">{faturamento > 0 ? `R$ ${faturamento}` : '-'}</span>
                  </div>
                </div>
                <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-900/40 text-white">
                  <span className="text-[10px] font-bold text-blue-100 uppercase flex items-center gap-2 tracking-wider"><TrendingUp size={12}/> ROAS Real</span>
                  <div className="text-2xl font-black mt-1">{roas}x</div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider"><MessageCircle size={12}/> {segmento === 'inside_sales' ? 'Leads Totais' : 'Vendas Totais'}</span>
                  <div className="text-xl font-black mt-1 text-slate-100">{segmento === 'inside_sales' ? totalLeads : totalCompras}</div>
                </div>
                <div className="bg-emerald-600 p-6 rounded-2xl shadow-xl shadow-emerald-900/40 text-white border-l-4 border-l-white/20">
                  <span className="text-[10px] font-bold text-emerald-100 uppercase flex items-center gap-2 tracking-wider"><Target size={12}/> CAC Real</span>
                  <div className="text-2xl font-black mt-1">{vendasReais > 0 ? `R$ ${(investimento / vendasReais).toFixed(2)}` : '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-bold uppercase text-slate-500 mb-10 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500"/> Funil de Jornada do Cliente</h3>
                  <div className="flex flex-col items-center space-y-4">
                    {[
                      { label: 'Impressões (Topo)', val: relatorioDados.reduce((a,c)=>a+c.rawImpressoes,0), color: 'bg-blue-600', icon: <Eye size={14}/> },
                      { label: 'Alcance', val: relatorioDados.reduce((a,c)=>a+c.rawAlcance,0), color: 'bg-sky-500', icon: <Target size={14}/> },
                      { label: 'Engajamento (Meio)', val: relatorioDados.reduce((a,c)=>a+c.rawCliques+c.rawVisitas,0), color: 'bg-indigo-500', icon: <MousePointerClick size={14}/> },
                      { label: 'Interesse (Leads)', val: relatorioDados.reduce((a,c)=>a+c.leads,0), color: 'bg-purple-500', icon: <Plus size={14}/> },
                      { label: 'Conversão (Fundo)', val: relatorioDados.reduce((a,c)=>a+c.compras,0), color: 'bg-emerald-500', icon: <ShoppingCart size={14}/> }
                    ].map((s, i, arr) => {
                      const max = arr[0].val || 1;
                      const funnelWidth = (100 - (i * 12)); 
                      return (
                        <div key={i} className="w-full flex flex-col items-center" style={{ maxWidth: `${funnelWidth}%` }}>
                          <div className="w-full flex justify-between text-[10px] font-black uppercase mb-1.5 px-2">
                            <span className="flex items-center gap-1.5 text-slate-400">{s.icon} {s.label}</span>
                            <span className="text-slate-200">{s.val.toLocaleString()}</span>
                          </div>
                          <div className={`w-full h-8 ${s.color} rounded-lg shadow-lg shadow-black/40 border border-white/5 transition-all duration-500`}></div>
                          {i < arr.length -1 && <div className="h-4 w-px bg-slate-800 my-1"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-8 text-center">Distribuição de verba</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <XAxis type="number" hide/>
                        <YAxis dataKey="nome" type="category" tick={{fontSize:9, fill:'#64748b'}} width={100} />
                        <Tooltip cursor={{fill:'#1e293b'}} contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'8px'}} formatter={(v) => [`R$ ${parseFloat(v).toFixed(2)}`, 'Gasto']} />
                        <Bar dataKey="rawValor" fill="#3b82f6" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center"><h3 className="font-bold uppercase text-xs tracking-widest text-slate-400">Detalhamento por Objetivo</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-4 text-center">Campanha</th>
                        <th className="p-4">Resultado do Objetivo</th>
                        <th className="p-4 text-right">Investimento</th>
                        <th className="p-4 text-right">Custo p/ Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {relatorioDados.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4"><div className="text-xs font-bold text-blue-400">{row.nome}</div><div className="text-[9px] text-slate-600 font-bold uppercase">{row.objetivo}</div></td>
                          <td className="p-4"><span className="text-xs font-bold text-white uppercase">{row.resultadoBruto?.toLocaleString()}</span></td>
                          <td className="p-4 text-right font-bold text-sm text-slate-100">{row.valor}</td>
                          <td className="p-4 text-right font-bold text-sm text-emerald-400">{row.cpr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dailyData.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl">
                  <h3 className="font-bold uppercase text-xs tracking-widest text-slate-400 mb-6">Evolução Diária do Período</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={dailyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => { const [,m,d] = v.split('-'); return `${d}/${m}`; }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }} labelFormatter={v => { const [y,m,d] = v.split('-'); return `${d}/${m}/${y}`; }} formatter={(value, name) => { if (name === 'Investimento' || name === 'CPA') return [`R$ ${value.toFixed(2)}`, name]; return [value, name]; }} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Line yAxisId="left" type="monotone" dataKey="mensagens" name="Mensagens" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 5 }} />
                      <Line yAxisId="right" type="monotone" dataKey="investimento" name="Investimento" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                      <Line yAxisId="right" type="monotone" dataKey="cpa" name="CPA" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <h3 className="text-xl font-bold flex items-center gap-2 mt-8 text-slate-100"><ImageIcon className="text-blue-500" /> Ranking de Criativos — Melhores Resultados</h3>
              <p className="text-slate-500 text-xs mb-4">Ordenado pelo menor custo por resultado. Os criativos no topo são os que devem ser replicados e escalados.</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...criativosDados]
                  .map(c => ({ ...c, _cpa: segmento === 'inside_sales' ? (c.leads > 0 ? c.valor_investido / c.leads : Infinity) : (c.compras > 0 ? c.valor_investido / c.compras : Infinity) }))
                  .sort((a, b) => a._cpa - b._cpa)
                  .map((c, idx) => {
                   const cpa = c._cpa === Infinity ? 0 : c._cpa;
                   
                   // Estilo moderno para medalhas
                   const getRankBadge = (rank) => {
                     if (rank === 0 && cpa > 0) return (
                       <div className="absolute top-3 left-3 bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 p-2 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] border border-yellow-200/50 z-10 flex items-center justify-center animate-pulse">
                         <Trophy size={18} className="text-white drop-shadow-md" />
                       </div>
                     );
                     if (rank === 1 && cpa > 0) return (
                       <div className="absolute top-3 left-3 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-500 p-2 rounded-xl shadow-[0_0_20px_rgba(148,163,184,0.3)] border border-slate-100/50 z-10 flex items-center justify-center">
                         <Medal size={18} className="text-white drop-shadow-md" />
                       </div>
                     );
                     if (rank === 2 && cpa > 0) return (
                       <div className="absolute top-3 left-3 bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 p-2 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] border border-orange-200/50 z-10 flex items-center justify-center">
                         <Medal size={18} className="text-white drop-shadow-md" />
                       </div>
                     );
                     return null;
                   };

                   const borderHighlight = idx === 0 && cpa > 0 ? 'border-yellow-500/40 shadow-yellow-900/10' : idx === 1 && cpa > 0 ? 'border-slate-400/30' : idx === 2 && cpa > 0 ? 'border-orange-500/30' : 'border-slate-800';
                   
                   return (
                     <div key={c.id} className={`bg-slate-900 rounded-3xl border ${borderHighlight} overflow-hidden group hover:border-blue-500/50 transition-all flex flex-col h-full shadow-2xl relative`}>
                       <div className="h-64 bg-slate-950 flex items-center justify-center relative overflow-hidden">
                         {c.url_midia ? (
                            <img src={c.url_midia} alt={c.nome_anuncio} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                         ) : (
                            <ImageIcon className="text-slate-800" size={48} />
                         )}
                         {getRankBadge(idx)}
                         <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-white uppercase border border-white/10 tracking-widest">CTR: {parseFloat(c.ctr || 0).toFixed(2)}%</div>
                       </div>
                       <div className="p-6 flex-1 flex flex-col">
                         <div className="text-[12px] font-black text-slate-100 line-clamp-1 mb-4 uppercase tracking-tighter group-hover:text-blue-400 transition-colors">{c.nome_anuncio}</div>
                         <div className="grid grid-cols-2 gap-2 mb-5">
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-60">Alcance</span>
                             <span className="text-[10px] font-bold text-slate-100">{c.alcance?.toLocaleString()}</span>
                           </div>
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-60">Impressões</span>
                             <span className="text-[10px] font-bold text-slate-100">{c.impressoes?.toLocaleString()}</span>
                           </div>
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-60">Gasto</span>
                             <span className="text-[10px] font-bold text-slate-100">R$ {parseFloat(c.valor_investido).toFixed(2)}</span>
                           </div>
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-60">{segmento === 'inside_sales' ? 'Leads' : 'Vendas'}</span>
                             <span className="text-[10px] font-bold text-emerald-400">{segmento === 'inside_sales' ? c.leads : c.compras}</span>
                           </div>
                         </div>
                         <div className={`w-full py-3 ${cpa > 0 && idx < 3 ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-slate-800'} text-white rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.2em] mt-auto border border-white/10`}>CPA: {cpa > 0 ? `R$ ${cpa.toFixed(2)}` : '-'}</div>
                       </div>
                     </div>
                   );
                })}
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mt-8 shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Sparkles className="text-purple-400" size={18} /> Diagnóstico de Campanhas</h3><button onClick={handleGerarIA} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold p-2 px-6 rounded-lg transition-all shadow-lg shadow-purple-900/20">{isGenerating ? 'Analisando...' : 'Gerar Diagnóstico'}</button></div>
                <div className="p-6"><textarea className="w-full h-64 bg-slate-950 border-none rounded-xl p-4 text-sm text-slate-300 resize-none outline-none focus:ring-1 focus:ring-purple-500" readOnly value={analiseIA} placeholder="A análise estratégica baseada nos dados auditados aparecerá aqui..."></textarea></div>
              </div>

              <div className="flex justify-end gap-4 pb-12">
                <button onClick={handleExportPDF} className="p-3 px-8 bg-slate-800 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-700 transition-all text-slate-300 border border-slate-700 shadow-lg shadow-black/20 flex-shrink-0"><Download size={18} /> Exportar PDF</button>
                <button className="p-3 px-8 bg-[#25D366] text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-green-900/20 flex-shrink-0"><MessageCircle size={18} /> WhatsApp</button>
              </div>
            </div>
          )}

          {activeTab === 'clientes' && (
            <div className="max-w-5xl mx-auto py-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-slate-100 font-sans tracking-tight">Administração de Empresas</h1>
                  <p className="text-slate-500 text-sm mt-1">Gerenciamento global de contas e contextos estratégicos.</p>
                </div>
                <button onClick={() => setShowNovoClienteForm(true)} className="p-3 px-6 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all border border-blue-500/20">
                  <Plus size={18} /> Vincular Nova Conta
                </button>
              </div>

              {/* LISTA DE CLIENTES */}
              <div className="grid grid-cols-1 gap-4">
                {clientesDisponiveis.map(cliente => (
                  <div key={cliente.id} className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex items-center justify-between group hover:border-slate-600 transition-all shadow-xl">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
                        {cliente.nome.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-lg">{cliente.nome}</h3>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1 opacity-70">Account ID: {cliente.meta_ads_account_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPerfilCliente(cliente)} className="p-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-slate-700 shadow-lg">
                        <Settings size={16} className="text-blue-400" /> Perfil & Estratégia
                      </button>
                      <button onClick={() => setEditingCliente(cliente)} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all border border-slate-700">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDeleteCliente(cliente.id)} className="p-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-2xl transition-all border border-red-500/10">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* FORMULÁRIO DE NOVO CLIENTE (MODAL) */}
              {showNovoClienteForm && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-900 w-full max-w-xl rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                     <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                        <div>
                          <h2 className="text-3xl font-black text-white tracking-tighter">Vincular Conta</h2>
                          <p className="text-slate-500 text-sm mt-1">Conecte o Meta Ads de uma nova empresa.</p>
                        </div>
                        <button onClick={() => setShowNovoClienteForm(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all text-slate-400"><X size={28}/></button>
                     </div>
                     <form onSubmit={handleAddCliente} className="p-10 space-y-8">
                        <div className="grid grid-cols-1 gap-8">
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-3 tracking-[0.2em]">Identificação da Empresa</label>
                            <input type="text" required value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-sm text-slate-100 outline-none focus:border-blue-600 transition-all shadow-inner" placeholder="Ex: Solution Place" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-3 tracking-[0.2em]">Meta Ad Account ID</label>
                            <input type="text" required value={novoCliente.accountId} onChange={e => setNovoCliente({...novoCliente, accountId: e.target.value})} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-sm text-slate-100 outline-none focus:border-blue-600 transition-all shadow-inner" placeholder="act_861875509414758" />
                          </div>
                        </div>
                        <div className="bg-blue-600/5 p-6 rounded-3xl border border-blue-500/10 flex items-start gap-4">
                           <Sparkles size={24} className="text-blue-500 flex-shrink-0 mt-1" />
                           <p className="text-xs text-blue-400/80 leading-relaxed font-medium">
                             O sistema criará automaticamente uma instância de inteligência (Agent) para esta conta, pronta para ser treinada com o contexto estratégico da marca.
                           </p>
                        </div>
                        <button type="submit" disabled={isAddingCliente} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black p-5 rounded-2xl transition-all shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                          {isAddingCliente ? <><Loader2 size={20} className="animate-spin" /> Vinculando...</> : <><Check size={20} /> Confirmar Vínculo</>}
                        </button>
                     </form>
                  </div>
                </div>
              )}

              {/* MODAL DE EDIÇÃO BÁSICA */}
              {editingCliente && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-900 w-full max-w-md rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="font-black text-lg uppercase tracking-tight">Editar Dados</h3>
                      <button onClick={() => setEditingCliente(null)} className="p-2 hover:bg-slate-800 rounded-xl transition-all"><X size={20}/></button>
                    </div>
                    <div className="p-8 space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Nome da Empresa</label>
                        <input type="text" value={editingCliente.nome} onChange={e => setEditingCliente({...editingCliente, nome: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">ID da Conta</label>
                        <input type="text" value={editingCliente.meta_ads_account_id} onChange={e => setEditingCliente({...editingCliente, meta_ads_account_id: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" />
                      </div>
                      <button onClick={() => handleUpdateCliente(editingCliente)} className="w-full bg-blue-600 p-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20">Salvar Alterações</button>
                    </div>
                  </div>
                </div>
              )}

              {/* PERFIL E CONTEXTO ESTRATÉGICO */}
              {perfilCliente && (
                <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col animate-in slide-in-from-bottom duration-500">
                   <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-10">
                      <div className="flex items-center gap-6">
                        <button onClick={() => setPerfilCliente(null)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all text-slate-400 group">
                           <X size={24} className="group-hover:text-white transition-colors" />
                        </button>
                        <div className="h-10 w-px bg-slate-800" />
                        <div>
                          <h2 className="font-black text-xl text-white tracking-tighter uppercase">{perfilCliente.nome}</h2>
                          <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em] mt-0.5 flex items-center gap-2">
                             <Sparkles size={12} /> Treinamento do Agent Strategist
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleUpdateCliente(perfilCliente)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black p-3 px-10 rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-2xl shadow-emerald-900/40 border border-emerald-500/20">
                        <Check size={20} /> Salvar Contexto
                      </button>
                   </header>
                   <div className="flex-1 overflow-hidden flex">
                      <div className="w-[400px] border-r border-slate-800 p-12 space-y-12 overflow-y-auto bg-slate-900/30">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 opacity-60">Configurações Operacionais</h4>
                          <div className="space-y-4">
                            <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl">
                               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-50">ID no Ecossistema Meta</p>
                               <p className="text-sm font-mono text-blue-400 font-bold">{perfilCliente.meta_ads_account_id}</p>
                            </div>
                            <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl">
                               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-50">Início do Auditor KrM</p>
                               <p className="text-sm text-slate-300 font-bold">{new Date(perfilCliente.criado_em).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 p-8 rounded-[2.5rem] border border-blue-500/20 relative group">
                          <Sparkles className="absolute -top-4 -right-4 text-blue-500/10 group-hover:scale-125 transition-transform duration-1000" size={120} />
                          <h4 className="text-xs font-black text-white mb-4 flex items-center gap-2 uppercase tracking-widest">Guia do Agente IA</h4>
                          <p className="text-[13px] text-slate-400 leading-relaxed relative z-10 font-medium italic">
                            "Este conteúdo é a base do conhecimento do Gemini 2.5 Flash para este cliente. O que você escrever ao lado definirá como cada gráfico, métrica e gargalo de funil será interpretado."
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-950 p-12 flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                           <div className="flex items-center gap-3 text-slate-500 bg-slate-900/80 p-4 px-8 rounded-2xl border border-slate-800 shadow-xl">
                             <FileText size={18} className="text-blue-500" />
                             <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">knowledge_base / agent.md</span>
                           </div>
                           <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Linguagem: Markdown — Processamento: Gemini 2.5 Flash</p>
                        </div>
                        <textarea 
                          value={perfilCliente.insights || ''} 
                          onChange={e => setPerfilCliente({...perfilCliente, insights: e.target.value})}
                          className="flex-1 bg-slate-900/20 border-2 border-slate-800/50 rounded-[3rem] p-12 text-base text-slate-200 font-mono resize-none outline-none focus:border-blue-600/30 shadow-[0_0_100px_rgba(0,0,0,0.5)] leading-relaxed transition-all"
                          placeholder="# Defina os objetivos estratégicos, o tom de voz e os KPIs críticos desta empresa..."
                        />
                      </div>
                   </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'entrada' && (
            <div className="max-w-4xl mx-auto py-10">
               <h1 className="text-3xl font-black mb-2 text-slate-100 tracking-tighter">Métricas de Faturamento</h1>
               <p className="text-slate-500 mb-8 font-medium">Faturamento e ROI Real — Workspace: <strong>{clienteSelecionado}</strong></p>
               <div className="bg-slate-900 p-16 rounded-[3rem] border border-slate-800 text-center py-32 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />
                  <Database size={80} className="mx-auto text-slate-800 mb-8" />
                  <p className="text-slate-400 font-black text-xl uppercase tracking-tighter">Integração Financeira KrM</p>
                  <p className="text-slate-500 text-sm mt-4 max-w-md mx-auto font-medium opacity-80 leading-relaxed">Este módulo permitirá o cálculo do ROI Real cruzando dados do Meta Ads com o seu faturamento efetivado.</p>
               </div>
            </div>
          )}

          {activeTab === 'campanhas' && (
            <div className="max-w-6xl mx-auto py-6 space-y-8">
              <div className="flex justify-between items-end">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <button 
                      onClick={() => loadCampaigns('campaign')}
                      className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-all ${campaignsLevel === 'campaign' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Campanhas
                    </button>
                    <ChevronRight size={14} className="text-slate-800" />
                    <button 
                      disabled={campaignsLevel === 'campaign'}
                      onClick={() => loadCampaigns('adset', campaignsParentId)}
                      className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-all ${campaignsLevel === 'adset' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
                    >
                      Conjuntos
                    </button>
                    <ChevronRight size={14} className="text-slate-800" />
                    <button 
                      disabled={campaignsLevel !== 'ad'}
                      className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-all ${campaignsLevel === 'ad' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 disabled:opacity-30'}`}
                    >
                      Anúncios
                    </button>
                  </div>
                  <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Gerenciador KrM</h1>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="p-3 px-6 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/30 border border-blue-500/20"
                  >
                    <Plus size={16} /> Criar {campaignsLevel === 'campaign' ? 'Campanha' : campaignsLevel === 'adset' ? 'Conjunto' : 'Anúncio'}
                  </button>
                  <button onClick={() => loadCampaigns(campaignsLevel, campaignsParentId)} disabled={campaignsLoading} className="p-3 px-6 bg-slate-900 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-white transition-all border border-slate-800 shadow-xl">
                    <RefreshCw size={14} className={campaignsLoading ? 'animate-spin' : ''} /> Sincronizar Agora
                  </button>
                </div>
              </div>

              {/* MODAL DE CRIAÇÃO */}
              {showCreateModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                   <div className="bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-800 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                      <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
                        <div>
                          <h3 className="text-xl font-black text-white tracking-tighter uppercase">Novo {campaignsLevel === 'campaign' ? 'Campanha' : campaignsLevel === 'adset' ? 'Conjunto' : 'Anúncio'}</h3>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Setup Operacional Meta Ads</p>
                        </div>
                        <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 transition-all"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleCreateObject} className="p-10 space-y-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Identificador</label>
                           <input 
                             required
                             type="text" 
                             value={newObject.name}
                             onChange={e => setNewObject({...newObject, name: e.target.value})}
                             className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50 transition-all"
                             placeholder="Ex: [01][FRIO][MENSAGENS][ABRIL]"
                           />
                        </div>

                        {campaignsLevel === 'campaign' && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Objetivo da Campanha</label>
                            <select 
                              value={newObject.objective}
                              onChange={e => setNewObject({...newObject, objective: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50 transition-all appearance-none"
                            >
                              <option value="OUTCOME_TRAFFIC">Tráfego</option>
                              <option value="OUTCOME_AWARENESS">Reconhecimento</option>
                              <option value="OUTCOME_ENGAGEMENT">Engajamento / Mensagens</option>
                              <option value="OUTCOME_LEADS">Cadastros (Leads)</option>
                              <option value="OUTCOME_SALES">Vendas / Conversão</option>
                            </select>
                          </div>
                        )}

                        {(campaignsLevel === 'campaign' || campaignsLevel === 'adset') && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Orçamento Diário (R$)</label>
                            <input 
                              type="number" 
                              value={newObject.budget}
                              onChange={e => setNewObject({...newObject, budget: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-blue-400 font-bold outline-none focus:border-blue-600/50 transition-all"
                            />
                          </div>
                        )}

                        <div className="pt-4 flex gap-4">
                          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20">
                            Confirmar Criação
                          </button>
                          <button type="button" onClick={() => setShowCreateModal(false)} className="px-8 bg-slate-800 text-slate-400 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-700 transition-all">
                            Cancelar
                          </button>
                        </div>
                      </form>
                   </div>
                </div>
              )}

              {/* BARRA DE FERRAMENTAS E FILTROS */}
              <div className="bg-slate-900/50 p-4 rounded-[2rem] border border-slate-800/50 flex flex-wrap items-center gap-4 shadow-xl">
                <div className="flex-1 min-w-[300px] relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder={`Pesquisar por nome de ${campaignsLevel === 'campaign' ? 'campanha' : campaignsLevel === 'adset' ? 'conjunto' : 'anúncio'}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs text-slate-200 outline-none focus:border-blue-600/50 transition-all font-medium"
                  />
                </div>
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                  {['ALL', 'ACTIVE', 'PAUSED'].map(f => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-slate-800 text-blue-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {f === 'ALL' ? 'Todos' : f === 'ACTIVE' ? 'Ativos' : 'Pausados'}
                    </button>
                  ))}
                </div>
                <div className="h-8 w-px bg-slate-800 mx-2" />
                <div className="relative">
                  <button 
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className={`p-3 px-5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all border ${showColumnMenu ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}`}
                  >
                    <Settings2 size={14} /> Colunas
                  </button>
                  {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-3 w-64 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in duration-200">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Personalizar Métricas</p>
                      <div className="space-y-3">
                        {[
                          { id: 'spend', label: 'Investimento' },
                          { id: 'results', label: 'Resultados' },
                          { id: 'cpa', label: 'CPA' },
                          { id: 'impressions', label: 'Impressões' },
                          { id: 'ctr', label: 'CTR (%)' },
                          { id: 'clicks', label: 'Cliques' }
                        ].map(col => (
                          <label key={col.id} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={visibleColumns.includes(col.id)}
                              onChange={() => setVisibleColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-950 checked:bg-blue-600 focus:ring-0"
                            />
                            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-600/10 p-1 px-3 rounded-xl border border-blue-500/20 animate-in fade-in slide-in-from-right-4 duration-300">
                    <span className="text-[9px] font-black text-blue-400 uppercase mr-2">{selectedIds.length} selecionados</span>
                    <button onClick={() => handleBulkUpdate('ACTIVE')} className="p-2 px-3 bg-emerald-600/20 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">Ativar</button>
                    <button onClick={() => handleBulkUpdate('PAUSED')} className="p-2 px-3 bg-red-600/20 text-red-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">Pausar</button>
                  </div>
                )}
              </div>

              {campaignsLoading ? (
                <div className="flex items-center justify-center py-32 flex-col gap-6">
                   <Loader2 className="animate-spin text-blue-600" size={48} />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Acessando Meta Ads API...</p>
                </div>
              ) : campaignsList.length === 0 ? (
                <div className="bg-slate-900 p-20 rounded-[3rem] border border-slate-800 text-center shadow-2xl">
                  <Megaphone size={60} className="mx-auto text-slate-800 mb-8" />
                  <p className="text-slate-400 font-black text-xl uppercase tracking-tight">Nenhum item encontrado</p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                          <th className="p-6 w-12">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-700 bg-slate-800 checked:bg-blue-600 focus:ring-0" 
                              checked={selectedIds.length === campaignsList.length && campaignsList.length > 0}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th className="p-6 w-16">Status</th>
                          <th className="p-6 min-w-[300px]">Nome do {campaignsLevel === 'campaign' ? 'Campanha' : campaignsLevel === 'adset' ? 'Conjunto' : 'Anúncio'}</th>
                          {visibleColumns.includes('spend') && <th className="p-6 text-right">Investimento</th>}
                          {visibleColumns.includes('results') && <th className="p-6 text-right">Resultados</th>}
                          {visibleColumns.includes('cpa') && <th className="p-6 text-right">CPA</th>}
                          {visibleColumns.includes('impressions') && <th className="p-6 text-right">Impressões</th>}
                          {visibleColumns.includes('ctr') && <th className="p-6 text-right">CTR</th>}
                          {visibleColumns.includes('clicks') && <th className="p-6 text-right">Cliques</th>}
                          <th className="p-6 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {campaignsList
                          .filter(item => {
                            const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                            const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
                            return matchSearch && matchStatus;
                          })
                          .map(item => {
                          const cpa = item.results > 0 ? (item.spend / item.results) : 0;
                          return (
                            <tr key={item.id} className={`hover:bg-slate-800/30 transition-all group ${selectedIds.includes(item.id) ? 'bg-blue-600/5' : ''}`}>
                              <td className="p-6">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 checked:bg-blue-600 focus:ring-0" 
                                  checked={selectedIds.includes(item.id)}
                                  onChange={() => toggleSelect(item.id)}
                                />
                              </td>
                              <td className="p-6">
                                <button 
                                  onClick={() => handleUpdateCampaign(item.id, { status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                                  className={`w-10 h-6 rounded-full relative transition-all ${item.status === 'ACTIVE' ? 'bg-blue-600' : 'bg-slate-800'}`}
                                  title={item.effective_status}
                                >
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.status === 'ACTIVE' ? 'right-1' : 'left-1'}`} />
                                </button>
                              </td>
                              <td className="p-6">
                                <div className="flex items-center gap-4">
                                  {campaignsLevel === 'ad' && item.creative?.thumbnail_url && (
                                    <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0 shadow-lg">
                                      <img src={item.creative.thumbnail_url} className="w-full h-full object-cover" alt="Thumb" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    {editingCampaign === item.id ? (
                                      <input 
                                        autoFocus
                                        type="text" 
                                        defaultValue={item.name}
                                        onBlur={(e) => handleUpdateCampaign(item.id, { name: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCampaign(item.id, { name: e.target.value })}
                                        className="bg-slate-950 border border-blue-500/50 rounded-lg p-2 text-xs text-white outline-none w-full"
                                      />
                                    ) : (
                                      <div className="flex flex-col">
                                        <div 
                                          onClick={() => {
                                            if (campaignsLevel === 'campaign') loadCampaigns('adset', item.id);
                                            else if (campaignsLevel === 'adset') loadCampaigns('ad', item.id);
                                          }}
                                          className={`text-sm font-bold text-slate-200 cursor-pointer hover:text-blue-400 transition-colors ${campaignsLevel !== 'ad' ? 'underline decoration-blue-500/30 underline-offset-4' : ''}`}
                                        >
                                          {item.name}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                          <span className={`text-[9px] font-black uppercase tracking-tighter ${item.status === 'ACTIVE' ? 'text-blue-500/60' : 'text-slate-600'}`}>{item.effective_status || item.status}</span>
                                          {item.objective && <span className="text-[9px] font-black uppercase text-slate-700 tracking-tighter">• {item.objective.replace('OUTCOME_', '')}</span>}
                                          {item.daily_budget && <span className="text-[9px] font-bold text-emerald-500/70">R$ {item.daily_budget} / dia</span>}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {visibleColumns.includes('spend') && <td className="p-6 text-right font-mono text-sm font-bold text-slate-100">R$ {item.spend}</td>}
                              {visibleColumns.includes('results') && (
                                <td className="p-6 text-right">
                                  <span className="text-sm font-black text-white">{item.results || 0}</span>
                                  <div className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Conversas/Leads</div>
                                </td>
                              )}
                              {visibleColumns.includes('cpa') && (
                                <td className="p-6 text-right">
                                  <span className={`text-sm font-black ${cpa > 0 ? 'text-blue-400' : 'text-slate-600'}`}>{cpa > 0 ? `R$ ${cpa.toFixed(2)}` : '-'}</span>
                                </td>
                              )}
                              {visibleColumns.includes('impressions') && <td className="p-6 text-right font-mono text-sm font-bold text-slate-300">{item.impressions?.toLocaleString()}</td>}
                              {visibleColumns.includes('ctr') && <td className="p-6 text-right font-mono text-sm font-bold text-blue-400/80">{item.ctr}%</td>}
                              {visibleColumns.includes('clicks') && <td className="p-6 text-right font-mono text-sm font-bold text-slate-400">{item.clicks?.toLocaleString()}</td>}
                              <td className="p-6 text-right">
                                <button 
                                  onClick={() => setEditingCampaign(item.id)}
                                  className="p-3 text-slate-600 hover:text-blue-400 hover:bg-blue-400/5 rounded-xl transition-all"
                                >
                                  <Pencil size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
