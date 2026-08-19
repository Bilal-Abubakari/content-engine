'use client';

import { motion, useDragControls } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

/**
 * A dialog that adapts to the form factor: on phones it slides up from the
 * bottom edge as a sheet — thumb-reachable, with a drag-to-dismiss handle — and
 * on wider screens it fades in as a centred card. One component so every dialog
 * in the app dismisses the same way.
 *
 * Only the grab handle starts a drag (`dragListener={false}`), so swiping
 * inside the sheet still scrolls its content instead of dragging it closed.
 */
export function Sheet({
  onClose,
  children,
  className = '',
  labelledBy,
}: {
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the panel — typically a desktop `sm:max-w-*`. */
  className?: string;
  /** Id of the element naming this dialog, for screen readers. */
  labelledBy?: string;
}) {
  const dragControls = useDragControls();

  // Escape closes, and the page behind is frozen so a scroll gesture that
  // overshoots the sheet doesn't quietly move the content underneath it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_event, info) => {
          // Dismiss on a decisive flick or a long pull; anything else springs back.
          if (info.offset.y > 110 || info.velocity.y > 600) {
            onClose();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        className={`glass flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:max-h-[85vh] sm:rounded-2xl ${className}`}
      >
        <div
          onPointerDown={(event) => dragControls.start(event)}
          aria-hidden
          className="shrink-0 touch-none py-2.5 sm:hidden"
        >
          <span className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
