'use client';

import {
  isSocialPlatform,
  PLATFORM_CATALOGUE,
  SOCIAL_PLATFORMS,
  type MediaItem,
  type PublishRequest,
  type RepurposeRequest,
  type RepurposeResponse,
  type SocialPlatform,
} from '@org/shared';
import {
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Play,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Sheet } from '@/components/mobile/sheet';
import { resolveSchedule, type ScheduleMode } from '@/lib/schedule';
import { uploadMedia } from '@/lib/upload-media';
import { useConnections } from '@/lib/use-connections';
import { platformContentText, platformFormat } from './build-cards';
import { composeProblems } from './compose-plan';
import { ScheduleControl } from './schedule-control';

/** Outcome of a single platform publish attempt, shown as an inline result. */
interface Result {
  platform: SocialPlatform;
  ok: boolean;
  message: string;
}

/**
 * The "New post" composer: write once, let AI rewrite it for each destination,
 * attach media, then publish immediately or schedule it.
 *
 * It deliberately spans the same three capabilities as the rest of the app
 * rather than being a bare text box — the draft is adapted through the same
 * `/api/repurpose` generator the dashboard uses, and sent through the same
 * `/api/social/publish` endpoint, so tone, duplicate-guarding and scheduling all
 * behave identically wherever a post originates.
 */
