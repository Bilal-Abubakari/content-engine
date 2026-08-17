import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Inbox } from '@/components/dashboard/inbox';
import { authOptions } from '@/lib/auth';

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  return <Inbox />;
}
