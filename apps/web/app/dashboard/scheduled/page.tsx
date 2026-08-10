import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ScheduledPosts } from '@/components/dashboard/scheduled-posts';
import { authOptions } from '@/lib/auth';

export default async function ScheduledPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  return <ScheduledPosts />;
}
