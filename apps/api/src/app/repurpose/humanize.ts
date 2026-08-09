import type { RepurposedContent } from '@org/shared';

/**
 * Softens the punctuation that most obviously reads as "AI-generated" — chiefly
 * the em dash (—) and its plain-text stand-ins (a double hyphen, and the en
 * dash) — so published copy sounds more like a person wrote it. The em dash is
 * a strong tell precisely because models reach for it constantly; swapping it
 * for a comma keeps the sentence readable without that signature.
 *
 * Pure and exported so the rewrite rules can be exhaustively unit-tested.
 */
export function humanizeText(text: string): string {
  return (
    text
      // Em dash joining clauses -> comma. Collapse any spaces around it so
      // "great — really" and "great—really" both become "great, really".
      .replace(/\s*\u2014\s*/g, ', ')
      // A double hyphen used as an em dash -> comma. Two safe shapes: spaced on
      // both sides ("wait -- there") or tight between word chars
      // ("delays--just"). A space on only the left ("run --verbose") is a CLI
      // flag, not a dash, so it's deliberately left alone.
      .replace(/(\S)\s+--\s+(\S)/g, '$1, $2')
      .replace(/(\w)--(\w)/g, '$1, $2')
      // En dash (usually a numeric range, e.g. 10–20) -> plain hyphen.
      .replace(/\s*\u2013\s*/g, '-')
  );
}

/**
 * Apply {@link humanizeText} across every generated field, preserving the
 * per-format shape (arrays stay arrays). Only present fields are copied, so the
 * result carries exactly the formats the caller produced.
 */
export function humanizeContent(content: RepurposedContent): RepurposedContent {
  const result: RepurposedContent = {};
  if (content.tweets) {
    result.tweets = content.tweets.map(humanizeText);
  }
  if (content.threads) {
    result.threads = content.threads.map(humanizeText);
  }
  if (content.linkedIn !== undefined) {
    result.linkedIn = humanizeText(content.linkedIn);
  }
  if (content.newsletter !== undefined) {
    result.newsletter = humanizeText(content.newsletter);
  }
  if (content.facebook !== undefined) {
    result.facebook = humanizeText(content.facebook);
  }
  if (content.instagram !== undefined) {
    result.instagram = humanizeText(content.instagram);
  }
  if (content.tiktok !== undefined) {
    result.tiktok = humanizeText(content.tiktok);
  }
  return result;
}
