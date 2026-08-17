import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "You're offline — ContentEngine",
};

/**
 * The shell the service worker serves when a navigation fails with no network.
 * Static and dependency-light so it always renders from cache.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-slate-300">
          <WifiOff className="h-7 w-7" />
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">You're offline</h1>
        <p className="mt-2 text-slate-400">
          ContentEngine needs a connection to load new content. Check your
          network and try again — anything already open will keep working.
        </p>
      </div>
    </main>
  );
}
