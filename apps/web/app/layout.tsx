import './global.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/navbar';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ContentEngine — Turn one link into a week of content',
  description:
    'AI-powered content repurposing. Paste a link or text and get tweets, LinkedIn and Facebook posts, a newsletter, a thread, plus Instagram and TikTok drafts in seconds.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
