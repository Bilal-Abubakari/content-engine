import { createHash } from 'node:crypto';

/**
 * Build the exact string Cloudinary signs for an upload: every signed
 * parameter as `key=value`, sorted alphabetically by key, joined with `&`.
 * (`file`, `api_key`, `resource_type` and `cloud_name` are never signed.)
 */
export function buildSignaturePayload(
  params: Record<string, string | number>,
): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

/**
 * Compute the Cloudinary upload signature: SHA-1 of the signed-params payload
 * with the API secret appended, as a hex digest. Pure and deterministic so the
 * upload flow can be verified without hitting Cloudinary.
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  return createHash('sha1')
    .update(buildSignaturePayload(params) + apiSecret)
    .digest('hex');
}
