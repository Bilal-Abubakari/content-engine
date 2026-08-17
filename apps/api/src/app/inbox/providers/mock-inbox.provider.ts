import {
  INBOX_PLATFORM_CATALOGUE,
  type InboxChannel,
  type InboxPlatform,
} from '@org/shared';
import { randomUUID } from 'node:crypto';
import type {
  InboxFetchContext,
  InboxFetchResult,
  InboxProvider,
  InboxReplyContext,
  InboxReplyResult,
  NormalizedConversation,
} from './inbox-provider';

/** Sentinel cursor set after the first pull so a demo inbox seeds exactly once. */
const SEEDED_CURSOR = 'mock-seeded';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A seed thread template, resolved against a platform's real capabilities. */
interface SeedTemplate {
  channel: InboxChannel;
  participant: { name: string; avatar: string };
  /** Oldest-to-newest inbound lines from the audience. */
  lines: string[];
  /** How long ago the most recent line landed. */
  ageMs: number;
}

/** Deterministic avatar so the UI shows a face without any external calls. */
function avatar(seed: string): string {
  return `https://i.pravatar.cc/128?u=${encodeURIComponent(seed)}`;
}

/**
 * A believable customer-engagement backlog. Each template is only used for a
 * platform when its {@link INBOX_PLATFORM_CATALOGUE} capabilities allow that channel,
 * so the mock never fabricates activity a real API couldn't surface (e.g. DMs
 * on X's free tier, or any channel on LinkedIn).
 */
const SEED_TEMPLATES: readonly SeedTemplate[] = [
  {
    channel: 'comment',
    participant: { name: 'Amara Okafor', avatar: 'amara' },
    lines: [
      'This thread is exactly what my team needed — do you have a version for enterprise plans?',
    ],
    ageMs: 12 * MINUTE,
  },
  {
    channel: 'message',
    participant: { name: 'Daniel Reyes', avatar: 'daniel' },
    lines: [
      'Hi! Is the launch discount still active?',
      'And does it apply to annual billing too?',
    ],
    ageMs: 35 * MINUTE,
  },
  {
    channel: 'mention',
    participant: { name: 'Priya Nair', avatar: 'priya' },
    lines: [
      'Just shipped our newsletter using this workflow — massive time saver. Highly recommend @yourbrand 🙌',
    ],
    ageMs: 2 * HOUR,
  },
  {
    channel: 'comment',
    participant: { name: 'Tomás Silva', avatar: 'tomas' },
    lines: ['Does this integrate with our existing scheduler, or is it standalone?'],
    ageMs: 5 * HOUR,
  },
  {
    channel: 'message',
    participant: { name: 'Grace Bennett', avatar: 'grace' },
    lines: [
      'Loved the demo. One question — how do you handle multiple brand voices on one account?',
    ],
    ageMs: 26 * HOUR,
  },
  {
    channel: 'review',
    participant: { name: 'Kwame Mensah', avatar: 'kwame' },
    lines: ['Five stars. Support replied within minutes and solved my issue. ⭐⭐⭐⭐⭐'],
    ageMs: 3 * HOUR,
  },
];

/**
 * A dependency-free inbox provider that seeds a realistic, platform-aware set of
 * conversations so the entire unified-inbox experience is demoable end-to-end
 * with zero API approvals. Every real integration implements the same
 * {@link InboxProvider} contract, so swapping this out is a one-line registry
 * change. Seeding is deterministic per pull: the first fetch returns the seed
 * set and a sentinel cursor; every later fetch returns nothing, so the sync
 * poller stays idempotent and tests are stable.
 */
export class MockInboxProvider implements InboxProvider {
  constructor(readonly platform: InboxPlatform) {}

  async fetch(context: InboxFetchContext): Promise<InboxFetchResult> {
    // Already seeded — a real provider would page forward from the cursor; the
    // mock simply has nothing new, keeping repeated syncs a no-op.
    if (context.cursor) {
      return { conversations: [], nextCursor: context.cursor };
    }

    const caps = INBOX_PLATFORM_CATALOGUE[this.platform].inbox;
    const allows = (channel: InboxChannel): boolean => {
      switch (channel) {
        case 'message':
          return caps.messages;
        case 'comment':
          return caps.comments;
        // Reviews are a Facebook Page concept; don't fabricate them elsewhere.
        case 'review':
          return this.platform === 'facebook' && caps.comments;
        case 'mention':
          return caps.mentions;
        default:
          return false;
      }
    };

    const now = Date.now();
    const conversations = SEED_TEMPLATES.filter(
      (t) => t.channel === context.channel && allows(t.channel),
    ).map(
      (template, index): NormalizedConversation => {
        const base = `mock-${this.platform}-${template.channel}-${index}`;
        const newestAt = now - template.ageMs;
        return {
          externalId: `${base}-thread`,
          channel: template.channel,
          accountName: null,
          participant: {
            externalId: `${base}-user`,
            name: template.participant.name,
            avatarUrl: avatar(template.participant.avatar),
          },
          items: template.lines.map((text, lineIndex) => {
            // Space earlier lines a couple of minutes before the newest one.
            const offset = (template.lines.length - 1 - lineIndex) * 2 * MINUTE;
            return {
              externalId: `${base}-item-${lineIndex}`,
              channel: template.channel,
              direction: 'inbound' as const,
              text,
              author: {
                externalId: `${base}-user`,
                name: template.participant.name,
                avatarUrl: avatar(template.participant.avatar),
              },
              permalink: null,
              createdAt: new Date(newestAt - offset),
            };
          }),
        };
      },
    );

    return { conversations, nextCursor: SEEDED_CURSOR };
  }

  async reply(context: InboxReplyContext): Promise<InboxReplyResult> {
    // Simulate the platform accepting the reply and echoing back an id.
    const id = randomUUID();
    return {
      externalId: `mock-${this.platform}-reply-${id}`,
      permalink: `https://mock.contentengine.dev/${this.platform}/${context.conversationExternalId}/${id}`,
      createdAt: new Date(),
    };
  }
}
