'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <nav className="bg-primary-900 shadow-lg border-b border-primary-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24">
          <div className="flex items-center space-x-8">
            <Link href="/">
              <h1 className="text-2xl font-bold text-accent-50 hover:text-accent-100 transition-colors">
                CodeHive
              </h1>
            </Link>
          </div>

          <div className="flex items-center space-x-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-accent-600 text-accent-50'
                  : 'text-primary-300 hover:text-accent-50 hover:bg-primary-800'
              }`}
            >
              首頁
            </Link>
            <Link
              href="/projects"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/projects') || pathname?.startsWith('/projects')
                  ? 'bg-accent-600 text-accent-50'
                  : 'text-primary-300 hover:text-accent-50 hover:bg-primary-800'
              }`}
            >
              專案
            </Link>
            <Link
              href="/settings"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/settings')
                  ? 'bg-accent-600 text-accent-50'
                  : 'text-primary-300 hover:text-accent-50 hover:bg-primary-800'
              }`}
            >
              設定
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
