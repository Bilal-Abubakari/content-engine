import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { AccountCard } from '@/components/settings/account-card';
import { SettingsForm } from '@/components/settings/settings-form';
import { authOptions } from '@/lib/auth';
import { fetchUserSettings } from '@/lib/settings-server';

/** The settings editor: change tone, formats, audience, and more anytime. */
export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/');
  }

  const settings = await fetchUserSettings();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-5 sm:px-6 sm:pb-24 sm:pt-12">
      <Breadcrumbs
        items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
      />
      {/* The mobile app bar already titles this screen. */}
      <h1 className="hidden text-3xl font-bold tracking-tight md:block lg:text-4xl">
        Settings
      </h1>
      <p className="text-sm text-slate-400 md:mt-2 md:text-base">
        Your defaults for every generation. You can still override formats and
        tone per run from the dashboard.
      </p>
      <div className="glass mt-6 p-4 sm:mt-8 sm:p-8">
        <SettingsForm initial={settings} mode="settings" />
      </div>
      <AccountCard
        name={session.user.name ?? null}
        email={session.user.email ?? null}
      />
    </main>
  );
}
