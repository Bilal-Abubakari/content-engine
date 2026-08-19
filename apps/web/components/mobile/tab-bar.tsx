'use client';

import { motion } from 'framer-motion';
import {
  CalendarClock,
  Clock,
  Inbox as InboxIcon,
  Settings,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUnreadCount } from '@/lib/use-unread-count';

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show the live unread count on this tab. */
  badge?: boolean;
}

/**
 * Five destinations is the practical ceiling for a thumb-reachable tab bar, so
 * these are the screens a user returns to; one-off surfaces like Connections
 * are pushed from within a tab and get a back button instead.
 */
const TABS: Tab[] = [
  { href: '/dashboard', label: 'Create', icon: Wand2 },
  { href: '/dashboard/inbox', label: 'Inbox', icon: InboxIcon, badge: true },
  { href: '/dashboard/scheduled', label: 'Scheduled', icon: CalendarClock },
  { href: '/dashboard/history', label: 'History', icon: Clock },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

/**
 * The primary navigation on phones: a bottom tab bar, the pattern every native
 * app uses. It replaces the desktop link row (which sits above the fold and is
 * unreachable one-handed) and is hidden from `md` up, where the header and
 * in-page navigation take over.
 *
 * It sits on the bottom edge as the last row of the {@link AppShell} frame
 * rather than by `position: fixed`, which an installed iOS app resolves against
 * the document and therefore drags up the screen on short pages.
 */
export function TabBar() {
  const pathname = usePathname();
  const unread = useUnreadCount();

  // The active tab is the longest matching prefix, so a pushed screen such as
  // /dashboard/connections still highlights the tab it was opened from.
  const activeHref = TABS.map((tab) => tab.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      aria-label="Primary"
      className="app-bar pb-safe z-40 shrink-0 border-t md:hidden"
    >
      <ul className="flex items-stretch">
        {TABS.map(({ href, label, icon: Icon, badge }) => {
          const active = href === activeHref;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`tap relative flex h-[var(--tab-bar-h)] flex-col items-center justify-center gap-1 ${
                  active ? 'text-brand-300' : 'text-slate-500'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-bar-indicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand-400"
                  />
                )}
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {badge && unread > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
