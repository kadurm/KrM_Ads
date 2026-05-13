import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Receipt,
  FileText,
  Plus,
  QrCode,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  X,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';

export function PaymentsView({ clienteName, startDate, endDate }: any) {
  const [activeSubTab, setActiveSubTab] = useState('extrato'); // extrato, metodos, notas
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ transacoes: [], metodos: [], kpis: {} });
  const [notas, setNotas] = useState<any[]>([]);
  
  // Modals
  const [showMetodoModal, setShowMetodoModal] = useState(false);
  const [showTransacaoModal, setShowTransacaoModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMetaReceiptModal, setShowMetaReceiptModal] = useState(false);
  
  const [novoMetodo, setNovoMetodo] = useState<any>({ tipo: 'PIX', descricao: '', chave_pix: '', is_principal: false });
  const [novaTransacao, setNovaTransacao] = useState<any>({ descricao: '', valor: '', data_vencimento: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [metaReceiptDate, setMetaReceiptDate] = useState({ 
    mes: new Date().getMonth(), 
    ano: new Date().getFullYear() 
  });

  const loadData = async () => {
    if (!clienteName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pagamentos?cliente=${encodeURIComponent(clienteName)}&since=${startDate}&until=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }

      const resNotas = await fetch(`/api/pagamentos/notas?cliente=${encodeURIComponent(clienteName)}&since=${startDate}&until=${endDate}`);
      const jsonNotas = await resNotas.json();
      if (jsonNotas.success) {
        setNotas(jsonNotas.notas);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
    };

    useEffect(() => {
    loadData();
    }, [clienteName, startDate, endDate]);

  const handleSaveMetodo = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/pagamentos/metodos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: clienteName, ...novoMetodo }),
      });
      setShowMetodoModal(false);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleSaveTransacao = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cliente: clienteName, 
          ...novaTransacao, 
          categoria: novaTransacao.categoria || 'HONORARIO', 
          tipo: 'COBRANCA' 
        }),
      });
      setShowTransacaoModal(false);
      loadData();
    } catch (err) { console.error(err); }
  };

  const updateTransacaoStatus = async (id, status) => {
    try {
      await fetch('/api/pagamentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, data_pagamento: status === 'PAGO' ? new Date().toISOString() : null }),
      });
      loadData();
    } catch (err) { console.error(err); }
  };

  const deleteMetodo = async (id) => {
    if (!window.confirm('Remover meio de pagamento?')) return;
    await fetch(`/api/pagamentos/metodos?id=${id}`, { method: 'DELETE' });
    loadData();
  };

  const handleUploadNF = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/pagamentos/upload', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        alert(`Nota Fiscal de ${json.cliente} processada com sucesso!`);
        setShowUploadModal(false);
        setSelectedFile(null);
        loadData();
      } else {
        alert(json.error || 'Erro ao processar nota.');
      }
    } catch (err) { console.error(err); alert('Erro crítico ao enviar arquivo.'); }
    finally { setUploading(false); }
  };

  const handleGenerateMetaReceipt = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pagamentos/meta-receipt?cliente=${encodeURIComponent(clienteName)}&mes=${metaReceiptDate.mes}&ano=${metaReceiptDate.ano}`);
      const json = await res.json();
      if (json.success) {
        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('KrM Ads - Comprovante de Investimento', 20, 25);
        
        // Body
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cliente: ${json.cliente}`, 20, 60);
        doc.text(`Período: ${json.periodo.nomeMes} de ${json.periodo.ano}`, 20, 70);
        doc.text(`Data de Emissão: ${new Date(json.dataGeracao).toLocaleDateString()}`, 20, 80);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 90, 190, 90);
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL INVESTIDO EM META ADS', 20, 110);
        
        doc.setFontSize(32);
        doc.setTextColor(37, 99, 235); // blue-600
        doc.text(`R$ ${json.totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 130);
        
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('Este documento é um recibo gerado automaticamente pelo sistema KrM_Ads', 20, 150);
        doc.text('baseado nos dados sincronizados via Graph API da Meta.', 20, 155);
        
        doc.setFont('courier', 'normal');
        doc.text(`Código de Autenticidade: ${json.autenticidade}`, 20, 170);
        
        doc.save(`Recibo_Meta_${json.cliente}_${json.periodo.nomeMes}_${json.periodo.ano}.pdf`);
        setShowMetaReceiptModal(false);
      } else {
        alert(json.error || 'Erro ao gerar recibo.');
      }
    } catch (err) { console.error(err); alert('Erro ao processar recibo.'); }
    finally { setLoading(false); }
  };

  const renderKPIs = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-xl">
        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Total Faturado</p>
        <p className="text-2xl font-black text-white">R$ {(data.kpis.totalGeral || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
      </div>
      <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-xl border-l-4 border-l-emerald-500">
        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-2">Total Recebido</p>
        <p className="text-2xl font-black text-zinc-100">R$ {(data.kpis.totalPago || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
      </div>
      <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-xl border-l-4 border-l-amber-500">
        <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-2">Pendente</p>
        <p className="text-2xl font-black text-zinc-100">R$ {(data.kpis.totalPendente || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
      </div>
      <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-xl">
        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Próx. Vencimento</p>
        <p className="text-xl font-bold text-zinc-100">
          {data.kpis.proximoVencimento ? new Date(data.kpis.proximoVencimento).toLocaleDateString() : '-'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* HEADER & SUB-TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
          {['extrato', 'metodos', 'notas'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeSubTab === tab ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeSubTab === 'extrato' && (
          <button onClick={() => setShowTransacaoModal(true)} className="p-3 px-6 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-amber-700 transition-all shadow-xl shadow-amber-900/30">
            <Plus size={16} /> Nova Cobrança
          </button>
        )}
        {activeSubTab === 'metodos' && (
          <button onClick={() => setShowMetodoModal(true)} className="p-3 px-6 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-amber-700 transition-all shadow-xl shadow-amber-900/30">
            <Plus size={16} /> Adicionar Método
          </button>
        )}
        {activeSubTab === 'notas' && (
          <div className="flex gap-2">
            <button onClick={() => setShowMetaReceiptModal(true)} className="p-3 px-6 bg-zinc-800 text-zinc-200 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-700 transition-all shadow-xl">
              <Download size={16} /> Recibo Meta
            </button>
            <button onClick={() => setShowUploadModal(true)} className="p-3 px-6 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-amber-700 transition-all shadow-xl shadow-amber-900/30">
              <FileText size={16} /> Upload NF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-amber-500" size={40} /></div>
      ) : (
        <>
          {activeSubTab === 'extrato' && (
            <div className="animate-in fade-in duration-500">
              {renderKPIs()}
              <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50 text-[10px] font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800">
                      <th className="p-6">Data</th>
                      <th className="p-6">Descrição</th>
                      <th className="p-6">Status</th>
                      <th className="p-6 text-right">Valor</th>
                      <th className="p-6 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.transacoes.map(t => (
                      <tr key={t.id} className="hover:bg-zinc-800/30 transition-all">
                        <td className="p-6 text-xs text-zinc-400 font-bold">{new Date(t.criado_em).toLocaleDateString()}</td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-amber-500 mb-1 tracking-tighter">{t.categoria}</span>
                            <p className="text-sm font-bold text-zinc-200">{t.descricao}</p>
                            <p className="text-[9px] text-zinc-500 font-black uppercase">{t.referencia}</p>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            t.status === 'PAGO' ? 'bg-emerald-600/10 text-emerald-400' :
                            t.status === 'VENCIDO' ? 'bg-red-600/10 text-red-400' :
                            t.status === 'CANCELADO' ? 'bg-zinc-600/10 text-zinc-400' :
                            'bg-amber-600/10 text-amber-400'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-6 text-right font-mono text-sm font-bold text-zinc-100">R$ {parseFloat(t.valor).toFixed(2)}</td>
                        <td className="p-6 text-center">
                          {t.status === 'PENDENTE' && (
                            <button onClick={() => updateTransacaoStatus(t.id, 'PAGO')} className="p-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-widest mr-2">
                              Marcar Pago
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'metodos' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
              {data.metodos.map(m => (
                <div key={m.id} className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-8 shadow-xl relative group">
                  {m.is_principal && (
                    <span className="absolute top-4 right-4 bg-amber-600/20 text-amber-400 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-amber-500/20">Principal</span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mb-6">
                    {m.tipo === 'PIX' ? <QrCode size={24} /> : m.tipo === 'CARTAO' ? <CreditCard size={24} /> : <Landmark size={24} />}
                  </div>
                  <h3 className="text-lg font-black text-white mb-1">{m.descricao}</h3>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{m.tipo}</p>
                  
                  <div className="mt-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => deleteMetodo(m.id)} className="p-2 bg-red-600/10 text-red-500 rounded-lg hover:bg-red-600/20"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'notas' && (
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl animate-in fade-in duration-500">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/50 text-[10px] font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800">
                    <th className="p-6">Número</th>
                    <th className="p-6">Emissão</th>
                    <th className="p-6">Descrição</th>
                    <th className="p-6 text-right">Valor</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {notas.map(n => (
                    <tr key={n.id} className="hover:bg-zinc-800/30 transition-all">
                      <td className="p-6 font-mono text-sm font-bold text-amber-400">#{String(n.numero).padStart(5, '0')}</td>
                      <td className="p-6 text-xs text-zinc-400 font-bold">{new Date(n.criado_em).toLocaleDateString()}</td>
                      <td className="p-6 text-sm font-bold text-zinc-200">{n.descricao}</td>
                      <td className="p-6 text-right font-mono text-sm font-bold text-zinc-100">R$ {parseFloat(n.valor).toFixed(2)}</td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${n.status === 'EMITIDA' ? 'bg-emerald-600/10 text-emerald-400' : 'bg-red-600/10 text-red-400'}`}>
                          {n.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {notas.length === 0 && (
                     <tr>
                        <td colSpan={5} className="p-10 text-center text-zinc-500 font-bold text-sm">Nenhuma Nota Fiscal emitida neste período.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      {showMetodoModal && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-md rounded-[2rem] border border-zinc-800 p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xl uppercase tracking-tighter text-white">Novo Método</h3>
                  <button onClick={() => setShowMetodoModal(false)} className="text-zinc-500 hover:text-white"><X size={24}/></button>
               </div>
               <form onSubmit={handleSaveMetodo} className="space-y-4">
                  <div>
                     <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Tipo</label>
                     <select value={novoMetodo.tipo} onChange={e => setNovoMetodo({...novoMetodo, tipo: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none">
                        <option value="PIX">PIX</option>
                        <option value="BOLETO">Boleto</option>
                        <option value="CARTAO">Cartão de Crédito</option>
                        <option value="TRANSFERENCIA">Transferência Bancária</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Descrição Curta</label>
                     <input type="text" required value={novoMetodo.descricao} onChange={e => setNovoMetodo({...novoMetodo, descricao: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none" placeholder="Ex: PIX Empresa, Cartão final 1234" />
                  </div>
                  {novoMetodo.tipo === 'PIX' && (
                     <div>
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Chave PIX</label>
                        <input type="text" required value={novoMetodo.chave_pix} onChange={e => setNovoMetodo({...novoMetodo, chave_pix: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none" placeholder="CNPJ, Email, Telefone..." />
                     </div>
                  )}
                  <label className="flex items-center gap-3 mt-4 cursor-pointer">
                     <input type="checkbox" checked={novoMetodo.is_principal} onChange={e => setNovoMetodo({...novoMetodo, is_principal: e.target.checked})} className="w-5 h-5 rounded bg-zinc-950 border-zinc-800" />
                     <span className="text-xs font-bold text-zinc-400">Definir como Principal</span>
                  </label>
                  <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black p-4 rounded-xl mt-6 uppercase tracking-widest text-[10px]">Adicionar Método</button>
               </form>
            </div>
         </div>
      )}

      {showTransacaoModal && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-md rounded-[2rem] border border-zinc-800 p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xl uppercase tracking-tighter text-white">Nova Cobrança</h3>
                  <button onClick={() => setShowTransacaoModal(false)} className="text-zinc-500 hover:text-white"><X size={24}/></button>
               </div>
               <form onSubmit={handleSaveTransacao} className="space-y-4">
                  <div>
                     <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Serviço / Categoria</label>
                     <select 
                        value={novaTransacao.categoria || 'HONORARIO'} 
                        onChange={e => setNovaTransacao({...novaTransacao, categoria: e.target.value})} 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none"
                     >
                        <option value="HONORARIO">Gestão de Tráfego (Fee)</option>
                        <option value="LANDING_PAGE">Landing Page / Site</option>
                        <option value="SOCIAL_MEDIA">Social Media / Design</option>
                        <option value="CONSULTORIA">Consultoria Estratégica</option>
                        <option value="OUTROS">Outros Serviços</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Descrição</label>
                     <input type="text" required value={novaTransacao.descricao} onChange={e => setNovaTransacao({...novaTransacao, descricao: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none" placeholder="Ex: Fee Mensal Maio/26" />
                  </div>
                  <div>
                     <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Valor (R$)</label>
                     <input type="number" step="0.01" required value={novaTransacao.valor} onChange={e => setNovaTransacao({...novaTransacao, valor: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none font-bold text-amber-400" />
                  </div>
                  <div>
                     <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Vencimento</label>
                     <input type="date" value={novaTransacao.data_vencimento} onChange={e => setNovaTransacao({...novaTransacao, data_vencimento: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black p-4 rounded-xl mt-6 uppercase tracking-widest text-[10px]">Gerar Cobrança</button>
               </form>
            </div>
         </div>
      )}

      {showUploadModal && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-md rounded-[2rem] border border-zinc-800 p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xl uppercase tracking-tighter text-white">Upload Nota Fiscal</h3>
                  <button onClick={() => setShowUploadModal(false)} className="text-zinc-500 hover:text-white"><X size={24}/></button>
               </div>
               <p className="text-xs text-zinc-500 mb-6 font-bold leading-relaxed">
                  Envie o arquivo da Nota Fiscal (PDF ou Imagem). Nossa IA identificará o cliente, valor e descrição para organizar seu financeiro automaticamente.
               </p>
               <form onSubmit={handleUploadNF} className="space-y-6">
                  <div className="relative group">
                    <input 
                      type="file" 
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="nf-upload"
                      accept=".pdf,image/*"
                    />
                    <label 
                      htmlFor="nf-upload" 
                      className="w-full h-32 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center cursor-pointer group-hover:border-amber-500/50 transition-all bg-zinc-950/50"
                    >
                      <Plus size={24} className="text-zinc-600 mb-2 group-hover:text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo'}
                      </span>
                    </label>
                  </div>
                  <button 
                    type="submit" 
                    disabled={!selectedFile || uploading}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black p-4 rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    {uploading ? 'Processando com IA...' : 'Enviar e Organizar'}
                  </button>
               </form>
            </div>
         </div>
      )}

      {showMetaReceiptModal && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-md rounded-[2rem] border border-zinc-800 p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xl uppercase tracking-tighter text-white">Extrair Recibo Meta</h3>
                  <button onClick={() => setShowMetaReceiptModal(false)} className="text-zinc-500 hover:text-white"><X size={24}/></button>
               </div>
               <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2">Mês de Referência</label>
                    <div className="grid grid-cols-2 gap-3">
                      <select 
                        value={metaReceiptDate.mes} 
                        onChange={e => setMetaReceiptDate({...metaReceiptDate, mes: parseInt(e.target.value)})}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none"
                      >
                        {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                          <option key={m} value={i}>{m}</option>
                        ))}
                      </select>
                      <select 
                        value={metaReceiptDate.ano} 
                        onChange={e => setMetaReceiptDate({...metaReceiptDate, ano: parseInt(e.target.value)})}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none"
                      >
                        {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={handleGenerateMetaReceipt}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black p-4 rounded-xl mt-4 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> Gerar Recibo PDF
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
