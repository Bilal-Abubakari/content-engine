import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings/settings-form';
import { authOptions } from '@/lib/auth';
import { fetchUserSettings } from '@/lib/settings-server';

/**
 * First-run setup. New users land here (the dashboard redirects while
 * `onboardedAt` is null); once they finish or skip, they're sent to the
 * dashboard and won't see this again.
 */
export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/');
  }

  const settings = await fetchUserSettings();
  if (settings.onboardedAt) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Let&apos;s set up your content
      </h1>
      <p className="mt-2 text-slate-400">
        Tell us how you want your content to sound and which formats to create.
        You can change any of this later in settings.
      </p>
      <div className="glass mt-8 p-6 sm:p-8">
        <SettingsForm initial={settings} mode="onboarding" />
      </div>
    </main>
  );
}
