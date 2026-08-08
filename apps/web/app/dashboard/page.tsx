import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard/dashboard';
import { authOptions } from '@/lib/auth';
import { fetchUserSettings } from '@/lib/settings-server';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  const settings = await fetchUserSettings();
  // New users must complete (or skip) onboarding before using the dashboard.
  if (!settings.onboardedAt) {
    redirect('/onboarding');
  }

  return (
    <Dashboard
      userName={session.user.name ?? session.user.email ?? 'there'}
      settings={settings}
    />
  );
}
