import type { RepurposedContent, SocialPlatform } from '@org/shared';
import { Camera, Mail, MessagesSquare, Music2, Users } from 'lucide-react';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';
import type { ContentCardProps } from './content-card';

/**
 * Pure mapping from the shared {@link RepurposedContent} contract to the
 * ordered list of cards the results grid renders. Kept free of JSX so it can
 * be unit-tested in isolation.
 */
export function buildPlatformCards(
  content: RepurposedContent,
): ContentCardProps[] {
  return [
    {
      title: 'Tweets',
      icon: XIcon,
      accent: 'from-sky-500 to-blue-500',
      items: content.tweets,
    },
    {
      title: 'LinkedIn',
      icon: LinkedInIcon,
      accent: 'from-blue-600 to-indigo-600',
      text: content.linkedIn,
    },
    {
      title: 'Facebook',
      icon: Users,
      accent: 'from-blue-500 to-blue-700',
      text: content.facebook,
    },
    {
      title: 'Instagram',
      icon: Camera,
      accent: 'from-fuchsia-500 to-orange-500',
      text: content.instagram,
      comingSoon: true,
    },
    {
      title: 'TikTok',
      icon: Music2,
      accent: 'from-slate-200 to-slate-400',
      text: content.tiktok,
      comingSoon: true,
    },
    {
      title: 'Thread',
      icon: MessagesSquare,
      accent: 'from-fuchsia-500 to-purple-600',
      items: content.threads,
    },
    {
      title: 'Newsletter',
      icon: Mail,
      accent: 'from-amber-500 to-orange-500',
      text: content.newsletter,
    },
  ];
}

/**
 * The single block of text ContentEngine would publish for a given platform.
 * Multi-entry formats (X) are joined into one payload, matching how the cards
 * copy/publish today. Used by the preview modal and the "Publish all" flow.
 */
export function platformContentText(
  content: RepurposedContent,
  platform: SocialPlatform,
): string {
  switch (platform) {
    case 'x':
      return content.tweets.join('\n\n');
    case 'linkedin':
      return content.linkedIn;
    case 'facebook':
      return content.facebook;
    case 'instagram':
      return content.instagram;
    case 'tiktok':
      return content.tiktok;
  }
}
