import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService, type UserSettings as UserSettingsRow } from '@org/database';
import {
  DEFAULT_SETTINGS,
  isContentTone,
  isGenerationFormat,
  SETTINGS_LIMITS,
  type ContentTone,
  type GenerationFormat,
  type UpdateSettingsRequest,
  type UserSettings,
} from '@org/shared';

/**
 * Reads and writes a user's content-generation preferences. Settings are lazy:
 * a user has none until they first save, so {@link get} falls back to
 * {@link DEFAULT_SETTINGS} and {@link update} upserts. The first successful save
 * stamps `onboardedAt`, which the web app uses to gate the dashboard behind
 * onboarding.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The user's saved settings, or the defaults if they haven't saved yet. */
  async get(userId: string): Promise<UserSettings> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    return row ? this.toView(row) : { ...DEFAULT_SETTINGS };
  }

  /**
   * Validate and persist the user's settings, creating the row on first save.
   * The first save also marks onboarding complete by stamping `onboardedAt`.
   */
  async update(
    userId: string,
    input: UpdateSettingsRequest,
  ): Promise<UserSettings> {
    const clean = this.validate(input);
    const now = new Date();

    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      // onboardedAt is only set on create so it records the first-ever save and
      // is never overwritten by later edits from the settings page.
      create: { userId, ...clean, onboardedAt: now },
      update: clean,
    });

    return this.toView(row);
  }

  /**
   * Enforce the settings contract server-side (no global ValidationPipe in this
   * codebase). Returns a normalized payload safe to persist or throws a 400.
   */
  private validate(input: UpdateSettingsRequest): {
    tone: ContentTone;
    customTone: string | null;
    formats: GenerationFormat[];
    audience: string | null;
    guidance: string | null;
    emojis: boolean;
    hashtags: boolean;
    language: string;
  } {
    if (!isContentTone(input.tone)) {
      throw new BadRequestException(`Invalid tone: ${String(input.tone)}`);
    }

    if (!Array.isArray(input.formats) || input.formats.length === 0) {
      throw new BadRequestException('Select at least one format to generate.');
    }
    const formats = [...new Set(input.formats)];
    for (const format of formats) {
      if (!isGenerationFormat(format)) {
        throw new BadRequestException(`Invalid format: ${String(format)}`);
      }
    }

    if (typeof input.emojis !== 'boolean' || typeof input.hashtags !== 'boolean') {
      throw new BadRequestException('emojis and hashtags must be booleans.');
    }

    const language = this.requiredText(
      input.language,
      'language',
      SETTINGS_LIMITS.language,
    );

    return {
      tone: input.tone,
      customTone: this.optionalText(
        input.customTone,
        'customTone',
        SETTINGS_LIMITS.customTone,
      ),
      formats: formats as GenerationFormat[],
      audience: this.optionalText(
        input.audience,
        'audience',
        SETTINGS_LIMITS.audience,
      ),
      guidance: this.optionalText(
        input.guidance,
        'guidance',
        SETTINGS_LIMITS.guidance,
      ),
      emojis: input.emojis,
      hashtags: input.hashtags,
      language,
    };
  }

  /** Trim and length-check a required free-text field. */
  private requiredText(
    value: unknown,
    field: string,
    max: number,
  ): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
      throw new BadRequestException(`${field} must be ${max} characters or fewer.`);
    }
    return trimmed;
  }

  /** Trim and length-check an optional free-text field; empty becomes null. */
  private optionalText(
    value: unknown,
    field: string,
    max: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string.`);
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.length > max) {
      throw new BadRequestException(`${field} must be ${max} characters or fewer.`);
    }
    return trimmed;
  }

  /** Project a stored row onto the shared, client-facing shape. */
  private toView(row: UserSettingsRow): UserSettings {
    return {
      tone: isContentTone(row.tone) ? row.tone : DEFAULT_SETTINGS.tone,
      customTone: row.customTone,
      formats: row.formats.filter(isGenerationFormat),
      audience: row.audience,
      guidance: row.guidance,
      emojis: row.emojis,
      hashtags: row.hashtags,
      language: row.language,
      onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
    };
  }
}
