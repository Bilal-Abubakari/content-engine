import type { ContentTone, Platform, RepurposeRequest } from '@org/shared';

/**
 * Runtime DTO for the repurpose endpoint. Mirrors the shared
 * {@link RepurposeRequest} contract so the wire format stays type-safe. The
 * optional `formats`/`tone` are per-run overrides; when omitted the user's saved
 * settings decide. Values are validated in the controller/service.
 */
export class RepurposeRequestDto implements RepurposeRequest {
  source!: string;
  formats?: Platform[];
  tone?: ContentTone;
}
