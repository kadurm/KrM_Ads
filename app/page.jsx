"use client";

import React, { useState } from 'react';
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
  DollarSign
} from 'lucide-react';

export default function App() {
  // Estado Global
  const [activeTab, setActiveTab] = useState('relatorios'); // Iniciar na aba de relatórios
  
  // --- ESTADOS DO MOTOR DE CAMPANHAS ---
  const [tipoCriacao, setTipoCriacao] = useState('campanha');
  const [numero, setNumero] = useState('01');
  const [orcamento, setOrcamento] = useState('CBO');
  const [objetivo, setObjetivo] = useState('Message');
  const [publico, setPublico] = useState('LAL 1%');
  const [formato, setFormato] = useState('Feed/Story');

  const nomeGerado = tipoCriacao === 'campanha' 
    ? `[${numero}][KrM][${orcamento}][${objetivo}]`
    : `[${numero}][KrM][${publico}][${formato}]`;

  // --- ESTADOS DO MÓDULO DE RELATÓRIOS ---
  const [faturamento, setFaturamento] = useState(357500);
  const [investimento, setInvestimento] = useState(3093.29);
  const [totalLeads, setTotalLeads] = useState(69);
  const [isGenerating, setIsGenerating] = useState(false);

  // Cálculos Automáticos
  const cacReal = totalLeads > 0 ? (investimento / totalLeads).toFixed(2) : 0;
  const roas = investimento > 0 ? (faturamento / investimento).toFixed(2) : 0;

  // Dados Mockados baseados no teu PDF de Janeiro
  const relatorioDados = [
    { nome: '[03][KrM][CBO][Message]', impressoes: '37.658', alcance: '21.272', leads: '43', cpa: 'R$ 22,22', visitas: '205', valor: 'R$ 955,51' },
    { nome: '[00][KrM][CBO][Reach]', impressoes: '542.898', alcance: '363.200', leads: '0', cpa: '-', visitas: '166', valor: 'R$ 556,39' },
    { nome: '[06][KrM][CBO][Leads]', impressoes: '13.403', alcance: '10.188', leads: '11', cpa: 'R$ 30,28', visitas: '23', valor: 'R$ 333,04' },
    { nome: '[05][KrM][CBO][Traffic][IG]', impressoes: '18.613', alcance: '11.984', leads: '2', cpa: 'R$ 138,89', visitas: '434', valor: 'R$ 277,78' },
  ];

  const handleGerarIA = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10 flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <LayoutDashboard size={24} className="text-blue-500" />
            KrM Ads
          </h1>
          <span className="block text-xs font-medium text-slate-400 mt-1 tracking-wider uppercase">Gestão de Ecossistema</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('motor')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'motor' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
          >
            <Plus size={18} />
            Motor de Campanhas
          </button>
          <button 
            onClick={() => setActiveTab('relatorios')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'relatorios' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
          >
            <FileText size={18} />
            Relatórios Automáticos
          </button>
          <button className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
            <ImageIcon size={18} />
            Ativos e Criativos
          </button>
          <button className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
            <Settings size={18} />
            Configurações
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800 text-sm text-slate-400 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
            K
          </div>
          <div>
            <p className="text-white font-medium">Equipa KrM</p>
            <p className="text-xs">Admin</p>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Cabeçalho Topo */}
        <header className="bg-white h-16 border-b border-slate-200 flex justify-between items-center px-8 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">
            {activeTab === 'motor' ? 'Criação e Padronização' : 'Auditoria Estratégica de Resultados'}
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center text-sm font-medium text-slate-500 bg-slate-100 py-1.5 px-3 rounded-md">
              <span>Cliente:</span>
              <select className="ml-2 bg-transparent font-semibold text-slate-900 outline-none cursor-pointer">
                <option>Solution Place</option>
                <option>Imobiliária XYZ</option>
              </select>
            </div>
          </div>
        </header>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* ABA: MOTOR DE CAMPANHAS (Mantido) */}
          {activeTab === 'motor' && (
             <div className="max-w-4xl mx-auto">
             <div className="mb-6">
               <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Motor de Criação</h1>
               <p className="text-slate-500 mt-2">Defina os parâmetros estruturais. A IA auxiliará na copy com base no objetivo.</p>
             </div>
             {/* ... conteúdo do motor anterior ... */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8">
                  <div className="mb-8">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                      Nomenclatura Padrão
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Número Identificador</label>
                        <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" placeholder="Ex: 01" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Orçamento</label>
                        <select value={orcamento} onChange={(e) => setOrcamento(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none">
                          <option value="CBO">CBO</option>
                          <option value="ABO">ABO</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Objetivo</label>
                        <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none">
                          <option value="Message">Message</option>
                          <option value="Leads">Leads</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-5 bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-600 uppercase">Preview:</span>
                      <span className="font-mono text-lg font-bold text-slate-800">{nomeGerado}</span>
                    </div>
                  </div>
                </div>
              </div>
           </div>
          )}

          {/* ABA: RELATÓRIOS AUTOMÁTICOS (NOVO!) */}
          {activeTab === 'relatorios' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Top Controls */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Relatório de Performance</h1>
                  <p className="text-slate-500 mt-1">Consolidação de dados do Meta Ads e geração de análises via IA.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select className="bg-white border border-slate-200 text-slate-700 rounded-lg p-2.5 text-sm font-medium outline-none shadow-sm cursor-pointer">
                    <option>Janeiro 2026</option>
                    <option>Fevereiro 2026</option>
                  </select>
                  <button className="bg-white border border-slate-200 text-slate-700 p-2.5 rounded-lg hover:bg-slate-50 transition shadow-sm" title="Sincronizar com Meta Ads">
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>

              {/* Bloco Financeiro e KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-2"><Target size={16}/> Total Investido</span>
                  <span className="text-2xl font-bold text-slate-800 mt-2">R$ 3.093,29</span>
                </div>
                
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500 relative overflow-hidden">
                  <span className="text-sm font-medium text-emerald-600 flex items-center gap-2 z-10"><DollarSign size={16}/> Faturamento (Manual)</span>
                  <input 
                    type="number" 
                    value={faturamento} 
                    onChange={(e) => setFaturamento(e.target.value)}
                    className="text-2xl font-bold text-slate-800 mt-2 bg-transparent outline-none w-full z-10 border-b border-emerald-200 focus:border-emerald-500 transition-colors"
                  />
                  <div className="absolute right-[-20px] top-[-20px] opacity-5 text-emerald-500"><DollarSign size={100}/></div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between text-white">
                  <span className="text-sm font-medium text-blue-300 flex items-center gap-2"><TrendingUp size={16}/> ROAS Real</span>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-3xl font-bold">{roas}x</span>
                    <span className="text-xs text-slate-400 mb-1">retorno</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-2"><MessageCircle size={16}/> CAC Médio</span>
                  <span className="text-2xl font-bold text-slate-800 mt-2">R$ {cacReal}</span>
                </div>
              </div>

              {/* Tabela de Campanhas (Sincronizada da Meta) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800">Tabela de Desempenho (Meta Ads)</h3>
                  <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">Sincronizado há 2 horas</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white">
                        <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome da Campanha</th>
                        <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">Impressões</th>
                        <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads</th>
                        <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo / Lead</th>
                        <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor Usado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relatorioDados.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-medium text-blue-600 whitespace-nowrap">{row.nome}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{row.impressoes}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{row.leads}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{row.cpa}</td>
                          <td className="px-6 py-3 text-sm font-medium text-slate-800 text-right">{row.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seção de Análise de IA */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Sparkles className="text-purple-500" size={18} />
                    Análise e Diagnóstico (OpenAI)
                  </h3>
                  <button 
                    onClick={handleGerarIA}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isGenerating ? 'A processar métricas...' : 'Gerar Análise Completa'}
                  </button>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Diagnóstico de Performance</label>
                    <textarea 
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      defaultValue="Eficiência de Conversão: O Custo por Lead (CPA) médio reduziu para R$ 44,83, uma melhoria significativa em relação aos R$ 66,68 registrados em Dezembro."
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Desenvolvimento do Algoritmo</label>
                    <textarea 
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      defaultValue="A operação demonstrou uma maturação clara do algoritmo e da segmentação de público. Mesmo com um investimento menor, o volume de leads foi superior..."
                    ></textarea>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Próximos Passos (Estratégia)</label>
                    <textarea 
                      className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      defaultValue="Escalar a verba da campanha [03][KrM][CBO][Message] em 20%, aproveitando o baixo CPA de R$ 22,22 para maximizar o volume de leads qualificados."
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Botões de Ação (Exportação) */}
              <div className="flex justify-end gap-3 pt-2 pb-8">
                <button className="px-5 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2">
                  <Download size={18} />
                  Exportar PDF
                </button>
                <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-sm transition-all flex items-center gap-2">
                  <MessageCircle size={18} />
                  Enviar via WhatsApp
                </button>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
