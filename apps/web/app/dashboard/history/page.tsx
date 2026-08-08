import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { HistoryView } from '@/components/dashboard/history-view';
import { authOptions } from '@/lib/auth';

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  return <HistoryView />;
}
