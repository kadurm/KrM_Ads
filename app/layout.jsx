import './globals.css';

export const metadata = {
  title: {
    default: 'KrM Ads | Inteligência em Meta Ads 2026',
    template: '%s | KrM Ads'
  },
  description: 'Sistema avançado de gestão de tráfego pago com motor Andromeda e proteção GEM AI. Foco em ROI e escala real.',
  keywords: ['Meta Ads', 'Tráfego Pago', 'ROI', 'Andromeda IA', 'Gestão de Anúncios'],
  authors: [{ name: 'KrM Dev Team' }],
  creator: 'KrM Ads',
  publisher: 'KrM Ads',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'KrM Ads | Inteligência em Meta Ads',
    description: 'Performance de elite com tecnologia preditiva Andromeda.',
    url: 'https://krmads.com.br',
    siteName: 'KrM Ads',
    locale: 'pt_BR',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
