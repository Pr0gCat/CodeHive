import { Inter } from 'next/font/google';
import ToastManager from '@/components/ui/ToastManager';
import { ThemeProvider } from './contexts/ThemeContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'CodeHive',
  description: 'Multi-agent software development platform',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full`}>
        <ThemeProvider>
          <ToastManager>{children}</ToastManager>
        </ThemeProvider>
      </body>
    </html>
  );
}
