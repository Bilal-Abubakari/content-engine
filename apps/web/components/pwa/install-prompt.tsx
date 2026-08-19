'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Share, SquarePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/brand/logo-mark';

/**
 * The `beforeinstallprompt` event (Chromium only) isn't in the DOM lib types, so
 * we describe the slice we use. Firing `prompt()` shows the native install
 * dialog; `userChoice` resolves once the user accepts or dismisses it.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Re-show the banner this many days after a manual dismissal. */
const SNOOZE_DAYS = 14;
const DISMISS_KEY = 'ce-pwa-install-dismissed-at';

/** True once the app is running as an installed PWA (so we never nag). */
function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const iosStandalone = (navigator as unknown as { standalone?: boolean })
    .standalone;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    iosStandalone === true
  );
}

/** iOS Safari can't use `beforeinstallprompt`; it needs manual instructions. */
function isIos(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const ua = window.navigator.userAgent;
  const iPhoneOrPad = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ masquerades as desktop Safari, so also treat a touch Mac as iOS.
  const iPadOsDesktop =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhoneOrPad || iPadOsDesktop;
}

function recentlyDismissed(): boolean {
  try {
    const at = window.localStorage.getItem(DISMISS_KEY);
    if (!at) {
      return false;
    }
    const ageMs = Date.now() - Number(at);
    return ageMs < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * A dismissible "install this app" banner. On Chromium (Android/desktop) it
 * drives the native install dialog via the captured `beforeinstallprompt`
 * event; on iOS Safari — which has no such API — it explains the manual
 * Share → Add to Home Screen steps. It renders nothing when the app is already
 * installed or was recently dismissed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) {
      return;
    }

    // Chromium: capture the event so we can trigger the prompt on our own CTA.
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Once installed, hide the banner and don't show it again this session.
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — surface the manual guide instead.
    if (isIos()) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    setShowIosGuide(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable — banner simply reappears next visit */
    }
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
      return;
    }
    // No native prompt (iOS) — reveal the step-by-step instructions.
    setShowIosGuide(true);
  }

  if (!visible) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          // Clears the mobile tab bar rather than covering it — both are
          // bottom-pinned chrome, and the tab bar is only hidden from `md` up.
          className="fixed inset-x-0 bottom-[calc(var(--tab-bar-h)+var(--safe-bottom)+0.75rem)] z-40 px-4 md:bottom-4"
        >
          <div className="glass mx-auto flex max-w-md items-center gap-3 p-3 shadow-2xl">
            <LogoMark className="h-11 w-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Install ContentEngine</p>
              <p className="truncate text-xs text-slate-400">
                Add it to your home screen for a full-screen, app-like inbox.
              </p>
            </div>
            <button
              onClick={install}
              className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showIosGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-end bg-slate-950/70 p-4 backdrop-blur-sm sm:place-items-center"
            onClick={dismiss}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="glass w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add to Home Screen</h2>
                <button
                  onClick={dismiss}
                  aria-label="Close"
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Install ContentEngine in two taps from Safari:
              </p>
              <ol className="mt-4 space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-brand-300">
                    <Share className="h-5 w-5" />
                  </span>
                  <span>
                    Tap the <span className="font-semibold">Share</span> button
                    in Safari's toolbar.
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-brand-300">
                    <SquarePlus className="h-5 w-5" />
                  </span>
                  <span>
                    Choose{' '}
                    <span className="font-semibold">Add to Home Screen</span>,
                    then tap <span className="font-semibold">Add</span>.
                  </span>
                </li>
              </ol>
              <button
                onClick={dismiss}
                className="mt-6 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
