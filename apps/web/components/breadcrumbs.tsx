import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export interface Crumb {
  label: string;
  /** Omit on the current page — it renders as plain, non-clickable text. */
  href?: string;
}

/**
 * Simple navigation trail. The last crumb is treated as the current page and is
 * rendered as static text; every earlier crumb links to its `href`.
 *
 * Hidden on phones, where the app shell's title bar and bottom tabs already say
 * where you are and how to get back — a second trail would just be noise.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 hidden md:block">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="transition hover:text-white">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-slate-200">
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
