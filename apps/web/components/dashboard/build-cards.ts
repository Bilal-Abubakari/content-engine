import type { RepurposedContent, SocialPlatform } from '@org/shared';
import { Camera, Mail, MessagesSquare, Music2, Users } from 'lucide-react';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';
import type { ContentCardProps } from './content-card';

/**
 * Pure mapping from the shared {@link RepurposedContent} contract to the
 * ordered list of cards the results grid renders. Kept free of JSX so it can
 * be unit-tested in isolation.
 *
 * Only formats present in `content` produce a card: a generation returns just
 * the formats the user selected, so unselected ones are omitted entirely rather
 * than shown empty.
 */
export function buildPlatformCards(
  content: RepurposedContent,
): ContentCardProps[] {
  const cards: ContentCardProps[] = [];

  if (content.tweets) {
    cards.push({
      title: 'Tweets',
      field: 'tweets',
      icon: XIcon,
      accent: 'from-sky-500 to-blue-500',
      items: content.tweets,
    });
  }
  if (content.linkedIn) {
    cards.push({
      title: 'LinkedIn',
      field: 'linkedIn',
      icon: LinkedInIcon,
      accent: 'from-blue-600 to-indigo-600',
      text: content.linkedIn,
    });
  }
  if (content.facebook) {
    cards.push({
      title: 'Facebook',
      field: 'facebook',
      icon: Users,
      accent: 'from-blue-500 to-blue-700',
      text: content.facebook,
    });
  }
  if (content.instagram) {
    cards.push({
      title: 'Instagram',
      field: 'instagram',
      icon: Camera,
      accent: 'from-fuchsia-500 to-orange-500',
      text: content.instagram,
    });
  }
  if (content.tiktok) {
    cards.push({
      title: 'TikTok',
      field: 'tiktok',
      icon: Music2,
      accent: 'from-slate-200 to-slate-400',
      text: content.tiktok,
    });
  }
  if (content.threads) {
    cards.push({
      title: 'Thread',
      field: 'threads',
      icon: MessagesSquare,
      accent: 'from-fuchsia-500 to-purple-600',
      items: content.threads,
    });
  }
  if (content.newsletter) {
    cards.push({
      title: 'Newsletter',
      field: 'newsletter',
      icon: Mail,
      accent: 'from-amber-500 to-orange-500',
      text: content.newsletter,
    });
  }

  return cards;
}

/**
 * The single block of text ContentEngine would publish for a given platform,
 * or an empty string when that format wasn't generated. Multi-entry formats (X)
 * are joined into one payload, matching how the cards copy/publish today. Used
 * by the preview modal and the "Publish all" flow.
 */
export function platformContentText(
  content: RepurposedContent,
  platform: SocialPlatform,
): string {
  switch (platform) {
    case 'x':
      return content.tweets?.join('\n\n') ?? '';
    case 'linkedin':
      return content.linkedIn ?? '';
    case 'facebook':
      return content.facebook ?? '';
    case 'instagram':
      return content.instagram ?? '';
    case 'tiktok':
      return content.tiktok ?? '';
  }
}

/**
 * The card field a platform's media attachments are keyed by, so publishing and
 * the preview can find the assets a user attached to that platform's card.
 */
export function platformMediaField(
  platform: SocialPlatform,
): keyof RepurposedContent {
  switch (platform) {
    case 'x':
      return 'tweets';
    case 'linkedin':
      return 'linkedIn';
    case 'facebook':
      return 'facebook';
    case 'instagram':
      return 'instagram';
    case 'tiktok':
      return 'tiktok';
  }
}
