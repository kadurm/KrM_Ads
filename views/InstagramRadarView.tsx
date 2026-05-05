"use client";

import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  Play, 
  Image as ImageIcon, 
  Clock, 
  Sparkles, 
  Zap, 
  Target, 
  ChevronRight, 
  ExternalLink,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';

export default function InstagramRadarView({ cliente }) {
  const [activeSubTab, setActiveSubTab] = useState('feed');
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState({ feed: [], reels: [], stories: [] });
  const [error, setError] = useState(null);
  const [analyzingPostId, setAnalyzingPostId] = useState(null);
  const [analyses, setAnalyses] = useState({});

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta/instagram-posts?cliente=${encodeURIComponent(cliente)}`);
      const data = await res.json();
      if (data.success) {
        setPosts({
          feed: data.feed || [],
          reels: data.reels || [],
          stories: data.stories || []
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Falha ao carregar publicações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cliente) fetchPosts();
  }, [cliente]);

  const handleAnalyze = async (post, type) => {
    setAnalyzingPostId(post.id);
    try {
      const res = await fetch('/api/meta/analyze-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente,
          postData: {
            id: post.id,
            type,
            caption: post.caption,
            timestamp: post.timestamp
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setAnalyses(prev => ({ ...prev, [post.id]: data.analysis || data.raw_analysis }));
      }
    } catch (err) {
      console.error("Erro na análise:", err);
    } finally {
      setAnalyzingPostId(null);
    }
  };

  const PostCard = ({ post, type }) => {
    const analysis = analyses[post.id];
    const isAnalyzing = analyzingPostId === post.id;

    return (
      <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all shadow-2xl">
        <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
          {post.media_type === 'VIDEO' || type === 'reels' ? (
            <>
              <img 
                src={post.thumbnail_url || post.media_url} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                alt="Thumbnail" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                  <Play size={24} fill="white" />
                </div>
              </div>
            </>
          ) : (
            <img 
              src={post.media_url} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              alt="Post" 
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
              {type.toUpperCase()}
            </span>
          </div>
          <a 
            href={post.permalink} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all border border-white/10"
          >
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock size={12} />
            <span className="text-[10px] font-bold uppercase">{new Date(post.timestamp).toLocaleDateString('pt-BR')}</span>
          </div>
          
          <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-medium">
            {post.caption || <span className="italic opacity-50">Sem legenda...</span>}
          </p>

          <div className="mt-auto pt-4 space-y-4">
            {analysis ? (
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block mb-1">Estratégia Recomendada</span>
                    <span className="text-xs font-black text-white uppercase">{analysis.etapa_funil} • {analysis.objetivo_campanha}</span>
                  </div>
                  <Zap size={14} className="text-blue-500" fill="currentColor" />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  "{analysis.justificativa}"
                </p>
                <div className="pt-2 border-t border-blue-500/10">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Info size={10} /> Pergunta Estratégica
                  </p>
                  <p className="text-[11px] text-slate-200 font-bold">{analysis.pergunta_estrategica}</p>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => handleAnalyze(post, type)}
                disabled={isAnalyzing}
                className="w-full py-4 bg-slate-800 hover:bg-blue-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                {isAnalyzing ? (
                  <><Loader2 size={14} className="animate-spin" /> Analisando Potencial...</>
                ) : (
                  <><Sparkles size={14} /> Analisar Potencial de Anúncio</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div className="space-y-2">
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em]">Content Monitoring</p>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
            Radar Instagram <Instagram className="text-blue-500" size={40} />
          </h1>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Target size={12} className="text-blue-500/50" /> Identificando oportunidades de escala em tempo real
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-sm backdrop-blur-md">
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl">
            {[
              { id: 'feed', label: 'Feed' },
              { id: 'reels', label: 'Reels' },
              { id: 'stories', label: 'Stories' },
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveSubTab(tab.id)} 
                className={`px-6 py-2 text-[11px] font-black uppercase rounded-lg transition-all ${
                  activeSubTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-500 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchPosts} 
            disabled={loading}
            className="p-3 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all ml-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sincronizando com a conta comercial...</p>
        </div>
      ) : error ? (
        <div className="bg-red-600/10 border border-red-500/20 p-10 rounded-[3rem] text-center space-y-4">
           <h3 className="text-xl font-black text-red-400 uppercase">Ops! Algo deu errado</h3>
           <p className="text-sm text-slate-400 max-w-md mx-auto">{error}</p>
           <button onClick={fetchPosts} className="p-3 px-8 bg-red-600/20 text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">Tentar Novamente</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-20">
          {posts[activeSubTab].length === 0 ? (
            <div className="col-span-full py-32 text-center opacity-30 flex flex-col items-center gap-4">
              <Instagram size={64} />
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhuma publicação recente encontrada</p>
            </div>
          ) : (
            posts[activeSubTab].map(post => (
              <PostCard key={post.id} post={post} type={activeSubTab} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
