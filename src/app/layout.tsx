import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';

import { Nav } from '@/components/layout/Nav';
import { PageTransition } from '@/components/layout/PageTransition';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { ChatTutorProvider } from '@/lib/chat-tutor';
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
      {/* figma-capture-script */}
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" />
      </head>
      <body className={interTight.variable}>
        <ThemeProvider>
          <AnalyticsProvider>
            <ChatTutorProvider>
              <div className="app-shell">
                <Nav />
                <div className="flex-1">
                  <PageTransition>
                    <main className="page-shell">{children}</main>
                  </PageTransition>
                </div>
                <footer className="pb-2 pt-1 text-center text-xs text-[var(--text-muted)]">
                  Built by{' '}
                  <a
                    href="https://itskay.co/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline decoration-current/40 underline-offset-2 transition hover:text-[var(--text)]"
                  >
                    itskay.co
                  </a>
                </footer>
              </div>
            </ChatTutorProvider>
            <ConsentBanner />
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
