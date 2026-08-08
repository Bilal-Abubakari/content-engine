import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface LegalSection {
  heading: string;
  body: string;
}

interface LegalPageProps {
  title: string;
  sections: LegalSection[];
}

/**
 * Shared shell for the static legal pages (Privacy, Terms). Server component:
 * plain content, no interactivity. The section copy is a starting template —
 * replace it with your finalised, counsel-reviewed policy before relying on it.
 */
export function LegalPage({ title, sections }: LegalPageProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </Link>

      <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">
        {title}
      </h1>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold text-white">
              {section.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
