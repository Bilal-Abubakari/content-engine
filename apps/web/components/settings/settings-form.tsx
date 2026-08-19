'use client';

import {
  CONTENT_TONES,
  GENERATION_FORMATS,
  SETTINGS_LIMITS,
  type ContentTone,
  type GenerationFormat,
  type UpdateSettingsRequest,
  type UserSettings,
} from '@org/shared';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Status = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The shared preferences editor used by both first-run onboarding and the
 * settings page. In `onboarding` mode a successful save (or skip) sends the user
 * to the dashboard; in `settings` mode it stays put and shows a saved banner.
 */
export function SettingsForm({
  initial,
  mode,
}: {
  initial: UserSettings;
  mode: 'onboarding' | 'settings';
}) {
  const router = useRouter();
  const [tone, setTone] = useState<ContentTone>(initial.tone);
  const [customTone, setCustomTone] = useState(initial.customTone ?? '');
  const [formats, setFormats] = useState<GenerationFormat[]>(initial.formats);
  const [audience, setAudience] = useState(initial.audience ?? '');
  const [guidance, setGuidance] = useState(initial.guidance ?? '');
  const [emojis, setEmojis] = useState(initial.emojis);
  const [hashtags, setHashtags] = useState(initial.hashtags);
  const [language, setLanguage] = useState(initial.language);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const noFormats = formats.length === 0;

  function toggleFormat(id: GenerationFormat) {
    setFormats((current) =>
      current.includes(id)
        ? current.filter((f) => f !== id)
        : [...current, id],
    );
  }

  async function save(payload: UpdateSettingsRequest): Promise<boolean> {
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'Could not save your settings.');
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
      setStatus('error');
      return false;
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (noFormats) return;

    const ok = await save({
      tone,
      customTone: customTone.trim() || null,
      formats,
      audience: audience.trim() || null,
      guidance: guidance.trim() || null,
      emojis,
      hashtags,
      language: language.trim() || 'English',
    });
    if (!ok) return;

    if (mode === 'onboarding') {
      router.push('/dashboard');
      router.refresh();
    } else {
      setStatus('saved');
    }
  }

  async function handleSkip() {
    // Persist sensible defaults so onboarding is marked complete and the user
    // isn't bounced back here on every visit.
    const ok = await save({
      tone: initial.tone,
      customTone: null,
      formats: initial.formats,
      audience: null,
      guidance: null,
      emojis: initial.emojis,
      hashtags: initial.hashtags,
      language: initial.language,
    });
    if (!ok) return;
    router.push('/dashboard');
    router.refresh();
  }

  const saving = status === 'saving';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Tone */}
      <section>
        <h2 className="text-sm font-semibold text-slate-200">Tone of voice</h2>
        <p className="mt-1 text-sm text-slate-400">
          How should your content sound?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CONTENT_TONES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTone(preset.id)}
              className={`tap rounded-xl border p-3 text-left ${
                tone === preset.id
                  ? 'border-brand-400/60 bg-brand-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <span className="block text-sm font-medium text-slate-100">
                {preset.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={customTone}
          onChange={(e) => setCustomTone(e.target.value)}
          maxLength={SETTINGS_LIMITS.customTone}
          placeholder="Optional: add a nuance, e.g. 'a touch of dry humour'"
          className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
        />
      </section>

      {/* Formats */}
      <section>
        <h2 className="text-sm font-semibold text-slate-200">
          Formats to generate
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Only the formats you pick are generated — saving tokens and clutter.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GENERATION_FORMATS.map((format) => {
            const selected = formats.includes(format.id);
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => toggleFormat(format.id)}
                className={`tap flex items-start gap-3 rounded-xl border p-3 text-left ${
                  selected
                    ? 'border-brand-400/60 bg-brand-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                    selected
                      ? 'border-brand-400 bg-brand-500 text-white'
                      : 'border-white/20'
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-100">
                    {format.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {format.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {noFormats && (
          <p className="mt-2 text-xs text-amber-300">
            Select at least one format.
          </p>
        )}
      </section>

      {/* Audience & guidance */}
      <section className="space-y-4">
        <div>
          <label
            htmlFor="audience"
            className="text-sm font-semibold text-slate-200"
          >
            Target audience
          </label>
          <input
            id="audience"
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            maxLength={SETTINGS_LIMITS.audience}
            placeholder="e.g. B2B SaaS founders"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div>
          <label
            htmlFor="guidance"
            className="text-sm font-semibold text-slate-200"
          >
            Brand / style guidance
          </label>
          <textarea
            id="guidance"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            maxLength={SETTINGS_LIMITS.guidance}
            rows={3}
            placeholder="Anything the AI should always do or avoid. e.g. 'Never use the word synergy.'"
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </section>

      {/* Toggles & language */}
      <section className="space-y-3">
        <Toggle
          label="Use emojis"
          description="Let the AI sprinkle in emojis where they fit."
          checked={emojis}
          onChange={setEmojis}
        />
        <Toggle
          label="Use hashtags"
          description="Include relevant hashtags where the platform expects them."
          checked={hashtags}
          onChange={setHashtags}
        />
        <div>
          <label
            htmlFor="language"
            className="block text-sm font-semibold text-slate-200"
          >
            Output language
          </label>
          <input
            id="language"
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            maxLength={SETTINGS_LIMITS.language}
            placeholder="English"
            className="mt-2 w-full max-w-xs rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </section>

      {status === 'error' && error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {status === 'saved' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" />
          Settings saved.
        </div>
      )}

      {/* The primary action spans the card on phones so it sits under the
          thumb; on desktop it shrinks back to its natural width. */}
      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="submit"
          disabled={saving || noFormats}
          className="tap inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'onboarding' ? 'Finish setup' : 'Save changes'}
        </button>
        {mode === 'onboarding' && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="tap inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="tap flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
    >
      <span>
        <span className="block text-sm font-medium text-slate-100">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{description}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-brand-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
