/**
 * Body for POST /api/inbox/conversations/:id/draft. Every field is optional —
 * with no instruction the model infers an on-brand reply from the thread.
 */
export class DraftDto {
  /** Optional steer, e.g. "apologetic" or "offer a 10% code". */
  instruction?: string;
}
