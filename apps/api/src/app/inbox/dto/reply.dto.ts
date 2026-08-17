/**
 * Body for POST /api/inbox/conversations/:id/reply. Validated in the service
 * (class-validator is not used in this project), so the DTO only describes the
 * expected shape.
 */
export class ReplyDto {
  text!: string;
}
