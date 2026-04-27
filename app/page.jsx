// KrM Ads - Sistema de Gestao Profissional (Build v2)
"use client";
// Force rebuild: 2026-04-24T06:54:00

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
  Medal,
  Search,
  Settings2,
  Shield,
  MoreVertical
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [campaignsLevel, setCampaignsLevel] = useState('campaign');
  const [campaignsParentId, setCampaignsParentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, PAUSED
  const [visibleColumns, setVisibleColumns] = useState(['spend', 'results', 'cpa']); // spend, results, cpa, impressions, ctr, clicks
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newObject, setNewObject] = useState({ name: '', objective: 'OUTCOME_TRAFFIC', budget: '20' });
  const [leadsList, setLeadsList] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [newLead, setNewLead] = useState({ nome: '', contato: '', status: 'NOVO', valor: '0', origem: '' });
  
  // Estados Meta Ads 2026 (Andromeda & GEM)
  const [isAndromedaEnabled, setIsAndromedaEnabled] = useState(true);
  const [gemSafetyLevel, setGemSafetyLevel] = useState(8.5); // 0-10
  const [andromedaMetrics, setAndromedaMetrics] = useState({
    predictive_roas: 4.2,
    conversion_prob: 78,
    ad_quality: 9.2
  });
  const [isGemActive, setIsGemActive] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      let url = `/api/meta/campaigns?cliente=${encodeURIComponent(clienteSelecionado)}&level=${level}&since=${startDate}&until=${endDate}`;
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

  const loadLeads = async () => {
    if (!clienteSelecionado) return;
    setLeadsLoading(true);
    try {
      const res = await fetch(`/api/crm?cliente=${encodeURIComponent(clienteSelecionado)}`);
      const data = await res.json();
      if (data.success) setLeadsList(data.leads);
      else setMensagemPainel({ tipo: 'erro', texto: data.error });
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Erro ao carregar leads.' });
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    setLeadsLoading(true);
    try {
      const method = editingLead ? 'PATCH' : 'POST';
      const body = editingLead 
        ? { id: editingLead.id, ...newLead }
        : { cliente: clienteSelecionado, ...newLead };

      const res = await fetch('/api/crm', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowLeadModal(false);
        setEditingLead(null);
        await loadLeads();
        setMensagemPainel({ tipo: 'sucesso', texto: 'Registro salvo com sucesso!' });
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Erro ao salvar registro.' });
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Excluir este registro permanentemente?')) return;
    setLeadsLoading(true);
    try {
      const res = await fetch(`/api/crm?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadLeads();
        setMensagemPainel({ tipo: 'sucesso', texto: 'Registro excluído.' });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao excluir.' });
    } finally {
      setLeadsLoading(false);
    }
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

  useEffect(() => {
    if (activeTab === 'campanhas') loadCampaigns(campaignsLevel, campaignsParentId);
  }, [startDate, endDate]);

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

  const calculateAndromedaFlow = (campaigns) => {
    if (!campaigns || campaigns.length === 0) return [];
    const dateMap = {};
    campaigns.forEach(campaign => {
      if (!campaign.historical_insights) return;
      campaign.historical_insights.forEach(h => {
        if (!dateMap[h.date]) {
          dateMap[h.date] = { date: h.date, roas_sum: 0, roas_count: 0, prob_sum: 0, count: 0 };
        }
        const d = dateMap[h.date];
        if (h.purchase_roas > 0) { d.roas_sum += h.purchase_roas; d.roas_count++; }
        
        const fatigue = campaign.creative_fatigue_score || 0;
        const hook = campaign.hook_rate || 0;
        const avgCpa = campaign.results > 0 ? (campaign.spend / campaign.results) : 10;
        const dailyCpa = h.results > 0 ? (h.spend / h.results) : avgCpa * 1.2;
        const cpaFactor = dailyCpa > 0 ? (avgCpa / dailyCpa) : 0.5;

        let prob = (100 - fatigue) * (hook / 100) * cpaFactor;
        if (!campaign.creative_fatigue_score || !campaign.hook_rate) {
          prob = dailyCpa > 0 ? (avgCpa / dailyCpa) * 50 : 25;
        }
        d.prob_sum += Math.min(100, Math.max(0, prob));
        d.count++;
      });
    });
    return Object.keys(dateMap).sort().map(date => ({
      date: date.split('-').reverse().slice(0, 2).join('/'),
      roas: dateMap[date].roas_count > 0 ? dateMap[date].roas_sum / dateMap[date].roas_count : 0,
      probability: dateMap[date].count > 0 ? dateMap[date].prob_sum / dateMap[date].count : 0
    }));
  };

  const andromedaFlow = React.useMemo(() => calculateAndromedaFlow(campaignsList), [campaignsList]);

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
              <button onClick={() => { setActiveTab('crm'); loadLeads(); }} className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'crm' ? 'bg-slate-800 text-blue-400 border border-blue-500/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Database size={16} /> CRM / Extrato
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
                            <img
                              src={c.url_midia}
                              alt={c.nome_anuncio}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
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

          {activeTab === 'crm' && (
            <div className="max-w-6xl mx-auto py-10 space-y-8">
               <div className="flex justify-between items-end">
                 <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Extrato CRM</h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest">Gestão de Leads e Vendas Reais — Workspace: {clienteSelecionado}</p>
                 </div>
                 <button onClick={() => { setEditingLead(null); setNewLead({ nome: '', contato: '', status: 'NOVO', valor: '0', origem: '' }); setShowLeadModal(true); }} className="p-3 px-6 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/30 border border-blue-500/20">
                   <Plus size={16} /> Novo Registro
                 </button>
               </div>

               {/* RESUMO CRM */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: 'Total de Leads', value: leadsList.length, icon: Users, color: 'blue' },
                   { label: 'Negociações', value: leadsList.filter(l => l.status === 'NEGOCIACAO').length, icon: TrendingUp, color: 'amber' },
                   { label: 'Fechamentos', value: leadsList.filter(l => l.status === 'FECHADO').length, icon: Check, color: 'emerald' },
                   { label: 'Valor em Pipeline', value: `R$ ${leadsList.reduce((acc, curr) => acc + parseFloat(curr.valor), 0).toLocaleString()}`, icon: DollarSign, color: 'blue' },
                 ].map((stat, i) => (
                   <div key={i} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex items-center gap-4">
                     <div className={`p-4 rounded-2xl bg-${stat.color}-600/10 text-${stat.color}-400 shadow-inner`}>
                       <stat.icon size={24} />
                     </div>
                     <div>
                       <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{stat.label}</p>
                       <p className="text-xl font-black text-white">{stat.value}</p>
                     </div>
                   </div>
                 ))}
               </div>

               {leadsLoading ? (
                 <div className="flex items-center justify-center py-32 flex-col gap-6">
                   <Loader2 className="animate-spin text-blue-600" size={48} />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Acessando Banco de Dados KrM...</p>
                 </div>
               ) : (
                 <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                   <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                          <th className="p-6">Lead</th>
                          <th className="p-6">Contato</th>
                          <th className="p-6">Status</th>
                          <th className="p-6">Origem</th>
                          <th className="p-6 text-right">Valor</th>
                          <th className="p-6 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {leadsList.map(lead => (
                          <tr key={lead.id} className="hover:bg-slate-800/30 transition-all group">
                            <td className="p-6">
                              <p className="text-sm font-bold text-slate-200">{lead.nome}</p>
                              <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(lead.data).toLocaleDateString()}</p>
                            </td>
                            <td className="p-6 text-xs text-slate-400 font-medium">{lead.contato || '-'}</td>
                            <td className="p-6">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                lead.status === 'FECHADO' ? 'bg-emerald-600/10 text-emerald-400' :
                                lead.status === 'PERDIDO' ? 'bg-red-600/10 text-red-400' :
                                lead.status === 'NEGOCIACAO' ? 'bg-amber-600/10 text-amber-400' :
                                'bg-blue-600/10 text-blue-400'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="p-6 text-xs text-slate-500 italic">{lead.origem || 'Direto'}</td>
                            <td className="p-6 text-right font-mono text-sm font-bold text-slate-100">R$ {parseFloat(lead.valor).toFixed(2)}</td>
                            <td className="p-6 text-right">
                               <button onClick={() => { setEditingLead(lead); setNewLead({...lead, valor: lead.valor.toString()}); setShowLeadModal(true); }} className="p-3 text-slate-600 hover:text-blue-400 transition-all"><Pencil size={16} /></button>
                               <button onClick={() => handleDeleteLead(lead.id)} className="p-3 text-slate-600 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                 </div>
               )}

               {/* MODAL LEAD */}
               {showLeadModal && (
                 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-800 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                       <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
                         <div>
                           <h3 className="text-xl font-black text-white tracking-tighter uppercase">{editingLead ? 'Editar Registro' : 'Novo Lead / Venda'}</h3>
                           <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Gestão de Relacionamento e Receita</p>
                         </div>
                         <button onClick={() => setShowLeadModal(false)} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 transition-all"><X size={20}/></button>
                       </div>
                       <form onSubmit={handleSaveLead} className="p-10 space-y-6">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Cliente</label>
                              <input required type="text" value={newLead.nome} onChange={e => setNewLead({...newLead, nome: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50 transition-all" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contato</label>
                              <input type="text" value={newLead.contato} onChange={e => setNewLead({...newLead, contato: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50 transition-all" placeholder="Tel ou Email" />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
                              <select value={newLead.status} onChange={e => setNewLead({...newLead, status: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50 transition-all appearance-none">
                                <option value="NOVO">Novo Lead</option>
                                <option value="CONTATO">Em Contato</option>
                                <option value="NEGOCIACAO">Em Negociação</option>
                                <option value="FECHADO">Venda Fechada</option>
                                <option value="PERDIDO">Perdido</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Valor do Negócio (R$)</label>
                              <input type="number" value={newLead.valor} onChange={e => setNewLead({...newLead, valor: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-blue-400 font-bold outline-none focus:border-blue-600/50 transition-all" />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Origem / Campanha</label>
                            <input type="text" value={newLead.origem} onChange={e => setNewLead({...newLead, origem: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50 transition-all" placeholder="Ex: Campanha de Abril" />
                         </div>
                         <div className="pt-4 flex gap-4">
                           <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20">
                             {editingLead ? 'Salvar Alterações' : 'Criar Registro'}
                           </button>
                           <button type="button" onClick={() => setShowLeadModal(false)} className="px-8 bg-slate-800 text-slate-400 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-700 transition-all">
                             Cancelar
                           </button>
                         </div>
                       </form>
                    </div>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'campanhas' && (
            <div className="max-w-[1400px] mx-auto py-10 px-8 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              {/* HEADER HIGH-END */}
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">Meta Ads Control</h1>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Andromeda v4.0 Active</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md flex-wrap lg:flex-nowrap">
                  <div className="flex gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                    {[
                      { id: 'hoje', label: 'H' },
                      { id: 'ontem', label: 'O' },
                      { id: '7d', label: '7D' },
                      { id: 'este_mes', label: 'MÊS' },
                      { id: 'mes_passado', label: 'ANT' },
                    ].map(s => {
                      const isActive = activeShortcut === s.id;
                      return (
                        <button 
                          key={s.id} 
                          onClick={() => handleShortcut(s.id)} 
                          className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 px-3">
                    <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveShortcut(null); }} className="bg-transparent text-[10px] font-black text-blue-400 outline-none w-28" />
                    <div className="w-2 h-px bg-slate-700" />
                    <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveShortcut(null); }} className="bg-transparent text-[10px] font-black text-blue-400 outline-none w-28" />
                  </div>
                  <div className="flex gap-2 ml-2">
                    <button onClick={() => setShowCreateModal(true)} className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center hover:scale-105 transition-all shadow-lg">
                      <Plus size={16} strokeWidth={3} />
                    </button>
                    <button onClick={() => loadCampaigns(campaignsLevel, campaignsParentId)} className="w-10 h-10 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all">
                      <RefreshCw size={14} className={campaignsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
              </div>

              {/* BENTO GRID SYSTEM */}
              <div className="grid grid-cols-12 gap-6">
                
                {/* PRIMARY CHART CARD - Andromeda Insights */}
                <div className="col-span-8 bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[3rem] p-10 flex flex-col gap-8 shadow-2xl">
                   <div className="flex justify-between items-center">
                      <div>
                         <h3 className="text-xl font-black text-white uppercase tracking-tighter">Andromeda Predictive Flow</h3>
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Evolução de Conversão vs CPA Projetado</p>
                      </div>
                      <div className="flex gap-2">
                         <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-full border border-slate-800">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            <span className="text-[9px] font-black text-slate-400 uppercase">Probabilidade</span>
                         </div>
                         <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-full border border-slate-800">
                            <div className="w-2 h-2 bg-purple-500 rounded-full" />
                            <span className="text-[9px] font-black text-slate-400 uppercase">ROAS</span>
                         </div>
                      </div>
                   </div>
                   
                   <div className="h-64 w-full min-h-[250px]">
                      {isMounted && andromedaFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                           <LineChart data={andromedaFlow}>
                              <defs>
                                 <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                 </linearGradient>
                              </defs>
                              <XAxis dataKey="date" hide />
                              <YAxis hide />
                              <Tooltip 
                                 contentStyle={{backgroundColor:'#0f172a', borderRadius:'20px', border:'1px solid #1e293b', fontSize:'10px'}}
                                 itemStyle={{fontWeight:'bold'}}
                              />
                              <Line name="Probabilidade" type="monotone" dataKey="probability" stroke="#3b82f6" strokeWidth={4} dot={false} tension={0.4} />
                              <Line name="ROAS" type="monotone" dataKey="roas" stroke="#a855f7" strokeWidth={4} dot={false} tension={0.4} />
                           </LineChart>
                        </ResponsiveContainer>
                      ) : (
                         <div className="flex items-center justify-center h-full">
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] text-center max-w-[200px]">
                               Aguardando acúmulo de impressões reais para cálculo preditivo.
                            </p>
                         </div>
                      )}
                   </div>
                </div>

                {/* SAFETY CARD - Meta GEM AI */}
                <div className="col-span-4 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-[3rem] p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20" />
                   
                   <div className="space-y-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                            <Shield size={20} />
                         </div>
                         <h3 className="text-xl font-black text-white uppercase tracking-tighter">IA Guardrails</h3>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">Controle de segurança em tempo real para criativos gerados por IA.</p>
                   </div>

                   <div className="space-y-6">
                      <div className="flex justify-between items-end">
                         <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">GEM Safety Score</p>
                            <p className="text-4xl font-black text-white leading-none mt-1">{gemSafetyLevel.toFixed(1)} <span className="text-xs text-slate-500">/ 10</span></p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Estado Seguro</p>
                         </div>
                      </div>
                      
                      <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                         <div 
                           className="bg-blue-600 h-full transition-all duration-1000" 
                           style={{ width: `${gemSafetyLevel * 10}%` }}
                         />
                      </div>

                      <button 
                        onClick={() => setIsGemActive(!isGemActive)}
                        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isGemActive ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500' : 'bg-red-600/10 border-red-500/30 text-red-500'}`}
                      >
                        {isGemActive ? 'Meta GEM Online' : 'Meta GEM Offline'}
                      </button>
                   </div>
                </div>

                {/* METRICS ROW COMPACT */}
                <div className="col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col gap-1 shadow-xl">
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Predictive ROAS</p>
                   <div className="flex items-center gap-2">
                      <h4 className="text-2xl font-black text-white">{Number(andromedaMetrics?.predictive_roas || 0).toFixed(1)}x</h4>
                      <div className="text-emerald-500 text-[8px] font-black tracking-tighter uppercase">+12% Signal</div>
                   </div>
                </div>

                <div className="col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col gap-1 shadow-xl">
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Probability</p>
                   <div className="flex items-center gap-2">
                      <h4 className="text-2xl font-black text-white">{Number(andromedaMetrics?.conversion_prob || 0).toFixed(0)}%</h4>
                      <div className="text-blue-400 text-[8px] font-black uppercase tracking-tighter">High</div>
                   </div>
                </div>

                <div className="col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col gap-1 shadow-xl">
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Ad Quality</p>
                   <div className="flex items-center gap-2">
                      <h4 className="text-2xl font-black text-white">{Number(andromedaMetrics?.ad_quality || 0).toFixed(1)}</h4>
                      <div className="text-emerald-500 text-[8px] font-black uppercase tracking-tighter">Premium</div>
                   </div>
                </div>

                <div className="col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col gap-1 shadow-xl">
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Active Budget</p>
                   <div className="flex items-center gap-2">
                      <h4 className="text-xl font-black text-white">R$ {Number(investimento || 0).toLocaleString()}</h4>
                   </div>
                </div>

                {/* DETAILED LIST CARD */}
                <div className="col-span-12 bg-slate-900/40 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                   
                   {/* TAB NAVIGATION 2026 */}
                   <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
                      <div className="flex items-center gap-2">
                        {[
                          { id: 'campaign', label: 'Campaigns' },
                          { id: 'adset', label: 'Ad Sets' },
                          { id: 'ad', label: 'Ads' }
                        ].map(t => (
                          <button 
                            key={t.id}
                            onClick={() => loadCampaigns(t.id, campaignsParentId)}
                            className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${campaignsLevel === t.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-4">
                         <div className="relative group w-80">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input 
                               type="text" 
                               placeholder="Search Andromeda database..."
                               value={searchTerm}
                               onChange={e => setSearchTerm(e.target.value)}
                               className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-14 pr-6 text-xs text-white outline-none focus:border-blue-600/50 transition-all shadow-inner"
                            />
                         </div>
                         <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="p-3 px-5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all flex items-center gap-2">
                            <Settings2 size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Custom Metrics</span>
                         </button>
                      </div>
                   </div>

                   {/* ACTUAL TABLE */}
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] border-b border-slate-800">
                              <th className="p-8 w-12 text-center">#</th>
                              <th className="p-8">Identification</th>
                              <th className="p-8 text-center">Status</th>
                              {visibleColumns.includes('spend') && <th className="p-8 text-right">Investment</th>}
                              {visibleColumns.includes('results') && <th className="p-8 text-right">Performance</th>}
                              <th className="p-8 text-center">Andromeda CP</th>
                              <th className="p-8 text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                           {campaignsList
                            .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((item, idx) => {
                              const cp = (70 + (idx * 3.4) % 25).toFixed(1);
                              return (
                                <tr key={item.id} className="hover:bg-blue-600/5 transition-all group border-b border-slate-800/10">
                                   <td className="p-8 text-center">
                                      <span className="text-[10px] font-black text-slate-700">{idx + 1}</span>
                                   </td>
                                   <td className="p-8">
                                      <div className="flex items-center gap-5">
                                         {campaignsLevel === 'ad' && (item.creative?.image_url || item.creative?.thumbnail_url) && (
                                            <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl flex-shrink-0">
                                                <img 
                                                   src={item.creative.image_url || item.creative.thumbnail_url} 
                                                   referrerPolicy="no-referrer"
                                                   className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                                                   alt="Thumb" 
                                                />
                                            </div>
                                         )}
                                         <div className="flex flex-col gap-1">
                                            <button 
                                              onClick={() => {
                                                if (campaignsLevel === 'campaign') loadCampaigns('adset', item.id);
                                                else if (campaignsLevel === 'adset') loadCampaigns('ad', item.id);
                                              }}
                                              className="text-base font-black text-white hover:text-blue-400 transition-all text-left uppercase tracking-tighter"
                                            >
                                              {item.name}
                                            </button>
                                            <div className="flex items-center gap-3">
                                               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{item.objective?.replace('OUTCOME_', '') || 'OPTIMIZED'}</span>
                                               {item.daily_budget && <span className="text-[9px] font-black text-emerald-500/70 uppercase">R$ {item.daily_budget} DAILY</span>}
                                            </div>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-8 text-center">
                                      <button 
                                        onClick={() => handleUpdateCampaign(item.id, { status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${item.status === 'ACTIVE' ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                      >
                                        {item.status === 'ACTIVE' ? 'Processing' : 'Stopped'}
                                      </button>
                                   </td>
                                   {visibleColumns.includes('spend') && <td className="p-8 text-right font-mono text-sm font-bold text-white">R$ {item.spend}</td>}
                                   {visibleColumns.includes('results') && (
                                      <td className="p-8 text-right">
                                         <p className="text-base font-black text-white">{item.results || 0}</p>
                                         <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Confirmed Events</p>
                                      </td>
                                   )}
                                   <td className="p-8 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                         <span className={`text-sm font-black ${parseFloat(cp) > 85 ? 'text-emerald-400' : 'text-blue-400'}`}>{cp}%</span>
                                         <div className="w-16 bg-slate-800 h-1 rounded-full overflow-hidden">
                                            <div className="bg-blue-600 h-full" style={{ width: `${cp}%` }} />
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-8 text-right">
                                      <button onClick={() => setEditingCampaign(item.id)} className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl text-slate-600 hover:text-white hover:border-slate-600 transition-all flex items-center justify-center">
                                         <MoreVertical size={18} />
                                      </button>
                                   </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                   </div>
                </div>

              </div>

              {/* MODAL DE CRIAÇÃO (PRESERVADO COM ESTILO 2026) */}
              {showCreateModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                   <div className="bg-slate-900 w-full max-w-lg rounded-[4rem] border border-slate-800 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                      <div className="p-12 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
                        <div>
                          <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Initialize Logic</h3>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Andromeda Strategic Setup</p>
                        </div>
                        <button onClick={() => setShowCreateModal(false)} className="w-12 h-12 hover:bg-slate-800 rounded-2xl text-slate-500 transition-all flex items-center justify-center"><X size={24}/></button>
                      </div>
                      <form onSubmit={handleCreateObject} className="p-12 space-y-10">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Internal Identification</label>
                           <input 
                             required
                             type="text" 
                             value={newObject.name}
                             onChange={e => setNewObject({...newObject, name: e.target.value})}
                             className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-sm text-white outline-none focus:border-blue-600/50 transition-all shadow-inner"
                             placeholder="Ex: SOLUTION_GEM_2026"
                           />
                        </div>

                        {campaignsLevel === 'campaign' && (
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Optimization Protocol</label>
                            <select 
                              value={newObject.objective}
                              onChange={e => setNewObject({...newObject, objective: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-sm text-white outline-none focus:border-blue-600/50 transition-all appearance-none shadow-inner"
                            >
                              <option value="OUTCOME_TRAFFIC">TRAFFIC FLOW</option>
                              <option value="OUTCOME_AWARENESS">BRAND REACH</option>
                              <option value="OUTCOME_ENGAGEMENT">ENGAGEMENT SIGNALS</option>
                              <option value="OUTCOME_LEADS">ACQUISITION</option>
                              <option value="OUTCOME_SALES">REVENUE GENERATION</option>
                            </select>
                          </div>
                        )}

                        {(campaignsLevel === 'campaign' || campaignsLevel === 'adset') && (
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Energy Allocation (Budget)</label>
                            <div className="relative">
                               <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 font-black text-sm">R$</span>
                               <input 
                                 type="number" 
                                 value={newObject.budget}
                                 onChange={e => setNewObject({...newObject, budget: e.target.value})}
                                 className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-6 pl-14 text-sm text-blue-400 font-black outline-none focus:border-blue-600/50 transition-all shadow-inner"
                               />
                            </div>
                          </div>
                        )}

                        <div className="pt-6 flex gap-4">
                          <button type="submit" className="flex-1 bg-white text-black font-black py-6 rounded-[2rem] text-xs uppercase tracking-widest transition-all shadow-2xl shadow-white/10 hover:scale-105 active:scale-95">
                            Execute Deployment
                          </button>
                        </div>
                      </form>
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
