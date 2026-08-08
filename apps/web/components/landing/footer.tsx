import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';

interface FooterLink {
  label: string;
  href: string;
}

const LINK_COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/#features' },
      { label: 'Blog', href: '/#how-it-works' },
      { label: 'Careers', href: '/#features' },
      { label: 'Contact', href: 'mailto:hello@contentengine.app' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/#faq' },
      { label: 'Terms', href: '/#faq' },
      { label: 'Security', href: '/#faq' },
    ],
  },
];

const SOCIALS: { label: string; href: string; Icon: typeof XIcon }[] = [
  { label: 'ContentEngine on X', href: 'https://x.com', Icon: XIcon },
  {
    label: 'ContentEngine on LinkedIn',
    href: 'https://linkedin.com',
    Icon: LinkedInIcon,
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-lg shadow-brand-500/30">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <span className="text-lg tracking-tight">ContentEngine</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Turn one link or a rough draft into a week of platform-ready
              content — tweets, threads, LinkedIn posts, a newsletter, and more.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {LINK_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="text-sm font-semibold text-slate-200">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-sm text-slate-500 sm:flex-row">
          <p>© {year} ContentEngine. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  );
}
