import type {
  ContentTone,
  GenerationFormat,
  UpdateSettingsRequest,
} from '@org/shared';

/**
 * Runtime DTO for PUT /api/settings. Mirrors the shared
 * {@link UpdateSettingsRequest} contract; values are validated in
 * {@link SettingsService} (this codebase has no global ValidationPipe).
 */
export class UpdateSettingsDto implements UpdateSettingsRequest {
  tone!: ContentTone;
  customTone?: string | null;
  formats!: GenerationFormat[];
  audience?: string | null;
  guidance?: string | null;
  emojis!: boolean;
  hashtags!: boolean;
  language!: string;
}
