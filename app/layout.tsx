import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from './contexts/ThemeContext';
import ToastManager from './components/ui/ToastManager';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'CodeHive',
  description: 'Multi-agent software development platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <ToastManager>
            {children}
          </ToastManager>
        </ThemeProvider>
      </body>
    </html>
  );
}
