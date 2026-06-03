import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  CreditCard,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function GlobalFinancialView({ startDate, endDate }: any) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pagamentos/global?since=${startDate}&until=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Faturamento Global</p>
          <p className="text-3xl font-black text-white">R$ {data.kpis.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-500">
            <ArrowUpRight size={16} />
            <span className="text-[10px] font-bold uppercase">Recebido no período</span>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl border-l-4 border-l-amber-500">
          <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-2">Total Pendente</p>
          <p className="text-3xl font-black text-slate-100">R$ {data.kpis.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-4 uppercase">Cobranças aguardando</p>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl border-l-4 border-l-red-500">
          <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-2">Atrasados / Vencidos</p>
          <p className="text-3xl font-black text-slate-100">R$ {data.kpis.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-4 uppercase">Atenção necessária</p>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Ticket Médio</p>
          <p className="text-3xl font-black text-slate-100">R$ {(data.kpis.totalPago / (data.rankingClientes.length || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-4 uppercase">Por cliente ativo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* RANKING CLIENTES */}
        <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500">
              <Users size={20} />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">Ranking de Faturamento</h3>
          </div>
          
          <div className="space-y-4">
            {data.rankingClientes.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-xs text-slate-500">{idx + 1}</div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-200">{item.nome}</p>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${(item.total / data.kpis.totalPago) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="font-mono font-bold text-sm text-slate-100">R$ {item.total.toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* DISTRIBUIÇÃO POR SERVIÇO */}
        <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-500">
              <PieChartIcon size={20} />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">Receita por Serviço</h3>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoriasConsolidadas}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.categoriasConsolidadas.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            {data.categoriasConsolidadas.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[10px] font-black uppercase text-slate-500">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRANSAÇÕES RECENTES GLOBAIS */}
      <div className="bg-slate-900 rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-500">
                    <CreditCard size={20} />
                </div>
                <h3 className="font-black text-lg uppercase tracking-tighter">Últimas Transações (Global)</h3>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
              <tr className="bg-slate-950/50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                  <th className="p-6">Cliente</th>
                  <th className="p-6">Data</th>
                  <th className="p-6">Descrição</th>
                  <th className="p-6 text-right">Valor</th>
                  <th className="p-6 text-center">Status</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
              {data.recentes.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-all">
                  <td className="p-6">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{t.cliente.nome}</span>
                  </td>
                  <td className="p-6 text-xs text-slate-400 font-bold">{new Date(t.criado_em).toLocaleDateString()}</td>
                  <td className="p-6">
                      <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase text-slate-500 mb-1 tracking-tighter">{t.categoria}</span>
                          <p className="text-sm font-bold text-slate-200">{t.descricao}</p>
                      </div>
                  </td>
                  <td className="p-6 text-right font-mono text-sm font-bold text-slate-100">R$ {parseFloat(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      t.status === 'PAGO' ? 'bg-emerald-600/10 text-emerald-400' :
                      t.status === 'VENCIDO' ? 'bg-red-600/10 text-red-400' :
                      'bg-amber-600/10 text-amber-400'
                      }`}>
                      {t.status}
                      </span>
                  </td>
                  </tr>
              ))}
              </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
