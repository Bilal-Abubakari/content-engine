/**
 * Declarative step list for the dashboard product tour. Each step points at a
 * stable `[data-tour="…"]` anchor rendered in the dashboard; the overlay
 * spotlights that element and shows the copy. Steps whose target is absent at
 * runtime (e.g. results that only exist after a generation) are skipped
 * gracefully by the overlay.
 */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  id: string;
  /** CSS selector for the element to highlight. */
  target: string;
  title: string;
  body: string;
  placement?: TourPlacement;
}

export const DASHBOARD_TOUR: TourStep[] = [
  {
    id: 'source',
    target: '[data-tour="source"]',
    title: 'Start with any source',
    body: 'Paste a URL to an article, a transcript, or rough notes. This is the raw material we repurpose into a week of content.',
    placement: 'bottom',
  },
  {
    id: 'formats',
    target: '[data-tour="formats"]',
    title: 'Pick your formats',
    body: 'Choose only the formats you want — tweets, a LinkedIn post, a newsletter, and more. We generate just these, so nothing is wasted.',
    placement: 'bottom',
  },
  {
    id: 'tone',
    target: '[data-tour="tone"]',
    title: 'Set the tone',
    body: 'Match your voice for this run. Your saved default is pre-filled, and changing it here only affects this generation.',
    placement: 'bottom',
  },
  {
    id: 'repurpose',
    target: '[data-tour="repurpose"]',
    title: 'Repurpose in one click',
    body: 'Hit Repurpose and get every selected format in seconds. You can then copy, preview, or publish each piece.',
    placement: 'top',
  },
  {
    id: 'usage',
    target: '[data-tour="usage"]',
    title: 'Track your usage',
    body: 'Keep an eye on how many repurposes you have left this month, and upgrade or manage billing right here.',
    placement: 'bottom',
  },
  {
    id: 'nav',
    target: '[data-tour="nav"]',
    title: 'Connections, History & Settings',
    body: 'Link social accounts to publish directly, revisit past runs in History, and set your defaults in Settings. You can replay this tour anytime from the help button.',
    placement: 'bottom',
  },
];
