import type { SVGProps } from 'react';

/**
 * Brand glyphs (X / LinkedIn) are no longer shipped by lucide-react v1, which
 * dropped all trademarked logos. These inline SVGs fill that gap and keep the
 * same call signature as a lucide icon (`className`, standard SVG props), so
 * they drop into the same `IconComponent` slots without any wrapper.
 */
export type IconComponent = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

export const XIcon: IconComponent = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const LinkedInIcon: IconComponent = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export const GitHubIcon: IconComponent = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

/**
 * Google's brand mark is intentionally multi-colored (per their branding
 * guidelines), so — unlike the monochrome glyphs above — it sets explicit
 * per-path fills rather than inheriting `currentColor`.
 */
export const GoogleIcon: IconComponent = (props) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fill="#4285F4"
      d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.394 3.622v3.01h3.878c2.27-2.09 3.578-5.166 3.578-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.956-1.075 7.942-2.908l-3.878-3.01c-1.075.72-2.45 1.145-4.064 1.145-3.125 0-5.77-2.11-6.714-4.945H1.276v3.11A11.997 11.997 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.286 14.282A7.213 7.213 0 0 1 4.91 12c0-.79.136-1.56.376-2.282v-3.11H1.276A11.997 11.997 0 0 0 0 12c0 1.936.464 3.766 1.276 5.392l4.01-3.11z"
    />
    <path
      fill="#EA4335"
      d="M12 4.773c1.762 0 3.344.606 4.59 1.796l3.44-3.44C17.952 1.19 15.235 0 12 0 7.31 0 3.256 2.69 1.276 6.608l4.01 3.11C6.23 6.882 8.875 4.773 12 4.773z"
    />
  </svg>
);
