import type { CloudinarySignature, MediaItem } from '@org/shared';

/** Cloudinary's response fields we care about after a successful upload. */
interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
}

/** Largest file we let the browser attempt to upload (matches good UX limits). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Upload one image/video straight to Cloudinary using a server-minted
 * signature, and return the attachable {@link MediaItem}. The file bytes never
 * pass through our own API — only the signature request does. Throws a
 * user-facing message on any failure.
 */
export async function uploadMedia(file: File): Promise<MediaItem> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is too large (max 100MB).');
  }

  const signRes = await fetch('/api/media/sign', { method: 'POST' });
  if (!signRes.ok) {
    throw new Error('Uploads are unavailable right now. Try again later.');
  }
  const sig = (await signRes.json()) as CloudinarySignature;

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
    { method: 'POST', body: form },
  );
  if (!uploadRes.ok) {
    throw new Error('Upload failed. Please try a different file.');
  }
  const data = (await uploadRes.json()) as CloudinaryUploadResult;

  return {
    id: data.public_id,
    url: data.secure_url,
    kind: data.resource_type === 'video' ? 'video' : 'image',
  };
}
