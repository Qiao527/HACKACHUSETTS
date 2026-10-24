import type { Metadata } from 'next';
import './globals.css';
import { SiteNav } from './components/SiteNav';
import { SiteFooter } from './components/SiteFooter';
import { ScenarioProvider } from './components/ScenarioProvider';
import { DocumentDrawer } from './components/DocumentDrawer';

export const metadata: Metadata = {
  title: 'SolarAlign',
  description:
    'Collect project evidence, compare roof and solar timing, and align value so more rooftop solar projects can move forward.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@350;400;460;480;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canvas">
        <ScenarioProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <SiteNav />
          <main id="main" className="min-h-[calc(100vh-72px-220px)]">
            {children}
          </main>
          <DocumentDrawer />
          <SiteFooter />
        </ScenarioProvider>
      </body>
    </html>
  );
}
