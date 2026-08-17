import Image from 'next/image';
import logo from '@/assets/images/logo.jpeg';

/**
 * The ContentEngine brand mark: the logo on a white tile so it reads on the
 * app's dark surfaces, matching the installed PWA icon. Size is driven by the
 * `className` on the tile (defaults to a navbar-sized 2rem square). The image is
 * `unoptimized` so it needs no runtime image pipeline (no `sharp`).
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white ${className}`}
    >
      <Image
        src={logo}
        alt=""
        width={44}
        height={44}
        className="h-full w-full object-contain p-1"
        unoptimized
        priority
      />
    </span>
  );
}
