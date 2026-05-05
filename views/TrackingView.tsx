import React, { useState } from 'react';
import { 
  Target, 
  Code2, 
  Settings2, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Loader2
} from 'lucide-react';

export function TrackingView({ cliente, onUpdate }: any) {
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<any>(null);
  const [testCode, setTestCode] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);

  const pixelId = cliente?.meta_pixel_id || '';
  const accessToken = cliente?.meta_access_token || '';

  const pixelBaseCode = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixelBaseCode);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleTestCAPI = async () => {
    if (!pixelId || !accessToken) return;
    setLoading(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/tracking/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: cliente.nome,
          eventName: 'PageView',
          testCode: testCode
        })
      });
      const data = await res.json();
      setTestStatus(data);
    } catch (err) {
      setTestStatus({ success: false, error: 'Falha na requisição' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* CONFIGURAÇÃO DE IDS */}
        <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500">
              <Settings2 size={20} />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">IDs de Rastreamento</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Meta Pixel / Dataset ID</label>
              <div className="relative">
                <input 
                  type="text" 
                  readOnly
                  value={pixelId || 'NÃO CONFIGURADO'} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono text-slate-300 outline-none"
                />
                <Target size={16} className="absolute right-4 top-4 text-slate-600" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Conversions API Token</label>
              <div className="relative">
                <input 
                  type="password" 
                  readOnly
                  value={accessToken ? '********************************' : 'NÃO CONFIGURADO'} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono text-slate-300 outline-none"
                />
                <ShieldCheck size={16} className="absolute right-4 top-4 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-500/10 flex gap-4">
            <Info className="text-blue-500 flex-shrink-0" size={20} />
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
              Estes IDs são configurados na aba "Gerenciar Empresas". Eles permitem que o KrM Ads envie eventos automaticamente para a Meta.
            </p>
          </div>
        </div>

        {/* TESTE DE CONEXÃO */}
        <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-500">
              <Zap size={20} />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">Validação CAPI</h3>
          </div>

          <p className="text-xs font-bold text-slate-400">
            Dispare um evento de teste server-side para verificar se a API de Conversões está ativa e recebendo dados corretamente.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Test Event Code (Opcional)</label>
              <input 
                type="text" 
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder="TEST12345"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono text-white outline-none focus:border-emerald-500 transition-all"
              />
              <p className="text-[8px] font-bold text-slate-600 mt-2 uppercase">Encontre este código na aba "Testar Eventos" do Gerenciador de Eventos da Meta.</p>
            </div>

            <button 
              onClick={handleTestCAPI}
              disabled={loading || !pixelId || !accessToken}
              className={`w-full p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20'
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Testar Conexão CAPI
            </button>

            {testStatus && (
              <div className={`p-4 rounded-2xl border ${testStatus.success ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-red-600/10 border-red-500/20'} animate-in zoom-in duration-300`}>
                <div className="flex items-center gap-3">
                  {testStatus.success ? <CheckCircle2 className="text-emerald-500" size={16} /> : <AlertCircle className="text-red-500" size={16} />}
                  <p className={`text-[10px] font-black uppercase ${testStatus.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testStatus.success ? 'Evento disparado com sucesso!' : `Erro: ${testStatus.error}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CÓDIGO DO PIXEL */}
      <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-500">
              <Code2 size={20} />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">Instalação no Site (Pixel Base)</h3>
          </div>
          <button 
            onClick={handleCopy}
            className="p-3 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            {copyStatus ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
            {copyStatus ? 'Copiado!' : 'Copiar Código'}
          </button>
        </div>

        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 overflow-x-auto">
          <pre className="text-xs font-mono text-blue-400 leading-relaxed">
            {pixelBaseCode}
          </pre>
        </div>

        {/* TRACKAMENTO DE BOTÃO (LEAD) */}
        <div className="mt-8 p-8 bg-blue-600/5 rounded-[2rem] border border-blue-500/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400">
              <Zap size={16} />
            </div>
            <h4 className="font-black text-sm uppercase tracking-tighter text-white">Trackamento do Botão "Garantir minha vaga"</h4>
          </div>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Para registrar o evento de <strong>Lead</strong> quando o cliente clicar no botão de conversão, adicione o atributo <code>onclick</code> à tag do botão no site:
          </p>
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-[11px] text-emerald-400">
            {`onclick="fbq('track', 'Lead');"`}
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-4 uppercase">
            Exemplo: &lt;button onclick="fbq('track', 'Lead');"&gt;Garantir minha vaga&lt;/button&gt;
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
              <Info size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-100 uppercase mb-1">Onde Instalar?</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
                Cole este código no cabeçalho (header) de todas as páginas do seu site, antes da tag de fechamento &lt;/head&gt;.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-100 uppercase mb-1">Verificação</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
                Use a extensão "Meta Pixel Helper" no Chrome para validar se o Pixel está disparando corretamente no site.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
