'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MetaCampaign } from '@/types/meta-campaigns';
import { calculateAndromedaFlow } from '@/utils/andromeda-heuristics';

interface Props {
  campaign: MetaCampaign;
}

const AndromedaPredictiveChart: React.FC<Props> = ({ campaign }) => {
  const data = calculateAndromedaFlow(campaign);

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
          Aguardando histórico real para cálculo preditivo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-48 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorRoas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
          <XAxis 
            dataKey="date" 
            hide 
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              borderRadius: '16px', 
              border: '1px solid #1e293b',
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#fff'
            }}
            itemStyle={{ padding: '2px 0' }}
          />
          <Area 
            type="monotone" 
            dataKey="probability" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorProb)" 
            name="Probabilidade"
          />
          <Area 
            type="monotone" 
            dataKey="roas" 
            stroke="#a855f7" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRoas)" 
            name="ROAS"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-2 px-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[8px] font-black text-slate-500 uppercase">Probabilidade</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span className="text-[8px] font-black text-slate-500 uppercase">ROAS Real</span>
        </div>
      </div>
    </div>
  );
};

export default AndromedaPredictiveChart;
