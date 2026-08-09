'use client';

import {
  PLATFORM_CATALOGUE,
  SOCIAL_PLATFORMS,
  type MediaItem,
  type RepurposedContent,
  type SocialPlatform,
} from '@org/shared';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  Camera,
  Globe,
  Heart,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
  Users,
  X as CloseIcon,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useEffect } from 'react';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';

type Glyph = ComponentType<SVGProps<SVGSVGElement>> | LucideIcon;

const PLATFORM_ICON: Record<SocialPlatform, Glyph> = {
  linkedin: LinkedInIcon,
  x: XIcon,
  facebook: Users,
  instagram: Camera,
  tiktok: Music2,
};

interface Persona {
  name: string;
  handle: string;
  initials: string;
}

function toPersona(userName: string): Persona {
  const trimmed = userName.trim() || 'Your Name';
  const initials =
    trimmed
      .split(/\s+/)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'YN';
  const handle =
    trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 15) || 'you';
  return { name: trimmed, handle: `@${handle}`, initials };
}

export function PreviewModal({
  content,
  userName,
  active,
  media,
  onSelect,
  onClose,
}: {
  content: RepurposedContent;
  userName: string;
  active: SocialPlatform;
  /** Assets attached to each platform's card, rendered in the mockups. */
  media: Partial<Record<SocialPlatform, MediaItem[]>>;
  onSelect: (platform: SocialPlatform) => void;
  onClose: () => void;
}) {
  const persona = toPersona(userName);
  const activeMedia = media[active] ?? [];

  // Close on Escape and lock body scroll while the modal is open.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
        className="glass flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden p-0"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Post preview
            </h2>
            <p className="text-xs text-slate-500">
              How your content will look before you publish.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {SOCIAL_PLATFORMS.map((platform) => {
            const Icon = PLATFORM_ICON[platform];
            const selected = platform === active;
            return (
              <button
                key={platform}
                onClick={() => onSelect(platform)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {PLATFORM_CATALOGUE[platform].name}
                {PLATFORM_CATALOGUE[platform].comingSoon && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 text-[9px] font-semibold uppercase text-amber-300">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="scroll-slim overflow-y-auto bg-slate-950/40 p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {PLATFORM_CATALOGUE[active].comingSoon && (
                <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Direct publishing to {PLATFORM_CATALOGUE[active].name} is coming
                  soon — it needs image/video generation. This is a caption
                  preview.
                </p>
              )}
              <PlatformPreview
                platform={active}
                content={content}
                persona={persona}
                media={activeMedia}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PlatformPreview({
  platform,
  content,
  persona,
  media,
}: {
  platform: SocialPlatform;
  content: RepurposedContent;
  persona: Persona;
  media: MediaItem[];
}) {
  switch (platform) {
    case 'x':
      return content.tweets ? (
        <XPreview tweets={content.tweets} persona={persona} media={media} />
      ) : (
        <NotGenerated />
      );
    case 'linkedin':
      return content.linkedIn ? (
        <LinkedInPreview
          text={content.linkedIn}
          persona={persona}
          media={media}
        />
      ) : (
        <NotGenerated />
      );
    case 'facebook':
      return content.facebook ? (
        <FacebookPreview
          text={content.facebook}
          persona={persona}
          media={media}
        />
      ) : (
        <NotGenerated />
      );
    case 'instagram':
      return content.instagram ? (
        <InstagramPreview
          caption={content.instagram}
          persona={persona}
          media={media}
        />
      ) : (
        <NotGenerated />
      );
    case 'tiktok':
      return content.tiktok ? (
        <TikTokPreview script={content.tiktok} persona={persona} media={media} />
      ) : (
        <NotGenerated />
      );
  }
}

/** Renders the first attached asset as a feed image/video, or nothing. */
function MediaShowcase({
  media,
  className = '',
}: {
  media: MediaItem[];
  className?: string;
}) {
  const first = media[0];
  if (!first) {
    return null;
  }
  return first.kind === 'video' ? (
    <video
      src={first.url}
      controls
      playsInline
      className={`w-full rounded-lg bg-black object-cover ${className}`}
    />
  ) : (
    <img
      src={first.url}
      alt=""
      className={`w-full rounded-lg object-cover ${className}`}
    />
  );
}

/** Shown when the selected platform's format wasn't part of this generation. */
function NotGenerated() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
      This format wasn&apos;t generated for this run. Enable it in your settings
      or the generate form to include it next time.
    </div>
  );
}

function Avatar({
  initials,
  className = '',
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-xs font-bold text-white ${className}`}
    >
      {initials}
    </span>
  );
}

/** A light "post card" surface that mimics the real (light-themed) feeds. */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
      {children}
    </div>
  );
}

function XPreview({
  tweets,
  persona,
  media,
}: {
  tweets: string[];
  persona: Persona;
  media: MediaItem[];
}) {
  return (
    <Surface>
      {tweets.map((tweet, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Avatar initials={persona.initials} className="h-10 w-10" />
            {index < tweets.length - 1 && (
              <span className="my-1 w-px flex-1 bg-slate-200" />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold">{persona.name}</span>
              <span className="text-slate-500">{persona.handle} · now</span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-snug">
              {tweet}
            </p>
            {index === 0 && <MediaShowcase media={media} className="mt-2" />}
            <div className="mt-2 flex max-w-xs items-center justify-between text-slate-500">
              <MessageCircle className="h-4 w-4" />
              <Repeat2 className="h-4 w-4" />
              <Heart className="h-4 w-4" />
              <Bookmark className="h-4 w-4" />
              <Share2 className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </Surface>
  );
}

function LinkedInPreview({
  text,
  persona,
  media,
}: {
  text: string;
  persona: Persona;
  media: MediaItem[];
}) {
  return (
    <Surface>
      <div className="flex items-center gap-2">
        <Avatar initials={persona.initials} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{persona.name}</p>
          <p className="truncate text-xs text-slate-500">
            Creator · Content strategist
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            now · <Globe className="h-3 w-3" />
          </p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      <MediaShowcase media={media} className="mt-3" />
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="h-4 w-4" /> Like
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5">
          <Repeat2 className="h-4 w-4" /> Repost
        </span>
        <span className="flex items-center gap-1.5">
          <Send className="h-4 w-4" /> Send
        </span>
      </div>
    </Surface>
  );
}

function FacebookPreview({
  text,
  persona,
  media,
}: {
  text: string;
  persona: Persona;
  media: MediaItem[];
}) {
  return (
    <Surface>
      <div className="flex items-center gap-2">
        <Avatar initials={persona.initials} className="h-10 w-10" />
        <div>
          <p className="text-sm font-semibold">{persona.name}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            now · <Globe className="h-3 w-3" />
          </p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      <MediaShowcase media={media} className="mt-3" />
      <div className="mt-3 flex items-center justify-around border-t border-slate-200 pt-2 text-sm font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="h-4 w-4" /> Like
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5">
          <Share2 className="h-4 w-4" /> Share
        </span>
      </div>
    </Surface>
  );
}

function InstagramPreview({
  caption,
  persona,
  media,
}: {
  caption: string;
  persona: Persona;
  media: MediaItem[];
}) {
  const first = media[0];
  return (
    <Surface>
      <div className="flex items-center gap-2">
        <Avatar initials={persona.initials} className="h-8 w-8" />
        <p className="flex-1 text-sm font-semibold">{persona.handle.slice(1)}</p>
        <MoreHorizontal className="h-5 w-5 text-slate-500" />
      </div>
      {first ? (
        first.kind === 'video' ? (
          <video
            src={first.url}
            controls
            playsInline
            className="mt-3 aspect-square w-full rounded-lg bg-black object-cover"
          />
        ) : (
          <img
            src={first.url}
            alt=""
            className="mt-3 aspect-square w-full rounded-lg object-cover"
          />
        )
      ) : (
        <div className="mt-3 grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-fuchsia-100 to-orange-100 text-fuchsia-500">
          <span className="flex flex-col items-center gap-1 text-xs font-medium">
            <ImagePlus className="h-8 w-8" />
            Add a photo or video
          </span>
        </div>
      )}
      <div className="mt-3 flex items-center gap-4 text-slate-800">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="ml-auto h-5 w-5" />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        <span className="font-semibold">{persona.handle.slice(1)}</span>{' '}
        {caption}
      </p>
    </Surface>
  );
}

function TikTokPreview({
  script,
  persona,
  media,
}: {
  script: string;
  persona: Persona;
  media: MediaItem[];
}) {
  const video = media.find((item) => item.kind === 'video');
  const image = media.find((item) => item.kind === 'image');
  return (
    <div className="mx-auto flex max-w-[260px] flex-col overflow-hidden rounded-2xl bg-black text-white shadow-2xl">
      <div className="relative aspect-[9/16] bg-gradient-to-b from-slate-800 to-black">
        {video ? (
          <video
            src={video.url}
            controls
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : image ? (
          <img
            src={image.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-500">
            <Play className="h-12 w-12" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-12">
          <p className="text-sm font-semibold">{persona.handle}</p>
          <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-xs leading-snug text-slate-100">
            {script}
          </p>
        </div>
        <div className="absolute bottom-3 right-2 flex flex-col items-center gap-4 text-white">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Share2 className="h-6 w-6" />
          <Music2 className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
