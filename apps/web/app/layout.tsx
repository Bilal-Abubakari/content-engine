import './global.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { SplashScreen } from '@/components/pwa/splash-screen';
import { Navbar } from '@/components/navbar';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  applicationName: 'ContentEngine',
  title: 'ContentEngine — Turn one link into a week of content',
  description:
    'AI-powered content repurposing. Paste a link or text and get tweets, LinkedIn and Facebook posts, a newsletter, a thread, plus Instagram and TikTok drafts in seconds.',
  // Marks the app as installable and controls the iOS standalone experience.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ContentEngine',
  },
  icons: {
    apple: '/icons/apple-icon-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  // Let the app paint edge-to-edge under the notch and home indicator; the
  // `*-safe` utilities in global.css pad the chrome back out of their way.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <SplashScreen />
        <Providers>
          <Navbar />
          {children}
          <InstallPrompt />
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
