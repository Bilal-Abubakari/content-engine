import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Connections } from '@/components/dashboard/connections';
import { authOptions } from '@/lib/auth';

export default async function ConnectionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  return <Connections />;
}
