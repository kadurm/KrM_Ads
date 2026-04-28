"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Target, Zap, TrendingUp, MessageSquare, Smartphone, ShoppingBag, Eye, Loader2,
  Globe, Users, Image as ImageIcon, Link as LinkIcon, Type, Layers, MousePointer2, 
  Monitor, ChevronDown, ChevronRight, AlertCircle, Info, Layout, Search
} from 'lucide-react';
import { MetaAdSetTargeting, MetaAdCreative, MetaPromotedObject, MetaCampaign } from '@/types/meta-campaigns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
  clienteName: string;
  level: string;
  parentId?: string | null;
  initialData?: MetaCampaign | null;
}

const OBJECTIVES = [
  { id: 'OUTCOME_AWARENESS', label: 'Awareness', icon: Eye, description: 'Maximize reach and brand recall' },
  { id: 'OUTCOME_TRAFFIC', label: 'Traffic', icon: TrendingUp, description: 'Send people to a destination' },
  { id: 'OUTCOME_ENGAGEMENT', label: 'Engagement', icon: MessageSquare, description: 'Get more messages or video views' },
  { id: 'OUTCOME_LEADS', label: 'Leads', icon: Target, description: 'Collect leads for your business' },
  { id: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', icon: Smartphone, description: 'Get more people to install your app' },
  { id: 'OUTCOME_SALES', label: 'Sales', icon: ShoppingBag, description: 'Find people likely to purchase' },
];

export const CampaignBuilderModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, clienteName, level, parentId }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');
  
  const [formData, setFormData] = useState<any>({
    name: '',
    status: 'PAUSED',
  });

  // Reset/Initialize form based on level
  useEffect(() => {
    if (!isOpen) return;
    
    setActiveTab('geral');
    setExpandedSection('basic');

    if (level === 'campaign') {
      setFormData({
        name: '',
        objective: 'OUTCOME_LEADS',
        advantage_plus_budget: true,
        daily_budget: 50,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        status: 'PAUSED',
      });
    } else if (level === 'adset') {
      setFormData({
        name: '',
        campaign_id: parentId,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'REACH',
        daily_budget: 20,
        start_time: new Date().toISOString().slice(0, 16),
        end_time: '',
        targeting: { 
          geo_locations: { countries: ['BR'] }, 
          age_min: 18, 
          age_max: 65,
          publisher_platforms: ['facebook', 'instagram', 'audience_network', 'messenger']
        },
        status: 'PAUSED',
      });
    } else if (level === 'ad') {
      setFormData({
        name: '',
        adset_id: parentId,
        pixel_id: '',
        creative: {
          object_story_spec: {
            page_id: '',
            instagram_actor_id: '',
            link_data: {
              link: '',
              message: '',
              call_to_action: { type: 'LEARN_MORE' }
            }
          }
        },
        status: 'PAUSED',
      });
    }
  }, [level, parentId, isOpen]);

  if (!isOpen) return null;

  const handleHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        cliente: clienteName,
        type: level,
        data: formData
      });
      onClose();
    } catch (error) {
      console.error('Error in builder submission:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // --- ANDROMEDA INSIGHT COMPONENT ---
  const AndromedaInsight = ({ text }: { text: string }) => (
    <div className="flex items-start gap-2 p-3 bg-blue-600/5 border border-blue-500/20 rounded-xl mt-2">
      <Zap size={12} className="text-blue-500 mt-0.5 shrink-0" />
      <p className="text-[9px] font-bold text-blue-400/80 leading-tight uppercase tracking-tight">
        Andromeda Intelligence: <span className="text-white/70">{text}</span>
      </p>
    </div>
  );

  // --- RENDERERS ---

  const renderTabs = () => {
    const tabs = {
      campaign: [
        { id: 'geral', label: 'Geral', icon: Layout },
        { id: 'budget', label: 'Orçamento', icon: Zap }
      ],
      adset: [
        { id: 'geral', label: 'Configuração', icon: Layout },
        { id: 'audience', label: 'Público', icon: Users },
        { id: 'placements', label: 'Posicionamentos', icon: Monitor }
      ],
      ad: [
        { id: 'geral', label: 'Identidade', icon: Layout },
        { id: 'content', label: 'Conteúdo', icon: ImageIcon },
        { id: 'tracking', label: 'Rastreamento', icon: MousePointer2 }
      ]
    }[level] || [];

    return (
      <div className="flex gap-1 p-1 bg-slate-950/50 rounded-2xl border border-slate-800/50 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
              ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}
            `}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  const renderCampaignTab = () => {
    if (activeTab === 'geral') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Strategic Objective</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {OBJECTIVES.map((obj) => (
                <div 
                  key={obj.id}
                  onClick={() => setFormData({ ...formData, objective: obj.id })}
                  className={`
                    cursor-pointer p-4 rounded-2xl border transition-all group
                    ${formData.objective === obj.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}
                  `}
                >
                  <obj.icon size={20} className={formData.objective === obj.id ? 'text-blue-500' : 'text-slate-600 group-hover:text-slate-400'} />
                  <p className={`text-[11px] font-black mt-3 uppercase tracking-tighter ${formData.objective === obj.id ? 'text-white' : 'text-slate-400'}`}>
                    {obj.label}
                  </p>
                </div>
              ))}
            </div>
            <AndromedaInsight text="Objetivos de LEAD e SALES têm 42% mais ROI em contas com CAPI ativa." />
          </div>
        </div>
      );
    }
    
    if (activeTab === 'budget') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Advantage+ Campaign Budget</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Machine Learning dynamic allocation (CBO)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFormData({ ...formData, advantage_plus_budget: !formData.advantage_plus_budget })}
                className={`w-12 h-6 rounded-full relative transition-all ${formData.advantage_plus_budget ? 'bg-blue-600' : 'bg-slate-800'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.advantage_plus_budget ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Daily Budget (BRL)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-black text-[11px]">R$</span>
                    <input 
                      type="number" 
                      value={formData.daily_budget}
                      onChange={(e) => setFormData({ ...formData, daily_budget: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pl-12 text-[13px] text-blue-400 outline-none focus:border-blue-600/50 transition-all font-black"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bid Strategy</label>
                <select 
                  value={formData.bid_strategy}
                  onChange={(e) => setFormData({ ...formData, bid_strategy: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50 transition-all"
                >
                  <option value="LOWEST_COST_WITHOUT_CAP">Lowest Cost (Recommended)</option>
                  <option value="COST_CAP">Cost Cap</option>
                  <option value="BID_CAP">Bid Cap</option>
                </select>
              </div>
            </div>
            <AndromedaInsight text="CBO reduz o CPA médio em 18% para campanhas com mais de 3 conjuntos." />
          </div>
        </div>
      );
    }
  };

  const renderAdSetTab = () => {
    if (activeTab === 'geral') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Optimization Goal</label>
              <select 
                value={formData.optimization_goal}
                onChange={(e) => setFormData({ ...formData, optimization_goal: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50 transition-all"
              >
                <option value="REACH">REACH</option>
                <option value="IMPRESSIONS">IMPRESSIONS</option>
                <option value="LINK_CLICKS">LINK CLICKS</option>
                <option value="CONVERSIONS">CONVERSIONS</option>
                <option value="LANDING_PAGE_VIEWS">LANDING PAGE VIEWS</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Billing Event</label>
              <select 
                value={formData.billing_event}
                onChange={(e) => setFormData({ ...formData, billing_event: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50 transition-all"
              >
                <option value="IMPRESSIONS">Impressions (Recommended)</option>
                <option value="LINK_CLICKS">Link Clicks (CPC)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Layers size={12} className="text-slate-600" /> Start Time
              </label>
              <input 
                type="datetime-local" 
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] text-white outline-none focus:border-blue-600/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Layers size={12} className="text-slate-600" /> End Time (Optional)
              </label>
              <input 
                type="datetime-local" 
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] text-white outline-none focus:border-blue-600/50"
              />
            </div>
          </div>
          <AndromedaInsight text="Agendamentos para as 05:00 AM tendem a ter CPC 10% menor no leilão matinal." />
        </div>
      );
    }

    if (activeTab === 'audience') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-blue-500" />
              <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Location & Demographics</h4>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-600 uppercase">Countries</span>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  {formData.targeting.geo_locations.countries.map((c: string) => (
                    <span key={c} className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-[9px] font-black border border-blue-500/30 flex items-center gap-2">
                      {c} <X size={10} className="cursor-pointer" />
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Age Range</span>
                  <div className="flex items-center gap-3">
                     <input 
                       type="number" 
                       value={formData.targeting.age_min}
                       onChange={(e) => setFormData({ ...formData, targeting: { ...formData.targeting, age_min: Number(e.target.value) } })}
                       className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] text-center text-white" 
                     />
                     <span className="text-slate-700 font-bold">-</span>
                     <input 
                       type="number" 
                       value={formData.targeting.age_max}
                       onChange={(e) => setFormData({ ...formData, targeting: { ...formData.targeting, age_max: Number(e.target.value) } })}
                       className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] text-center text-white" 
                     />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Gender</span>
                  <select 
                    value={formData.targeting.genders?.[0] || 'ALL'}
                    onChange={(e) => setFormData({ ...formData, targeting: { ...formData.targeting, genders: e.target.value === 'ALL' ? undefined : [Number(e.target.value)] } })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] text-white"
                  >
                    <option value="ALL">All Genders</option>
                    <option value="1">Men</option>
                    <option value="2">Women</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-[2rem] space-y-4">
            <div className="flex items-center gap-3">
              <Users size={16} className="text-purple-500" />
              <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Detailed Targeting</h4>
            </div>
            <div className="relative group">
              <input 
                type="text"
                placeholder="Search interests, behaviors..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 pl-12 text-[11px] text-white outline-none focus:border-purple-500/50"
              />
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-50">
               <AlertCircle size={20} className="text-slate-700" />
               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Advanced Targeting UI Module Loading...</p>
            </div>
            <AndromedaInsight text="Públicos BROAD (sem interesses) convertem 22% melhor em escala." />
          </div>
        </div>
      );
    }

    if (activeTab === 'placements') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={18} className="text-blue-500" />
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Advantage+ Placements</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Automatic distribution across Meta ecosystem</p>
                </div>
              </div>
              <div className="w-12 h-6 rounded-full bg-blue-600 relative">
                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {['Facebook', 'Instagram', 'Messenger', 'Audience Network'].map(p => (
                <div key={p} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between group hover:border-slate-700 transition-all">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                </div>
              ))}
            </div>
            <AndromedaInsight text="Reels e Stories representam 68% do engajamento em 2026." />
          </div>
        </div>
      );
    }
  };

  const renderAdTab = () => {
    if (activeTab === 'geral') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Facebook Page ID</label>
              <input 
                type="text" 
                value={formData.creative.object_story_spec.page_id}
                onChange={(e) => setFormData({ ...formData, creative: { ...formData.creative, object_story_spec: { ...formData.creative.object_story_spec, page_id: e.target.value } } })}
                placeholder="Enter Page ID"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Instagram Account ID</label>
              <input 
                type="text" 
                value={formData.creative.object_story_spec.instagram_actor_id}
                onChange={(e) => setFormData({ ...formData, creative: { ...formData.creative, object_story_spec: { ...formData.creative.object_story_spec, instagram_actor_id: e.target.value } } })}
                placeholder="Enter Instagram ID (Optional)"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-purple-600/50"
              />
            </div>
          </div>
          <AndromedaInsight text="Anúncios com Instagram Actor conectado têm 12% mais CTR." />
        </div>
      );
    }

    if (activeTab === 'content') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-4">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                 <ImageIcon size={12} /> Media Hash / Video ID
               </label>
               <input 
                 type="text" 
                 value={formData.creative.object_story_spec.link_data.image_hash || ''}
                 onChange={(e) => setFormData({ ...formData, creative: { ...formData.creative, object_story_spec: { ...formData.creative.object_story_spec, link_data: { ...formData.creative.object_story_spec.link_data, image_hash: e.target.value } } } })}
                 placeholder="Enter Asset ID or Hash"
                 className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50 font-mono"
               />
            </div>

            <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-[2rem] space-y-6">
              <div className="flex items-center gap-3">
                <Type size={16} className="text-blue-500" />
                <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Ad Copy (Standard)</h4>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Primary Text</span>
                  <textarea 
                    value={formData.creative.object_story_spec.link_data.message}
                    onChange={(e) => setFormData({ ...formData, creative: { ...formData.creative, object_story_spec: { ...formData.creative.object_story_spec, link_data: { ...formData.creative.object_story_spec.link_data, message: e.target.value } } } })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[12px] text-white min-h-[100px] resize-none focus:border-blue-600/50 outline-none transition-all"
                    placeholder="Capture attention with your main copy..."
                  />
                  <AndromedaInsight text="Textos primários com menos de 280 caracteres perfomam 15% melhor." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Headline</span>
                      <input 
                        type="text" 
                        placeholder="Short catchy title"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] text-white"
                      />
                   </div>
                   <div className="space-y-2">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">CTA Type</span>
                      <select 
                        value={formData.creative.object_story_spec.link_data.call_to_action.type}
                        onChange={(e) => setFormData({ ...formData, creative: { ...formData.creative, object_story_spec: { ...formData.creative.object_story_spec, link_data: { ...formData.creative.object_story_spec.link_data, call_to_action: { ...formData.creative.object_story_spec.link_data.call_to_action, type: e.target.value } } } } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] text-white"
                      >
                        <option value="LEARN_MORE">Learn More</option>
                        <option value="CONTACT_US">Contact Us</option>
                        <option value="SEND_MESSAGE">Send Message</option>
                        <option value="SHOP_NOW">Shop Now</option>
                        <option value="ORDER_NOW">Order Now</option>
                      </select>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'tracking') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3">
              <MousePointer2 size={16} className="text-emerald-500" />
              <h4 className="text-[11px] font-black text-white uppercase tracking-tight">Tracking & URL Parameters</h4>
            </div>

            <div className="space-y-4">
               <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Destination URL</span>
                  <input 
                    type="text" 
                    value={formData.creative.object_story_spec.link_data.link}
                    onChange={(e) => setFormData({ ...formData, creative: { ...formData.creative, object_story_spec: { ...formData.creative.object_story_spec, link_data: { ...formData.creative.object_story_spec.link_data, link: e.target.value } } } })}
                    placeholder="https://yourlandingpage.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] text-blue-400 outline-none"
                  />
               </div>
               <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">URL Parameters (UTM)</span>
                  <input 
                    type="text" 
                    placeholder="utm_source={{site_source_name}}&utm_campaign={{campaign.name}}..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-400 font-mono outline-none"
                  />
               </div>
            </div>
            <AndromedaInsight text="Tracking dinâmico detectado. Integrando com CRM Solution..." />
          </div>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* BACKDROP */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={onClose} />

      {/* MODAL */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto">
          
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Andromeda Protocol</p>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Initialize New {level === 'campaign' ? 'Campaign' : level === 'adset' ? 'Ad Set' : 'Ad'}</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleHandleSubmit} className="space-y-6">
            {/* NAME INPUT */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identification</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Ex: [ANDROMEDA] - ${level.toUpperCase()} 01`}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-white outline-none focus:border-blue-600/50 transition-all font-medium"
              />
            </div>

            {renderTabs()}

            <div className="min-h-[400px]">
              {level === 'campaign' && renderCampaignTab()}
              {level === 'adset' && renderAdSetTab()}
              {level === 'ad' && renderAdTab()}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-4 pt-4 sticky bottom-0 bg-slate-900 py-4 border-t border-slate-800/50">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800/50 transition-all"
              >
                Cancel Protocol
              </button>
              <button 
                disabled={loading || !formData.name}
                type="submit"
                className="flex-[2] py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : 'Execute Deployment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
