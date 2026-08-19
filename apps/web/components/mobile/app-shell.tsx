'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/brand/logo-mark';
import { TabBar } from './tab-bar';

/**
 * Title shown in the mobile header for each dashboard screen. `parent` marks a
 * screen that was *pushed* rather than reached from the tab bar, so it gets a
 * back chevron the way a native stack navigator would.
 */
const SCREENS: Record<string, { title: string; parent?: string }> = {
  '/dashboard': { title: 'Create' },
  '/dashboard/inbox': { title: 'Inbox' },
  '/dashboard/scheduled': { title: 'Scheduled' },
  '/dashboard/history': { title: 'History' },
  '/dashboard/settings': { title: 'Settings' },
  '/dashboard/connections': { title: 'Connections', parent: '/dashboard' },
};

/**
 * The phone chrome for every dashboard screen: a sticky title bar at the top
 * and the tab bar at the bottom, with the page scrolling between them. Both are
 * hidden from `md` up, where the marketing navbar and in-page navigation are
 * the better fit for a pointer and a wide viewport.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const screen = SCREENS[pathname];

  return (
    <>
      <header className="app-bar pt-safe sticky top-0 z-30 border-b md:hidden">
        {/* Height must stay in step with --app-header-h in global.css. */}
        <div className="flex h-[3.25rem] items-center gap-2 px-2">
          {screen?.parent ? (
            <Link
              href={screen.parent}
              aria-label="Back"
              className="tap -ml-1 grid h-11 w-11 place-items-center rounded-full text-slate-300"
            >
              <ChevronLeft className="h-6 w-6" />
            </Link>
          ) : (
            <span className="grid h-11 w-11 place-items-center">
              <LogoMark className="h-8 w-8" />
            </span>
          )}
          <h1 className="truncate text-base font-semibold tracking-tight">
            {screen?.title ?? 'ContentEngine'}
          </h1>
        </div>
      </header>

      {/* Reserve room for the tab bar so the last row of content is never
          trapped underneath it. */}
      <div className="pb-tab-bar md:pb-0">{children}</div>

      <TabBar />
    </>
  );
}