export function InboxCompose({ onClose }: { onClose: () => void }) {
  const { connections, ready } = useConnections();
  /** Null until the user picks for themselves; see `targets`. */
  const [selected, setSelected] = useState<SocialPlatform[] | null>(null);
  const [draft, setDraft] = useState('');
  /** Per-platform copy, once the draft has been adapted or hand-edited. */
  const [variants, setVariants] = useState<
    Partial<Record<SocialPlatform, string>>
  >({});
  const [tab, setTab] = useState<SocialPlatform | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [adaptError, setAdaptError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScheduleMode>('now');
  const [when, setWhen] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Only publishable platforms can be post targets — WhatsApp is inbox-only.
  const connected = useMemo(
    () => new Set(connections.map((c) => c.platform).filter(isSocialPlatform)),
    [connections],
  );

  // Preselect the first connected account so a quick update is one tap away.
  // Once the user picks for themselves `selected` takes over, including when
  // they deselect everything.
  const fallback = useMemo(() => {
    const first = SOCIAL_PLATFORMS.find((platform) => connected.has(platform));
    return first ? [first] : [];
  }, [connected]);
  const targets = selected ?? fallback;

  const textFor = (platform: SocialPlatform): string =>
    variants[platform] ?? draft;

  const adapted = Object.keys(variants).length > 0;
  // Keep the open tab valid as targets are added and removed.
  const activeTab = tab && targets.includes(tab) ? tab : (targets[0] ?? null);

  const texts = useMemo(() => {
    const map: Partial<Record<SocialPlatform, string>> = {};
    for (const platform of targets) {
      map[platform] = variants[platform] ?? draft;
    }
    return map;
  }, [draft, targets, variants]);

  const problems = composeProblems({ selected: targets, texts, media });
  const scheduling = mode === 'later';

  function toggle(platform: SocialPlatform) {
    setSelected((prev) => {
      const base = prev ?? fallback;
      return base.includes(platform)
        ? base.filter((p) => p !== platform)
        : [...base, platform];
    });
  }

  function editActive(value: string) {
    if (!adapted || !activeTab) {
      setDraft(value);
      return;
    }
    setVariants((prev) => ({ ...prev, [activeTab]: value }));
  }

  /** Rewrite the draft into a native-feeling post for each selected platform. */
  async function adapt() {
    const source = draft.trim();
    if (!source || targets.length === 0) {
      return;
    }
    setAdapting(true);
    setAdaptError(null);
    try {
      const body: RepurposeRequest = {
        source,
        formats: targets.map(platformFormat),
      };
      const res = await fetch('/api/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setAdaptError(data.message ?? 'Could not rewrite that just now.');
        return;
      }
      const data = (await res.json()) as RepurposeResponse;
      const next: Partial<Record<SocialPlatform, string>> = {};
      for (const platform of targets) {
        // A format the model skipped falls back to the original draft, so a
        // partial generation never silently blanks a destination.
        next[platform] = platformContentText(data.content, platform) || source;
      }
      setVariants(next);
      setTab(targets[0] ?? null);
    } catch {
      setAdaptError('Network error. Check your connection and try again.');
    } finally {
      setAdapting(false);
    }
  }

  async function attach(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      // Sequential so a shared signature timestamp can't race.
      for (const file of Array.from(files)) {
        const item = await uploadMedia(file);
        setMedia((prev) => [...prev, item]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  async function publish() {
    const schedule = resolveSchedule(mode, when);
    if (!schedule.ok) {
      setScheduleError(schedule.error);
      return;
    }
    setScheduleError(null);
    if (problems.length > 0) {
      return;
    }

    setSending(true);
    setResults([]);
    const outcomes: Result[] = [];
    for (const platform of targets) {
      try {
        const body: PublishRequest = {
          platform,
          content: textFor(platform).trim(),
          ...(media.length > 0
            ? { mediaUrls: media.map((item) => item.url) }
            : {}),
          ...(schedule.iso ? { scheduledFor: schedule.iso } : {}),
        };
        const res = await fetch('/api/social/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        outcomes.push({
          platform,
          ok: res.ok,
          message: res.ok
            ? schedule.iso
              ? 'Scheduled'
              : 'Published'
            : (data.message ?? 'Could not publish.'),
        });
      } catch {
        outcomes.push({ platform, ok: false, message: 'Network error.' });
      }
    }
    setResults(outcomes);
    setSending(false);
    if (outcomes.every((outcome) => outcome.ok)) {
      setDraft('');
      setVariants({});
      setMedia([]);
    }
  }

  const nothingConnected = ready && connected.size === 0;
  const editorValue = adapted && activeTab ? textFor(activeTab) : draft;

  return (
    <Sheet onClose={onClose} labelledBy="compose-title" className="sm:max-w-xl">
      <div className="flex shrink-0 items-center justify-between px-5 pb-2 sm:px-6 sm:pt-6">
        <h2 id="compose-title" className="text-lg font-semibold">
          New post
        </h2>
        <button
          onClick={onClose}
          className="tap -mr-2 grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="scroll-touch flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
        {nothingConnected ? (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-400">
              Connect a social account to publish from here.
            </p>
            <Link
              href="/dashboard/connections"
              className="tap mt-4 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Connect an account
            </Link>
          </div>
        ) : (
          <>
            {/* Every publishable platform is listed, connected or not, so the
                picker doubles as a map of what's still missing. */}
            <fieldset>
              <legend className="text-xs font-medium text-slate-400">
                Post to
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const meta = PLATFORM_CATALOGUE[platform];
                  const isConnected = connected.has(platform);
                  const active = targets.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => toggle(platform)}
                      disabled={!isConnected}
                      aria-pressed={active}
                      title={
                        isConnected
                          ? meta.name
                          : `${meta.name} isn't connected yet`
                      }
                      className={`tap min-h-10 rounded-full border px-3.5 text-xs font-semibold sm:min-h-9 ${
                        active
                          ? 'border-brand-400/50 bg-brand-500/20 text-brand-100'
                          : isConnected
                            ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                            : 'cursor-not-allowed border-dashed border-white/10 text-slate-600'
                      }`}
                    >
                      {meta.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Connected accounts power publishing, the inbox and repurposing.{' '}
                <Link
                  href="/dashboard/connections"
                  className="text-brand-300 underline-offset-2 hover:underline"
                >
                  Manage connections
                </Link>
              </p>
            </fieldset>

            {/* Once adapted, each destination gets its own editable copy. */}
            {adapted && targets.length > 1 && (
              <div
                role="tablist"
                aria-label="Per-platform copy"
                className="hide-scrollbar mt-4 -mx-1 flex gap-1 overflow-x-auto px-1"
              >
                {targets.map((platform) => (
                  <button
                    key={platform}
                    role="tab"
                    type="button"
                    aria-selected={platform === activeTab}
                    onClick={() => setTab(platform)}
                    className={`tap min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium ${
                      platform === activeTab
                        ? 'bg-white/10 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {PLATFORM_CATALOGUE[platform].name}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={editorValue}
              onChange={(event) => editActive(event.target.value)}
              rows={6}
              placeholder="Share an update across your channels…"
              aria-label={
                adapted && activeTab
                  ? `${PLATFORM_CATALOGUE[activeTab].name} post`
                  : 'Your post'
              }
              className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/50"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void adapt()}
                disabled={adapting || !draft.trim() || targets.length === 0}
                className="tap inline-flex min-h-10 items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 text-xs font-semibold text-brand-100 hover:bg-brand-500/20 disabled:opacity-40 sm:min-h-9"
              >
                {adapting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {adapted ? 'Rewrite again' : 'Rewrite for each platform'}
              </button>
              <span className="text-[11px] tabular-nums text-slate-500">
                {editorValue.trim().length} characters
              </span>
            </div>
            {adaptError && (
              <p className="mt-2 text-xs text-red-300">{adaptError}</p>
            )}

            <div className="mt-5 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  Media{' '}
                  <span className="text-slate-600">
                    · shared by every destination
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="tap inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50 sm:min-h-8"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {uploading ? 'Uploading…' : 'Add'}
                </button>
              </div>

              {media.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {media.map((item) => (
                    <div
                      key={item.id}
                      className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/10 bg-slate-900 sm:h-16 sm:w-16"
                    >
                      {item.kind === 'video' ? (
                        <>
                          <video
                            src={item.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20 text-white">
                            <Play className="h-4 w-4" />
                          </span>
                        </>
                      ) : (
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        aria-label="Remove media"
                        onClick={() =>
                          setMedia((prev) =>
                            prev.filter((asset) => asset.id !== item.id),
                          )
                        }
                        className="tap absolute right-1 top-1 grid h-7 w-7 place-items-center rounded bg-slate-900/80 text-slate-200 hover:bg-red-500/80 sm:h-5 sm:w-5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploadError && (
                <p className="mt-2 text-xs text-red-300">{uploadError}</p>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => void attach(event.target.files)}
                className="hidden"
              />
            </div>

            <div className="mt-4 border-t border-white/5 pt-4">
              <span className="text-xs font-medium text-slate-400">When</span>
              <div className="mt-2">
                <ScheduleControl
                  mode={mode}
                  value={when}
                  error={scheduleError}
                  onModeChange={(next) => {
                    setMode(next);
                    setScheduleError(null);
                  }}
                  onValueChange={(next) => {
                    setWhen(next);
                    setScheduleError(null);
                  }}
                />
              </div>
            </div>

            {results.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs">
                {results.map((result) => (
                  <li
                    key={result.platform}
                    className={result.ok ? 'text-emerald-300' : 'text-red-300'}
                  >
                    {PLATFORM_CATALOGUE[result.platform].name}:{' '}
                    {result.message}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {!nothingConnected && (
        // The primary action stays pinned so it's reachable without scrolling
        // past the media and schedule sections on a phone.
        <div className="shrink-0 border-t border-white/10 bg-slate-950/40 px-5 pb-[max(1.25rem,var(--safe-bottom))] pt-3 sm:px-6 sm:pb-5">
          {problems.length > 0 && (
            <ul className="mb-2 space-y-0.5 text-[11px] text-amber-300">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          <button
            onClick={() => void publish()}
            disabled={sending || problems.length > 0}
            className="tap inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50 sm:min-h-11"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : results.length > 0 && results.every((r) => r.ok) ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : scheduling ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {scheduling ? 'Schedule post' : 'Publish now'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
