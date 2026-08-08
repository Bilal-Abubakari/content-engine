import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { SourceType } from './repurpose.service';

/** Abort a slow fetch after this many milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;
/** Cap how much extracted text we forward to the model. */
const MAX_CONTENT_CHARS = 12_000;

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

    const html = await this.fetchHtml(url);
    const text = this.extractReadableText(html);
    if (!text) {
      throw new BadRequestException(
        'Could not extract readable text from that URL. Try pasting the text directly.',
      );
    }
    return text.slice(0, MAX_CONTENT_CHARS);
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

    const blocked =
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

    if (blocked) {
      throw new BadRequestException('That URL host is not allowed.');
    }
  }
}
