import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard/dashboard';
import { authOptions } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  return (
    <Dashboard userName={session.user.name ?? session.user.email ?? 'there'} />
  );
}
