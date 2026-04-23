"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  LayoutDashboard,
  FileText,
  Image as ImageIcon,
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
  CalendarDays,
  Eye,
  MousePointerClick,
  Database,
  Megaphone,
  Play,
  Pause,
  Pencil,
  Check,
  X,
  Loader2
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
  const [clienteSelecionado, setClienteSelecionado] = useState('Solution Place');
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [mensagemPainel, setMensagemPainel] = useState(null);
  const [campaignsList, setCampaignsList] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [editBudget, setEditBudget] = useState('');
  const [dailyData, setDailyData] = useState([]);
  const reportRef = useRef(null);

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
      // Multi-page support
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
      console.error('Erro ao gerar PDF:', e);
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao gerar o PDF.' });
    }
  };

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch(`/api/meta/campaigns?cliente=${encodeURIComponent(clienteSelecionado)}`);
      const data = await res.json();
      if (data.success) setCampaignsList(data.campaigns || []);
      else setMensagemPainel({ tipo: 'erro', texto: data.error });
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao carregar campanhas.' });
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleUpdateCampaign = async (campaignId, updates) => {
    try {
      const res = await fetch('/api/meta/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: clienteSelecionado, campaignId, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingCampaign(null);
        await loadCampaigns();
      } else {
        setMensagemPainel({ tipo: 'erro', texto: data.error });
      }
    } catch (e) {
      setMensagemPainel({ tipo: 'erro', texto: 'Falha ao atualizar campanha.' });
    }
  };

  const roas = investimento > 0 ? (faturamento / investimento).toFixed(2) : 0;
  const cacReal = totalLeads > 0 ? (investimento / totalLeads).toFixed(2) : 0;

  const loadMetrics = useCallback(async () => {
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
          cpr: m.resultadoBruto > 0 ? `R$ ${(valorInv / m.resultadoBruto).toFixed(2)}` : '-',
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
    if (isSyncing) return;
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

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

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

  const dadosGrafico = relatorioDados.map(item => ({
    nome: item.nome.split('][')[3]?.replace(']','') || item.nome,
    rawValor: item.rawValor
  }));

  const handleGerarIA = async () => {
    setIsGenerating(true); setAnaliseIA("Gerando análise estratégica...");
    try {
      // Montar dados do funil
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

      // Ranking de criativos ordenado por CPA
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

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="text-blue-500" size={24} /> KrM Ads
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('relatorios')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'relatorios' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><FileText size={18} /> Relatórios</button>
          <button onClick={() => setActiveTab('entrada')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'entrada' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Database size={18} /> Entrada de Dados</button>
          <button onClick={() => setActiveTab('ativos')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'ativos' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ImageIcon size={18} /> Criativos</button>
          <button onClick={() => { setActiveTab('campanhas'); loadCampaigns(); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'campanhas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Megaphone size={18} /> Campanhas</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 flex-shrink-0 shadow-sm">
          <h2 className="font-semibold uppercase tracking-widest text-sm text-slate-400">Auditoria Estratégica de Resultados</h2>
          <select value={clienteSelecionado} onChange={(e) => setClienteSelecionado(e.target.value)} className="bg-slate-800 text-xs font-bold p-2 rounded-md outline-none cursor-pointer border border-slate-700 hover:border-slate-500 transition-colors">
            <option>Solution Place</option><option>Fulltime</option><option>Mind Sistema</option><option>Dr. Yuri Advogado</option>
          </select>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {activeTab === 'relatorios' && (
            <div ref={reportRef} className="space-y-6">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-100">Performance Global</h1>
                  <p className="text-slate-500 text-sm mt-1">Dados auditados e consolidados da Meta API</p>
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl"><span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Target size={12}/> Investimento</span><div className="text-2xl font-black mt-1 text-slate-100">R$ {investimento}</div></div>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 border-l-4 border-l-emerald-500 shadow-xl"><span className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-2"><DollarSign size={12}/> Faturamento</span><input type="number" value={faturamento} onChange={e => setFaturamento(e.target.value)} className="bg-transparent text-2xl font-black mt-1 w-full outline-none text-slate-100" /></div>
                <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-900/40 text-white"><span className="text-xs font-bold text-blue-100 uppercase flex items-center gap-2"><TrendingUp size={12}/> ROAS Real</span><div className="text-3xl font-black mt-1">{roas}x</div></div>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl"><span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><MessageCircle size={12}/> {segmento === 'inside_sales' ? 'Leads Totais' : 'Vendas Totais'}</span><div className="text-2xl font-black mt-1 text-slate-100">{segmento === 'inside_sales' ? totalLeads : totalCompras}</div></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-bold uppercase text-slate-500 mb-10 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500"/> Funil de Jornada do Cliente</h3>
                  <div className="flex flex-col items-center space-y-4">
                    {[
                      { label: 'Impressões (Topo)', val: relatorioDados.reduce((a,c)=>a+c.rawImpressoes,0), color: 'bg-blue-500', icon: <Eye size={14}/> },
                      { label: 'Engajamento (Meio)', val: relatorioDados.reduce((a,c)=>a+c.rawCliques+c.rawVisitas,0), color: 'bg-indigo-500', icon: <MousePointerClick size={14}/> },
                      { label: 'Interesse (Leads/Seg)', val: relatorioDados.reduce((a,c)=>a+c.rawSeguidores+c.leads,0), color: 'bg-purple-500', icon: <Plus size={14}/> },
                      { label: 'Conversão (Fundo)', val: relatorioDados.reduce((a,c)=>a+c.compras,0), color: 'bg-emerald-500', icon: <ShoppingCart size={14}/> }
                    ].map((s, i, arr) => {
                      const max = arr[0].val || 1;
                      const pct = Math.min(100, (s.val / max) * 100).toFixed(1);
                      const funnelWidth = (100 - (i * 15)); 
                      return (
                        <div key={i} className="w-full flex flex-col items-center" style={{ maxWidth: `${funnelWidth}%` }}>
                          <div className="w-full flex justify-between text-[10px] font-black uppercase mb-1.5 px-2">
                            <span className="flex items-center gap-1.5 text-slate-400">{s.icon} {s.label}</span>
                            <span className="text-slate-200">{s.val.toLocaleString()} {i>0 && `(${pct}%)`}</span>
                          </div>
                          <div className={`w-full h-8 ${s.color} rounded-lg shadow-lg shadow-black/40 border border-white/5 transition-all duration-500`}></div>
                          {i < arr.length -1 && <div className="h-4 w-px bg-slate-800 my-1"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-8 text-center">Distribuição de verba</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dadosGrafico} layout="vertical" margin={{left:-20}}>
                      <XAxis type="number" hide/>
                      <YAxis dataKey="nome" type="category" tick={{fontSize:9, fill:'#64748b'}} width={90} />
                      <Tooltip cursor={{fill:'#1e293b'}} contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'8px'}} formatter={(v) => [`R$ ${parseFloat(v).toFixed(2)}`, 'Gasto']} />
                      <Bar dataKey="rawValor" fill="#3b82f6" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
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
                   const medals = ['🥇', '🥈', '🥉'];
                   const medal = idx < 3 && cpa > 0 ? medals[idx] : null;
                   const borderHighlight = idx === 0 && cpa > 0 ? 'border-yellow-500/60 shadow-yellow-900/10' : idx === 1 && cpa > 0 ? 'border-slate-400/40' : idx === 2 && cpa > 0 ? 'border-amber-700/40' : 'border-slate-800';
                   return (
                     <div key={c.id} className={`bg-slate-900 rounded-2xl border ${borderHighlight} overflow-hidden group hover:border-blue-500/50 transition-all flex flex-col h-full shadow-2xl`}>
                       <div className="h-64 bg-slate-950 flex items-center justify-center relative overflow-hidden">
                         {c.url_midia ? (
                            <img src={c.url_midia} alt={c.nome_anuncio} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                         ) : (
                            <ImageIcon className="text-slate-800" size={48} />
                         )}
                         {medal && <div className="absolute top-2 left-2 text-2xl drop-shadow-lg">{medal}</div>}
                         <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white uppercase border border-white/10 backdrop-blur-sm">CTR: {parseFloat(c.ctr || 0).toFixed(2)}%</div>
                       </div>
                       <div className="p-5 flex-1 flex flex-col">
                         <div className="text-[12px] font-bold text-slate-100 line-clamp-1 mb-4 uppercase tracking-tight">{medal ? `${medal} ` : ''}{c.nome_anuncio}</div>
                         <div className="grid grid-cols-2 gap-3 mb-4">
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800"><div className="text-[9px] text-slate-500 font-black uppercase tracking-tighter text-center">Alcance</div><div className="text-xs font-bold text-slate-100 text-center">{c.alcance?.toLocaleString()}</div></div>
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800"><div className="text-[9px] text-slate-500 font-black uppercase tracking-tighter text-center">Impressões</div><div className="text-xs font-bold text-slate-100 text-center">{c.impressoes?.toLocaleString()}</div></div>
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800"><div className="text-[9px] text-slate-500 font-black uppercase tracking-tighter text-center">Gasto</div><div className="text-xs font-bold text-slate-100 text-center">R$ {parseFloat(c.valor_investido).toFixed(2)}</div></div>
                           <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800"><div className="text-[9px] text-slate-500 font-black uppercase tracking-tighter text-center">{segmento === 'inside_sales' ? 'Leads' : 'Vendas'}</div><div className="text-xs font-bold text-slate-100 text-center">{segmento === 'inside_sales' ? c.leads : c.compras}</div></div>
                         </div>
                         <div className={`w-full py-2.5 ${cpa > 0 && idx < 3 ? 'bg-emerald-600 border-emerald-500' : 'bg-blue-600 border-blue-500'} shadow-lg text-white rounded-xl text-center text-xs font-black uppercase tracking-widest mt-auto border`}>CPA: {cpa > 0 ? `R$ ${cpa.toFixed(2)}` : 'Sem resultado'}</div>
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

          {activeTab === 'entrada' && (
            <div className="max-w-4xl mx-auto py-10">
               <h1 className="text-3xl font-bold mb-2 text-slate-100">Entrada de Conversões Manuais</h1>
               <p className="text-slate-500 mb-8">Vincule resultados reais de CRM e Vendas às campanhas da Meta.</p>
               <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center py-20 shadow-2xl">
                  <Database size={48} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-400 font-bold">Módulo de Metrificação Avançada</p>
                  <p className="text-slate-500 text-sm mt-2">Esta funcionalidade permitirá calcular o ROI Real baseado no faturamento efetivado no seu caixa.</p>
               </div>
            </div>
          )}

          {activeTab === 'campanhas' && (
            <div className="max-w-5xl mx-auto py-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-slate-100">Gestão de Campanhas</h1>
                  <p className="text-slate-500 text-sm mt-1">Controle direto via Meta Marketing API — {clienteSelecionado}</p>
                </div>
                <button onClick={loadCampaigns} disabled={campaignsLoading} className="p-2 px-4 bg-blue-600/20 text-blue-400 rounded-lg font-bold text-xs flex items-center gap-2 border border-blue-500/20 hover:bg-blue-600/30 transition-all">
                  <RefreshCw size={14} className={campaignsLoading ? 'animate-spin' : ''} /> Atualizar
                </button>
              </div>

              {campaignsLoading && (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              )}

              {!campaignsLoading && campaignsList.length === 0 && (
                <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center shadow-2xl">
                  <Megaphone size={48} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-400 font-bold">Nenhuma campanha encontrada</p>
                  <p className="text-slate-500 text-sm mt-2">Clique em "Atualizar" para buscar campanhas da Meta.</p>
                </div>
              )}

              {!campaignsLoading && campaignsList.length > 0 && (
                <div className="space-y-3">
                  {campaignsList.map(camp => (
                    <div key={camp.id} className={`bg-slate-900 rounded-2xl border ${camp.status === 'ACTIVE' ? 'border-emerald-500/30' : 'border-slate-800'} p-5 shadow-xl transition-all hover:border-slate-600`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {editingCampaign === camp.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-100 truncate">{camp.name}</span>
                              <div className="flex items-center gap-1 ml-4">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Orçamento:</span>
                                <input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} className="bg-slate-800 text-xs font-bold text-slate-100 p-1.5 rounded border border-slate-700 w-24 outline-none" placeholder="R$" />
                                <button onClick={() => handleUpdateCampaign(camp.id, { daily_budget: editBudget })} className="p-1.5 bg-emerald-600 rounded text-white hover:bg-emerald-700 transition-all"><Check size={12} /></button>
                                <button onClick={() => setEditingCampaign(null)} className="p-1.5 bg-slate-700 rounded text-slate-300 hover:bg-slate-600 transition-all"><X size={12} /></button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-bold text-slate-100 truncate">{camp.name}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">{camp.objective?.replace('OUTCOME_', '') || 'N/A'}</span>
                                {camp.daily_budget && <span className="text-[10px] text-blue-400 font-bold">R$ {camp.daily_budget}/dia</span>}
                                {camp.lifetime_budget && <span className="text-[10px] text-purple-400 font-bold">R$ {camp.lifetime_budget} total</span>}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button onClick={() => { setEditingCampaign(camp.id); setEditBudget(camp.daily_budget || ''); }} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Editar orçamento"><Pencil size={14} /></button>
                          <button
                            onClick={() => handleUpdateCampaign(camp.id, { status: camp.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                            className={`p-2 px-4 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${camp.status === 'ACTIVE' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-600/20 hover:text-emerald-400 hover:border-emerald-500/20'}`}
                          >
                            {camp.status === 'ACTIVE' ? <><Pause size={12} /> Ativa</> : <><Play size={12} /> Pausada</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
