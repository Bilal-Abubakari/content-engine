import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard/dashboard';
import { authOptions } from '@/lib/auth';
import { fetchHistoryItem } from '@/lib/repurpose-server';
import { fetchUserSettings } from '@/lib/settings-server';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  const settings = await fetchUserSettings();
  // New users must complete (or skip) onboarding before using the dashboard.
  if (!settings.onboardedAt) {
    redirect('/onboarding');
  }

  // `?c=<id>` deep-links a saved generation so it survives a refresh and can be
  // shared. Unknown/unowned ids resolve to null and just show the empty form.
  const { c } = await searchParams;
  const saved = c ? await fetchHistoryItem(c) : null;

  return (
    <Dashboard
      userName={session.user.name ?? session.user.email ?? 'there'}
      settings={settings}
      initialContent={saved?.content ?? null}
      initialContentId={saved?.id ?? null}
    />
  );
}
