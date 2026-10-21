import './globals.css';
import AuthShell from '@/components/AuthShell';

export const metadata = { title: 'Minhas vendas', description: 'Gestão de vendas, clientes e fornecedores' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
