'use client';

import type { MediaItem } from '@org/shared';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CopyPlus,
  ImagePlus,
  Layers,
  Loader2,
  Play,
  X as CloseIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';

/** Small preview of a single asset — an image tile or a video with a play badge. */
function Thumb({ item }: { item: MediaItem }) {
  return item.kind === 'video' ? (
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
    <img src={item.url} alt="" className="h-full w-full object-cover" />
  );
}

/**
 * Per-card media manager shown in a card's view mode. Lets the user upload an
 * image/video (stored in a session pool by the parent), reuse an already
 * uploaded asset, apply one to every card at once, or remove it. The parent
 * owns the state; this component is a thin, controlled UI over it.
 */
export function MediaAttachments({
  media,
  pool,
  onUpload,
  onAttach,
  onDetach,
  onAttachToAll,
}: {
  /** Assets attached to this card. */
  media: MediaItem[];
  /** Every asset uploaded this session, for the reuse picker. */
  pool: MediaItem[];
  /** Upload a new file; `applyToAll` attaches it to every card. */
  onUpload: (file: File, applyToAll: boolean) => Promise<void>;
  onAttach: (id: string) => void;
  onDetach: (id: string) => void;
  onAttachToAll: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reuseOpen, setReuseOpen] = useState(false);

  const attachedIds = new Set(media.map((m) => m.id));
  const reusable = pool.filter((m) => !attachedIds.has(m.id));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      // Upload sequentially so a shared signature timestamp can't race.
      for (const file of Array.from(files)) {
        await onUpload(file, applyToAll);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">
          Media{' '}
          <span className="text-slate-600">
            · required for Instagram &amp; TikTok
          </span>
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="h-3 w-3 rounded border-white/20 bg-slate-900"
          />
          Apply uploads to all cards
        </label>
      </div>

      {media.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {media.map((item) => (
            <div
              key={item.id}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-slate-900"
            >
              <Thumb item={item} />
              <div className="absolute inset-0 flex items-start justify-between p-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onAttachToAll(item.id)}
                  title="Use on all cards"
                  aria-label="Use on all cards"
                  className="grid h-5 w-5 place-items-center rounded bg-slate-900/80 text-slate-200 transition hover:bg-slate-800"
                >
                  <CopyPlus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDetach(item.id)}
                  title="Remove"
                  aria-label="Remove media"
                  className="grid h-5 w-5 place-items-center rounded bg-slate-900/80 text-slate-200 transition hover:bg-red-500/80"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>

        {reusable.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setReuseOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
            >
              <Layers className="h-3.5 w-3.5" />
              Reuse
            </button>
            <AnimatePresence>
              {reuseOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 z-10 mt-1 w-44 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl"
                >
                  <p className="mb-1.5 px-1 text-[11px] text-slate-500">
                    Attach an uploaded asset
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {reusable.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onAttach(item.id);
                          setReuseOpen(false);
                        }}
                        className="relative h-12 w-12 overflow-hidden rounded-md border border-white/10 transition hover:border-brand-400/60"
                      >
                        <Thumb item={item} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => void handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
