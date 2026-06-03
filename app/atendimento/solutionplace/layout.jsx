export const metadata = {
  title: 'CRM - Solution Place',
  description: 'Painel operacional de gestão de leads e relacionamento da Solution Place. Acesso restrito.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'CRM - Solution Place',
    description: 'Painel operacional de gestão de leads e relacionamento da Solution Place. Acesso restrito.',
    url: 'https://ads.krmcorp.com.br/atendimento/solutionplace',
    siteName: 'Solution Place CRM',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://ads.krmcorp.com.br/solutionplace_logo.jpeg',
        width: 800,
        height: 800,
        alt: 'Solution Place Logo',
      }
    ]
  }
};

export default function SolutionPlaceLayout({ children }) {
  return <>{children}</>;
}
