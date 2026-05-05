"use client";

import React, { useState, useRef } from 'react';
import { 
  Calendar, 
  Upload, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Video, 
  Send, 
  Clock, 
  X, 
  Check, 
  Loader2, 
  Info,
  Smartphone,
  Layout,
  PlaySquare,
  Sparkles
} from 'lucide-react';

export default function InstagramPlannerView({ cliente }) {
  const [activeType, setActiveType] = useState('FEED'); // FEED, REELS, STORY
  const [sourceType, setSourceType] = useState('url'); // url, upload
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        setMediaUrl(data.url);
        setMessage({ tipo: 'sucesso', texto: 'Mídia carregada com sucesso!' });
      } else {
        setMessage({ tipo: 'erro', texto: data.error });
      }
    } catch (err) {
      setMessage({ tipo: 'erro', texto: 'Falha ao processar upload.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!mediaUrl) return setMessage({ tipo: 'erro', texto: 'Insira uma mídia antes de continuar.' });

    setIsSubmitting(true);
    setMessage(null);

    let scheduleTimestamp = null;
    if (scheduleMode && scheduleDate && scheduleTime) {
      const dt = new Date(`${scheduleDate}T${scheduleTime}`);
      scheduleTimestamp = Math.floor(dt.getTime() / 1000);

      // Validação básica da Meta: No mínimo 10 min no futuro
      const now = Math.floor(Date.now() / 1000);
      if (scheduleTimestamp < now + 600) {
        setIsSubmitting(false);
        return setMessage({ tipo: 'erro', texto: 'O agendamento deve ser de pelo menos 10 minutos no futuro.' });
      }
    }

    try {
      const res = await fetch('/api/meta/publish-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente,
          mediaUrl,
          caption,
          type: activeType,
          scheduleTime: scheduleTimestamp
        })
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ tipo: 'sucesso', texto: data.message || 'Post publicado com sucesso!' });
        if (!scheduleMode) {
            setMediaUrl('');
            setCaption('');
        }
      } else {
        setMessage({ tipo: 'erro', texto: data.error });
      }
    } catch (err) {
      setMessage({ tipo: 'erro', texto: 'Erro de comunicação com o servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVideo = mediaUrl && mediaUrl.match(/\.(mp4|mov|avi|webm)$/i);

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div className="space-y-2">
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em]">Content Planner</p>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
            Planner KrM <Calendar className="text-blue-500" size={40} />
          </h1>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Smartphone size={12} className="text-blue-500/50" /> Programação nativa para Instagram e Reels
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-6 rounded-[2rem] border flex items-center gap-4 animate-in zoom-in duration-300 ${
          message.tipo === 'erro' ? 'bg-red-600/10 border-red-500/20 text-red-400' : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {message.tipo === 'erro' ? <X size={20} /> : <Check size={20} />}
          <p className="text-xs font-bold uppercase tracking-widest">{message.texto}</p>
          <button onClick={() => setMessage(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={16}/></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* LADO ESQUERDO: FORMULÁRIO */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-slate-900/50 rounded-[3rem] border border-slate-800 p-10 space-y-8 shadow-2xl backdrop-blur-md">
            
            {/* TIPO DE POST */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Conteúdo</label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'FEED', label: 'Feed', icon: Layout },
                  { id: 'REELS', label: 'Reels', icon: PlaySquare },
                  { id: 'STORY', label: 'Story', icon: Smartphone },
                ].map(type => (
                  <button 
                    key={type.id} 
                    onClick={() => setActiveType(type.id)}
                    className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-3 ${
                      activeType === type.id 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-900/20' 
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    <type.icon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* FONTE DA MÍDIA */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mídia do Post</label>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button onClick={() => setSourceType('url')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${sourceType === 'url' ? 'bg-slate-800 text-blue-400' : 'text-slate-600'}`}>Link Público</button>
                  <button onClick={() => setSourceType('upload')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${sourceType === 'upload' ? 'bg-slate-800 text-blue-400' : 'text-slate-600'}`}>Fazer Upload</button>
                </div>
              </div>

              {sourceType === 'url' ? (
                <div className="relative">
                  <input 
                    type="text" 
                    value={mediaUrl} 
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="Cole a URL pública da imagem ou vídeo..." 
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-sm text-slate-200 outline-none focus:border-blue-600/50 transition-all pl-14"
                  />
                  <LinkIcon className="absolute left-5 top-5 text-slate-600" size={20} />
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 bg-slate-950 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-600/50 transition-all group"
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
                  {isUploading ? (
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                  ) : (
                    <>
                      <Upload className="text-slate-700 group-hover:text-blue-500 transition-colors" size={32} />
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-400">Clique para selecionar arquivo</p>
                    </>
                  )}
                </div>
              )}
              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                <Info size={10} /> Formatos aceitos: JPG, PNG, MP4, MOV. Aspecto recomendado: 4:5 ou 9:16.
              </p>
            </div>

            {/* LEGENDA */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Legenda (Caption)</label>
              <textarea 
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Escreva algo impactante para este post..."
                className="w-full h-40 bg-slate-950 border-2 border-slate-800 rounded-3xl p-6 text-sm text-slate-200 outline-none focus:border-blue-600/50 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* OPÇÕES DE ENVIO */}
            <div className="pt-6 border-t border-slate-800 space-y-6">
              <div className="flex items-center justify-between bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${scheduleMode ? 'bg-purple-600/10 text-purple-500' : 'bg-blue-600/10 text-blue-500'}`}>
                      <Clock size={24} />
                   </div>
                   <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tighter">Agendamento Nativo</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Programar postagem via Meta</p>
                   </div>
                </div>
                <button 
                  onClick={() => setScheduleMode(!scheduleMode)}
                  className={`w-14 h-8 rounded-full relative transition-all ${scheduleMode ? 'bg-blue-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${scheduleMode ? 'left-7' : 'left-1 shadow-md'}`}></div>
                </button>
              </div>

              {scheduleMode && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-500">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Data da Publicação</label>
                      <input 
                        type="date" 
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Horário (Fuso Local)</label>
                      <input 
                        type="time" 
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-600/50" 
                      />
                   </div>
                </div>
              )}

              <button 
                onClick={handlePublish}
                disabled={isSubmitting || !mediaUrl}
                className={`w-full py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-2xl ${
                  isSubmitting || !mediaUrl 
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                    : scheduleMode ? 'bg-purple-600 text-white shadow-purple-900/20 hover:bg-purple-700' : 'bg-blue-600 text-white shadow-blue-900/20 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" size={20} /> Processando...</>
                ) : (
                  <>
                    {scheduleMode ? <Calendar size={18} /> : <Send size={18} />}
                    {scheduleMode ? 'Confirmar Agendamento' : 'Publicar Agora'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: PREVIEW */}
        <div className="lg:col-span-2">
          <div className="sticky top-10 space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Preview do Post</h3>
            
            <div className="bg-black w-full max-w-[320px] mx-auto rounded-[3rem] border-[8px] border-slate-900 shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden aspect-[9/18.5] relative">
              
              {/* STATUS BAR MOCK */}
              <div className="h-10 w-full flex justify-between items-center px-6 pt-2">
                <span className="text-[10px] font-bold text-white">9:41</span>
                <div className="flex gap-1.5 items-center">
                  <div className="w-4 h-2.5 border border-white/40 rounded-[2px]"></div>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>

              {/* INSTAGRAM HEADER MOCK */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[2px]">
                    <div className="w-full h-full rounded-full bg-slate-900 border border-black flex items-center justify-center text-[10px] font-black text-white uppercase tracking-tighter">KrM</div>
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-tight">{cliente || 'Empresa'}</span>
                </div>
              </div>

              {/* CONTENT AREA */}
              <div className={`w-full bg-slate-900/50 flex items-center justify-center overflow-hidden ${activeType === 'STORY' || activeType === 'REELS' ? 'h-[75%]' : 'aspect-square'}`}>
                {mediaUrl ? (
                  isVideo ? (
                    <video src={mediaUrl} className="w-full h-full object-cover" autoPlay muted loop />
                  ) : (
                    <img src={mediaUrl} className="w-full h-full object-cover" alt="Preview" />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-20">
                     <ImageIcon size={48} />
                     <span className="text-[8px] font-black uppercase">Nenhuma mídia selecionada</span>
                  </div>
                )}
              </div>

              {/* CAPTION AREA (For Feed) */}
              {activeType === 'FEED' && (
                <div className="p-4 space-y-2">
                  <div className="flex gap-3 text-white">
                    <Sparkles size={16} />
                    <Send size={16} />
                  </div>
                  <p className="text-[10px] text-white/90 line-clamp-3 leading-tight">
                    <span className="font-bold mr-1">{cliente || 'Empresa'}</span>
                    {caption || 'A legenda aparecerá aqui...'}
                  </p>
                </div>
              )}

              {/* REELS/STORY CAPTION (Overlay) */}
              {(activeType === 'REELS' || activeType === 'STORY') && mediaUrl && (
                <div className="absolute bottom-16 left-4 right-12 text-white drop-shadow-lg">
                   <p className="text-[10px] font-bold mb-1">@{cliente || 'empresa'}</p>
                   <p className="text-[11px] line-clamp-2 leading-tight">{caption}</p>
                </div>
              )}

              {/* HOME INDICATOR */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full"></div>
            </div>

            <div className="bg-blue-600/5 p-6 rounded-3xl border border-blue-500/10 flex items-start gap-4 mx-4">
              <Sparkles size={20} className="text-blue-500 flex-shrink-0 mt-1" />
              <p className="text-[10px] text-blue-400/80 leading-relaxed font-medium">
                O Planner KrM utiliza a infraestrutura de Business Account da Meta. Postagens agendadas podem ser gerenciadas também pelo seu Meta Business Suite.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
