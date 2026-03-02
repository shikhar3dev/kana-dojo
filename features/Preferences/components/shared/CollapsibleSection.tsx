'use client';
import clsx from 'clsx';
import { useState, useEffect, useRef, ReactNode } from 'react';
import { useClick } from '@/shared/hooks/useAudio';
import { ChevronUp } from 'lucide-react';
import { useSidebarFixedLayout } from '@/shared/hooks/useSidebarLayout';

interface CollapsibleSectionProps {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  level?: 'section' | 'subsection' | 'subsubsection';
  className?: string;
  /** Unique ID for session storage persistence */
  storageKey?: string;
  /**
   * When true, the heading escapes the content container and spans from the
   * sidebar's right edge to the viewport's right edge (including over the
   * scrollbar), exactly like SelectionStatusBar and ProgressTabs.
   * Uses position:fixed + a sentinel div to track natural position.
   */
  fullBorder?: boolean;
}

const levelStyles = {
  section: {
    header: 'text-3xl py-4',
    border: 'border-b-2 border-(--border-color)',
    chevronSize: 24,
    gap: 'gap-4',
  },
  subsection: {
    header: 'text-2xl py-3',
    border: 'border-b-1 border-(--border-color)',
    chevronSize: 22,
    gap: 'gap-3',
  },
  subsubsection: {
    header: 'text-xl py-2',
    border: '',
    chevronSize: 20,
    gap: 'gap-2',
  },
};

const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = true,
  level = 'section',
  className,
  storageKey,
  fullBorder = false,
}: CollapsibleSectionProps) => {
  const { playClick } = useClick();

  // Initialize state from session storage or default
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const stored = sessionStorage.getItem(`collapsible-${storageKey}`);
      if (stored !== null) return stored === 'true';
    }
    return defaultOpen;
  });

  // Persist state to session storage
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      sessionStorage.setItem(`collapsible-${storageKey}`, String(isOpen));
    }
  }, [isOpen, storageKey]);

  const styles = levelStyles[level];

  const handleToggle = () => {
    playClick();
    setIsOpen(prev => !prev);
  };

  // ── Full-bleed fixed heading (fullBorder mode only) ──────────────────────
  // Uses position:fixed (same as SelectionStatusBar / ProgressTabs) so the
  // heading renders over the native scrollbar, matching their visual behaviour.
  // A zero-height sentinel div keeps the heading's place in document flow, so
  // we know where to position the fixed element vertically. The heading hides
  // when its entire container has scrolled above the viewport, preventing two
  // headings from overlapping each other at top:0.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [buttonTop, setButtonTop] = useState<number>(0);
  const [buttonHeight, setButtonHeight] = useState<number>(60); // sensible default
  const [isHeadingVisible, setIsHeadingVisible] = useState<boolean>(true);

  // Sidebar-aware fixed layout: left offset + width (same hook as SelectionStatusBar)
  const fixedLayout = useSidebarFixedLayout();

  useEffect(() => {
    if (!fullBorder) return;

    // Track button height via ResizeObserver so the sentinel always matches
    const btn = buttonRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (btn) {
      resizeObserver = new ResizeObserver(() => {
        setButtonHeight(btn.offsetHeight);
      });
      resizeObserver.observe(btn);
      setButtonHeight(btn.offsetHeight);
    }

    const update = () => {
      const sentinel = sentinelRef.current;
      const container = containerRef.current;
      if (!sentinel || !container) return;

      const sentinelTop = sentinel.getBoundingClientRect().top;
      const containerBottom = container.getBoundingClientRect().bottom;

      // Hide once the entire section has scrolled above the viewport —
      // this prevents two fullBorder headings overlapping at top:0
      if (containerBottom <= 0) {
        setIsHeadingVisible(false);
      } else {
        setIsHeadingVisible(true);
        // Clamp to 0 so the heading sticks at the viewport top
        setButtonTop(Math.max(0, sentinelTop));
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      resizeObserver?.disconnect();
    };
  }, [fullBorder]);

  // ─────────────────────────────────────────────────────────────────────────

  if (fullBorder) {
    return (
      <div
        ref={containerRef}
        className={clsx('flex flex-col', styles.gap, className)}
      >
        {/* Sentinel: stays in document flow, holds the heading's vertical space */}
        <div
          ref={sentinelRef}
          style={{ height: buttonHeight, flexShrink: 0 }}
        />

        {/* Fixed heading — paints over the scrollbar, same as SelectionStatusBar */}
        {isHeadingVisible && (
          <button
            ref={buttonRef}
            className={clsx(
              'group flex flex-row items-center gap-2 text-left',
              'hover:cursor-pointer',
              styles.header,
              'border-b-4 border-(--border-color) bg-(--card-color) px-4 py-3',
              'z-30',
            )}
            style={{
              position: 'fixed',
              top: buttonTop,
              left: typeof fixedLayout.left === 'number' ? fixedLayout.left : 0,
              width:
                typeof fixedLayout.width === 'number'
                  ? fixedLayout.width
                  : '100%',
            }}
            onClick={handleToggle}
          >
            <ChevronUp
              className={clsx(
                'transition-transform duration-300 ease-out',
                'transition-colors delay-200 duration-300',
                'text-(--main-color)',
                'max-md:group-active:text-(--main-color)',
                'md:group-hover:text-(--main-color)',
                !isOpen && 'rotate-180',
              )}
              size={styles.chevronSize}
            />
            {icon && (
              <span className='flex items-center text-(--secondary-color)'>
                {icon}
              </span>
            )}
            <span>{title}</span>
          </button>
        )}

        {/* Content with smooth height animation */}
        <div
          className={clsx(
            'grid overflow-hidden',
            'transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]',
            isOpen
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className='min-h-0'>{children}</div>
        </div>
      </div>
    );
  }

  // ── Normal (non-fullBorder) rendering ─────────────────────────────────────
  return (
    <div className={clsx('flex flex-col', styles.gap, className)}>
      <button
        className={clsx(
          'group flex w-full flex-row items-center gap-2 text-left',
          'hover:cursor-pointer',
          styles.header,
          styles.border,
        )}
        onClick={handleToggle}
      >
        <ChevronUp
          className={clsx(
            'transition-transform duration-300 ease-out',
            'transition-colors delay-200 duration-300',
            'text-(--main-color)',
            'max-md:group-active:text-(--main-color)',
            'md:group-hover:text-(--main-color)',
            !isOpen && 'rotate-180',
          )}
          size={styles.chevronSize}
        />
        {icon && (
          <span className='flex items-center text-(--secondary-color)'>
            {icon}
          </span>
        )}
        <span>{title}</span>
      </button>

      <div
        className={clsx(
          'grid overflow-hidden',
          'transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className='min-h-0'>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
