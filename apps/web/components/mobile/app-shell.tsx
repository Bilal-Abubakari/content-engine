'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogoMark } from '@/components/brand/logo-mark';
import { TabBar } from './tab-bar';

/**
 * How far the user has to travel in one direction before the tab bar reacts.
 * Small enough to feel immediate, large enough that a thumb resting on a
 * momentum scroll doesn't flap the bar in and out.
 */
const SCROLL_THRESHOLD_PX = 10;

/**
 * The bar always stays put within this much of the top, so the first flick on a
 * screen never hides it — at that point the user is still orienting, not reading.
 */
const ALWAYS_SHOWN_PX = 64;

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
 * The phone chrome for every dashboard screen: a title bar at the top and the
 * tab bar at the bottom, with the page scrolling between them. Both are hidden
 * from `md` up, where the marketing navbar and in-page navigation are the
 * better fit for a pointer and a wide viewport.
 *
 * On phones the three parts form a fixed-height frame (see `.app-frame`) and
 * only the middle scrolls, exactly like a native tab navigator. That is also
 * what keeps the chrome on the screen edges: pinning it with `position: fixed`
 * is unreliable in an installed iOS app, where a page too short to scroll left
 * the bar floating in the middle of the screen. From `md` up the frame
 * dissolves and the document scrolls normally again.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const screen = SCREENS[pathname];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabBarHidden, setTabBarHidden] = useState(false);

  useEffect(() => {
    const region = scrollRef.current;
    if (!region) {
      return;
    }

    let lastTop = region.scrollTop;

    const onScroll = () => {
      // Clamped because iOS reports negative offsets while rubber-banding.
      const top = Math.max(region.scrollTop, 0);
      const delta = top - lastTop;
      if (Math.abs(delta) < SCROLL_THRESHOLD_PX) {
        return;
      }
      lastTop = top;
      setTabBarHidden(delta > 0 && top > ALWAYS_SHOWN_PX);
    };

    region.addEventListener('scroll', onScroll, { passive: true });
    return () => region.removeEventListener('scroll', onScroll);
  }, []);

  // A new screen starts at the top, so it starts with its navigation showing.
  useEffect(() => setTabBarHidden(false), [pathname]);

  return (
    <div className="app-frame relative flex flex-col overflow-hidden md:block md:h-auto md:overflow-visible">
      <header className="app-bar pt-safe z-30 shrink-0 border-b md:hidden">
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

      {/* The only scrolling region on a phone; on desktop it goes back to being
          a plain block so the document scrolls as usual. It runs the full height
          of the frame with the tab bar floating over its last rows, so that when
          the bar slides away it uncovers content rather than a gap — hence the
          matching bottom padding, which keeps the final row reachable. */}
      <div
        ref={scrollRef}
        className="scroll-touch min-h-0 flex-1 overflow-y-auto pb-[calc(var(--tab-bar-h)+var(--safe-bottom))] md:overflow-visible md:pb-0"
      >
        {children}
      </div>

      <TabBar hidden={tabBarHidden} />
    </div>
  );
}
