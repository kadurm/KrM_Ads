import './globals.css';

export const metadata = {
  title: 'KrM Ads',
  description: 'Gestão de Ecossistema KrM Ads',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
