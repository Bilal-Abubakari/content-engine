import type { RepurposeRequest } from '@org/shared';

/**
 * Runtime DTO for the repurpose endpoint. Mirrors the shared
 * {@link RepurposeRequest} contract so the wire format stays type-safe.
 */
export class RepurposeRequestDto implements RepurposeRequest {
  source!: string;
}
