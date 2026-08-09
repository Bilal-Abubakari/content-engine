import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
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
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-12">
      <Breadcrumbs
        items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
      <p className="mt-2 text-slate-400">
        Your defaults for every generation. You can still override formats and
        tone per run from the dashboard.
      </p>
      <div className="glass mt-8 p-6 sm:p-8">
        <SettingsForm initial={settings} mode="settings" />
      </div>
    </main>
  );
}
