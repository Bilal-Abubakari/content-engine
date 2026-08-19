import type { ReactNode } from 'react';
import { AppShell } from '@/components/mobile/app-shell';

/**
 * Wraps every dashboard screen in the mobile app chrome (title bar + bottom tab
 * bar). Living in a layout means the chrome persists across navigations instead
 * of unmounting and re-animating on each one — the same continuity a native
 * tab navigator gives you.
 */
export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
