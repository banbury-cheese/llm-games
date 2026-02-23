import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';

import { Nav } from '@/components/layout/Nav';
import { PageTransition } from '@/components/layout/PageTransition';
import { ThemeProvider } from '@/lib/theme';

import '@/styles/globals.scss';

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Study Arcade',
  description: 'Upload content and practice with playful mini-games.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={interTight.variable}>
        <ThemeProvider>
          <div className="app-shell">
            <Nav />
            <PageTransition>
              <main className="page-shell">{children}</main>
            </PageTransition>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
