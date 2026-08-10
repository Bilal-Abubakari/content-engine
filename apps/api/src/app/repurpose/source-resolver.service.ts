import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { SourceType } from './repurpose.service';

/** Abort a slow fetch after this many milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;
/** Cap how much extracted text we forward to the model. */
const MAX_CONTENT_CHARS = 12_000;
/**
 * Minimum extracted characters before we trust a page actually carried an
 * article. Real bodies run into the thousands; a JS-app shell or paywall leaves
 * only a scrap of nav/footer text, which would make the model hallucinate.
 */
const MIN_CONTENT_CHARS = 200;

/**
 * Platforms whose real content (video, audio, or a login-walled JS feed) is not
 * present in the HTML we can fetch server-side. Feeding their page shell to the
 * model yields nonsense, so we reject these up front with a clear message.
 * Keyed by registrable domain and matched against the host and any subdomain
 * (so `m.youtube.com` matches `youtube.com`).
 */
const UNSUPPORTED_SOURCES: ReadonlyArray<{ domain: string; label: string }> = [
  { domain: 'youtube.com', label: 'YouTube' },
  { domain: 'youtu.be', label: 'YouTube' },
  { domain: 'vimeo.com', label: 'Vimeo' },
  { domain: 'tiktok.com', label: 'TikTok' },
  { domain: 'instagram.com', label: 'Instagram' },
  { domain: 'facebook.com', label: 'Facebook' },
  { domain: 'twitter.com', label: 'X (Twitter)' },
  { domain: 'x.com', label: 'X (Twitter)' },
  { domain: 'spotify.com', label: 'Spotify' },
  { domain: 'podcasts.apple.com', label: 'Apple Podcasts' },
];

/**
 * Turns a raw source into the text we actually feed the model. Pasted text is
 * returned untouched; a URL is fetched and its readable article body extracted
 * so the model repurposes the real content rather than a bare link it cannot
 * open.
 */
@Injectable()
export class SourceResolverService {
  async resolve(source: string, sourceType: SourceType): Promise<string> {
    if (sourceType === 'text') {
      return source;
    }
    return this.fetchArticleText(source);
  }

  /** Fetch a URL and return its main readable text, or throw a clear 400. */
  private async fetchArticleText(url: string): Promise<string> {
    this.assertFetchable(url);

    const unsupported = SourceResolverService.unsupportedSourceLabel(
      new URL(url).hostname,
    );
    if (unsupported) {
      throw new BadRequestException(
        `We can't read ${unsupported} links yet — that content isn't in the page we fetch. Paste the transcript or text directly and we'll repurpose it.`,
      );
    }

    const html = await this.fetchHtml(url);
    const text = this.extractReadableText(html);
    if (text.length < MIN_CONTENT_CHARS) {
      throw new BadRequestException(
        "We couldn't find enough readable text on that page — it may need JavaScript or a login. Paste the text directly and we'll repurpose it.",
      );
    }
    return text.slice(0, MAX_CONTENT_CHARS);
  }

  /**
   * Return a friendly platform name when the host is one whose content we can't
   * read from server-fetched HTML, otherwise null. Static and pure so the list
   * can be exhaustively unit-tested. Matches the exact host or any subdomain of
   * a listed domain.
   */
  static unsupportedSourceLabel(hostname: string): string | null {
    const host = hostname.toLowerCase();
    const match = UNSUPPORTED_SOURCES.find(
      ({ domain }) => host === domain || host.endsWith(`.${domain}`),
    );
    return match ? match.label : null;
  }

  /** Perform the HTTP GET with a timeout and content-type check. */
  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'ContentEngineBot/1.0' },
      });
      if (!res.ok) {
        throw new BadRequestException(
          `Could not fetch that URL (status ${res.status}).`,
        );
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        throw new BadRequestException('That URL did not return an HTML page.');
      }
      return await res.text();
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(
        'Could not reach that URL. Check the link or paste the text directly.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Strip boilerplate and pull the main body text out of an HTML document. */
  private extractReadableText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, noscript, nav, header, footer, aside, form, svg').remove();

    const scoped = $('article').text().trim() || $('main').text().trim();
    const body = scoped || $('body').text();

    return body.replace(/\s+/g, ' ').trim();
  }

  /**
   * Reject URLs that point at the local host or private networks. This is a
   * server-side fetch of user-supplied input, so this guard limits SSRF against
   * internal services and cloud metadata endpoints.
   */
  private assertFetchable(url: string): void {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new BadRequestException('That does not look like a valid URL.');
    }

    // WHATWG URL wraps IPv6 literals in brackets; strip them for matching.
    const host = hostname.replace(/^\[|\]$/g, '');
    const isIpv6 = host.includes(':');
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — inspect the embedded IPv4 too.
    const mappedIpv4 = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
    const ipv4 = mappedIpv4 ?? host;

    const blockedIpv4 =
      ipv4 === '0.0.0.0' ||
      /^127\./.test(ipv4) ||
      /^10\./.test(ipv4) ||
      /^192\.168\./.test(ipv4) ||
      /^169\.254\./.test(ipv4) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ipv4);

    const blockedIpv6 =
      isIpv6 &&
      (host === '::1' || // loopback
        host === '::' || // unspecified
        /^f[cd]/.test(host) || // unique local fc00::/7
        /^fe[89ab]/.test(host)); // link-local fe80::/10

    const blocked =
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      blockedIpv4 ||
      blockedIpv6;

    if (blocked) {
      throw new BadRequestException('That URL host is not allowed.');
    }
  }
}
