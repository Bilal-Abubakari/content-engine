import {
  inboxChannelsFor,
  type InboxChannel,
  type InboxItemDirection,
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
const DAY = 24 * HOUR;

/** One turn in a seeded thread. */
interface SeedLine {
  text: string;
  direction: InboxItemDirection;
}

/** A seed thread template, resolved against a platform's real capabilities. */
interface SeedTemplate {
  channel: InboxChannel;
  participant: { name: string; avatar: string };
  /** Oldest-to-newest turns in the thread. */
  lines: SeedLine[];
  /** How long ago the most recent line landed. */
  ageMs: number;
}

/** A line from the audience. */
function them(text: string): SeedLine {
  return { text, direction: 'inbound' };
}

/** A line the brand already sent — seeds threads that arrive already replied. */
function us(text: string): SeedLine {
  return { text, direction: 'outbound' };
}

/** Deterministic avatar so the UI shows a face without any external calls. */
function avatar(seed: string): string {
  return `https://i.pravatar.cc/128?u=${encodeURIComponent(seed)}`;
}

/**
 * A believable customer-engagement backlog, deliberately large so every inbox
 * filter (channel, platform, status, unread-only) and the date grouping have
 * real data behind them. Threads span minutes to days old, mix single-line and
 * multi-turn conversations, and some already end in one of our own replies so
 * the `replied` status appears without anyone having to click through first.
 *
 * Each template is only used for a platform whose real capabilities allow that
 * channel (see {@link inboxChannelsFor}), so the mock never fabricates activity
 * a real API couldn't surface — DMs on X's free tier, or anything on LinkedIn.
 */
const SEED_TEMPLATES: readonly SeedTemplate[] = [
  // ---------------------------------------------------------------- messages
  {
    channel: 'message',
    participant: { name: 'Daniel Reyes', avatar: 'daniel' },
    lines: [
      them('Hi! Is the launch discount still active?'),
      them('And does it apply to annual billing too?'),
    ],
    ageMs: 8 * MINUTE,
  },
  {
    channel: 'message',
    participant: { name: 'Sofia Marchetti', avatar: 'sofia' },
    lines: [
      them("We're a 12-person agency. Do you have team seats?"),
      us('We do — team plans start at 5 seats and include shared brand voices.'),
      them('Perfect, sending this to our ops lead now.'),
    ],
    ageMs: 41 * MINUTE,
  },
  {
    channel: 'message',
    participant: { name: 'Grace Bennett', avatar: 'grace' },
    lines: [
      them(
        'Loved the demo. One question — how do you handle multiple brand voices on one account?',
      ),
    ],
    ageMs: 2 * HOUR,
  },
  {
    channel: 'message',
    participant: { name: 'Hiroshi Tanaka', avatar: 'hiroshi' },
    lines: [
      them('My scheduled post went out twice this morning. Can you check?'),
      us(
        "Sorry about that — we've found the duplicate and removed it. Nothing was charged twice.",
      ),
    ],
    ageMs: 5 * HOUR,
  },
  {
    channel: 'message',
    participant: { name: 'Lena Fischer', avatar: 'lena' },
    lines: [
      them('Do you support scheduling in a different timezone to my account default?'),
    ],
    ageMs: 9 * HOUR,
  },
  {
    channel: 'message',
    participant: { name: 'Marcus Bell', avatar: 'marcus' },
    lines: [
      them('Hey, quick one:'),
      them('can I export everything I generated last month as a CSV?'),
      them('Need it for a client report by Friday 🙏'),
    ],
    ageMs: 22 * HOUR,
  },
  {
    channel: 'message',
    participant: { name: 'Aisha Rahman', avatar: 'aisha' },
    lines: [
      them('Invoice #4821 has the wrong VAT number — can it be reissued?'),
      us("Reissued and emailed to you, with the corrected VAT number. Thanks for flagging."),
      them('Received, thank you!'),
    ],
    ageMs: 31 * HOUR,
  },
  {
    channel: 'message',
    participant: { name: 'Oliver Grant', avatar: 'oliver' },
    lines: [
      them('Is there an API? We want to push drafts from our own CMS.'),
    ],
    ageMs: 2 * DAY,
  },
  {
    channel: 'message',
    participant: { name: 'Chloé Dubois', avatar: 'chloe' },
    lines: [
      them("Cancelled by mistake — is my content still there if I resubscribe?"),
      us('It is. Nothing is deleted for 90 days, so resubscribing restores everything.'),
    ],
    ageMs: 3 * DAY,
  },
  {
    channel: 'message',
    participant: { name: 'Yusuf Adeyemi', avatar: 'yusuf' },
    lines: [
      them('Following up on my last message about the enterprise quote 🙂'),
    ],
    ageMs: 6 * DAY,
  },

  // ---------------------------------------------------------------- comments
  {
    channel: 'comment',
    participant: { name: 'Amara Okafor', avatar: 'amara' },
    lines: [
      them(
        'This thread is exactly what my team needed — do you have a version for enterprise plans?',
      ),
    ],
    ageMs: 4 * MINUTE,
  },
  {
    channel: 'comment',
    participant: { name: 'Ben Whitaker', avatar: 'ben' },
    lines: [them('Saving this one. The before/after examples sold me.')],
    ageMs: 27 * MINUTE,
  },
  {
    channel: 'comment',
    participant: { name: 'Tomás Silva', avatar: 'tomas' },
    lines: [
      them('Does this integrate with our existing scheduler, or is it standalone?'),
      us('Both — you can publish from here, or export and schedule wherever you already work.'),
    ],
    ageMs: 3 * HOUR,
  },
  {
    channel: 'comment',
    participant: { name: 'Nadia Petrova', avatar: 'nadia' },
    lines: [them('Wait, does the free tier really include video captions?')],
    ageMs: 6 * HOUR,
  },
  {
    channel: 'comment',
    participant: { name: 'Jamal Carter', avatar: 'jamal' },
    lines: [
      them('Tried it. The tone matching is genuinely good, not marketing-good.'),
      them('One nit: I wish the hashtag suggestions were regional.'),
    ],
    ageMs: 11 * HOUR,
  },
  {
    channel: 'comment',
    participant: { name: 'Elena Vargas', avatar: 'elena' },
    lines: [them('How long does a 20-minute video take to process?')],
    ageMs: 15 * HOUR,
  },
  {
    channel: 'comment',
    participant: { name: 'Rohan Mehta', avatar: 'rohan' },
    lines: [
      them('Second this — regional hashtags would be huge for us in APAC.'),
      us("It's on the roadmap for this quarter. We'll shout when it ships."),
    ],
    ageMs: 28 * HOUR,
  },
  {
    channel: 'comment',
    participant: { name: 'Ingrid Larsen', avatar: 'ingrid' },
    lines: [them('Is any of this stored for training? Asking for our legal team.')],
    ageMs: 2 * DAY,
  },
  {
    channel: 'comment',
    participant: { name: 'Peter Njoroge', avatar: 'peter' },
    lines: [them('The pricing page 404s on mobile Safari for me.')],
    ageMs: 4 * DAY,
  },
  {
    channel: 'comment',
    participant: { name: 'Mei Lin', avatar: 'mei' },
    lines: [
      them('Been using this for three months. Cut our repurposing time by about 70%.'),
    ],
    ageMs: 7 * DAY,
  },

  // ---------------------------------------------------------------- mentions
  {
    channel: 'mention',
    participant: { name: 'Priya Nair', avatar: 'priya' },
    lines: [
      them(
        'Just shipped our newsletter using this workflow — massive time saver. Highly recommend @contentengine 🙌',
      ),
    ],
    ageMs: 18 * MINUTE,
  },
  {
    channel: 'mention',
    participant: { name: 'Devon Clarke', avatar: 'devon' },
    lines: [
      them('anyone else using @contentengine for short-form? curious how it handles hooks'),
    ],
    ageMs: 52 * MINUTE,
  },
  {
    channel: 'mention',
    participant: { name: 'Fatima Zahra', avatar: 'fatima' },
    lines: [
      them('One long-form post → 14 assets in under ten minutes with @contentengine. Thread 🧵'),
      us('This made our day. Thanks for sharing the full breakdown 💛'),
    ],
    ageMs: 4 * HOUR,
  },
  {
    channel: 'mention',
    participant: { name: 'Alex Novak', avatar: 'alex' },
    lines: [them('@contentengine is the first AI tool that actually sounds like me.')],
    ageMs: 8 * HOUR,
  },
  {
    channel: 'mention',
    participant: { name: 'Harper Quinn', avatar: 'harper' },
    lines: [
      them('honestly @contentengine needs a better mobile editor, everything else is solid'),
    ],
    ageMs: 20 * HOUR,
  },
  {
    channel: 'mention',
    participant: { name: 'Sean O’Malley', avatar: 'sean' },
    lines: [
      them('Comparing @contentengine and two competitors for our agency. Notes to follow.'),
    ],
    ageMs: 36 * HOUR,
  },
  {
    channel: 'mention',
    participant: { name: 'Zanele Dlamini', avatar: 'zanele' },
    lines: [
      them('Shoutout to the @contentengine support team — sorted a billing issue in an hour.'),
      us('Thank you Zanele! Glad it was a quick one.'),
    ],
    ageMs: 3 * DAY,
  },
  {
    channel: 'mention',
    participant: { name: 'Lucas Moreau', avatar: 'lucas' },
    lines: [them('Week 4 with @contentengine — our posting cadence has tripled.')],
    ageMs: 9 * DAY,
  },

  // ----------------------------------------------------------------- reviews
  {
    channel: 'review',
    participant: { name: 'Kwame Mensah', avatar: 'kwame' },
    lines: [them('Five stars. Support replied within minutes and solved my issue. ⭐⭐⭐⭐⭐')],
    ageMs: 90 * MINUTE,
  },
  {
    channel: 'review',
    participant: { name: 'Isabella Rossi', avatar: 'isabella' },
    lines: [
      them('Recommends — the scheduling calendar alone replaced two other tools for us.'),
    ],
    ageMs: 7 * HOUR,
  },
  {
    channel: 'review',
    participant: { name: 'Tobias Hein', avatar: 'tobias' },
    lines: [
      them("Doesn't recommend. Video exports failed twice on a deadline day."),
      us(
        "We're sorry — that was a regional encoder outage, now fixed. We'd love to make it right.",
      ),
    ],
    ageMs: 30 * HOUR,
  },
  {
    channel: 'review',
    participant: { name: 'Amelia Wright', avatar: 'amelia' },
    lines: [them('Great value for a small team. Would like more analytics depth.')],
    ageMs: 2 * DAY,
  },
  {
    channel: 'review',
    participant: { name: 'Ravi Shankar', avatar: 'ravi' },
    lines: [them('Recommends. Onboarding took ten minutes and the results were usable.')],
    ageMs: 5 * DAY,
  },
  {
    channel: 'review',
    participant: { name: 'Nora Haddad', avatar: 'nora' },
    lines: [
      them('Solid tool, but I wish the mobile app let me approve drafts on the go.'),
    ],
    ageMs: 8 * DAY,
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

    // Never fabricate activity the platform's real API couldn't surface.
    const allowed = inboxChannelsFor(this.platform);

    const now = Date.now();
    const conversations = SEED_TEMPLATES.filter(
      (t) => t.channel === context.channel && allowed.includes(t.channel),
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
          items: template.lines.map((line, lineIndex) => {
            // Space earlier lines a couple of minutes before the newest one.
            const offset = (template.lines.length - 1 - lineIndex) * 2 * MINUTE;
            return {
              externalId: `${base}-item-${lineIndex}`,
              channel: template.channel,
              direction: line.direction,
              text: line.text,
              author:
                line.direction === 'inbound'
                  ? {
                      externalId: `${base}-user`,
                      name: template.participant.name,
                      avatarUrl: avatar(template.participant.avatar),
                    }
                  : { externalId: `${base}-self`, name: 'You', avatarUrl: null },
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
