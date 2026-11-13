import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/client/session';
import { UiProvider } from '@/lib/client/ui';

export const metadata: Metadata = {
  title: 'Plumtree Connect · Jobs & Service Providers in Plumtree, Matabeleland South',
  description: 'Find jobs and trusted local service providers in Plumtree and Matabeleland South. Post vacancies, hire artisans and book services near you.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌳</text></svg>",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <UiProvider>{children}</UiProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
