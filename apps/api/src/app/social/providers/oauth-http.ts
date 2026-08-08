/**
 * Tiny fetch helpers shared by the real social providers. Every provider talks
 * to its platform over plain HTTPS, so this centralises the "call, check the
 * status, surface a readable error" boilerplate. The thrown message is safe to
 * persist on a failed post's `error` column and to show the user.
 */

/** Raised when a platform HTTP call returns a non-2xx response. */
export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

/**
 * Perform a request and return the raw {@link Response} plus its text body.
 * Throws {@link ProviderHttpError} on a non-2xx status. Callers that need
 * response headers (e.g. LinkedIn's `x-restli-id`) use this directly.
 */
export async function requestRaw(
  url: string,
  init: RequestInit,
  context: string,
): Promise<{ res: Response; text: string }> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new ProviderHttpError(
      `${context} failed (${res.status}): ${text.slice(0, 300)}`,
      res.status,
      text,
    );
  }
  return { res, text };
}

/** Perform a request and parse the JSON body, throwing on a non-2xx status. */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
  context: string,
): Promise<T> {
  const { text } = await requestRaw(url, init, context);
  return (text ? JSON.parse(text) : {}) as T;
}
