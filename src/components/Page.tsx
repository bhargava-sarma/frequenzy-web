/**
 * Scrolling page frame.
 *
 * The title bar starts invisible and materializes as glass once the content
 * scrolls beneath it, taking over the page title — the same trick Apple Music
 * and iOS large titles use.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChevronLeftIcon, ChevronRightIcon, GripIcon } from './Icons';

interface PageProps {
  title: string;
  subtitle?: string;
  /** Rendered instead of the standard title block (used by artist heroes). */
  hero?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  onMenuClick?: () => void;
}

export function Page({ title, subtitle, hero, actions, children, onMenuClick }: PageProps) {
  const navigate = useNavigate();
  const [stuck, setStuck] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setStuck(el.scrollTop > 24);
  }, []);

  // A fresh page always starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setStuck(false);
  }, [title]);

  return (
    <div className="fz-content">
      <div className={`fz-topbar ${stuck ? 'is-stuck' : ''}`}>
        {onMenuClick && (
          <button type="button" className="fz-menu-button" aria-label="Open sidebar" onClick={onMenuClick}>
            <GripIcon />
          </button>
        )}
        <div className="fz-topbar__nav">
          <button type="button" className="fz-icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
            <ChevronLeftIcon />
          </button>
          <button type="button" className="fz-icon-btn" aria-label="Forward" onClick={() => navigate(1)}>
            <ChevronRightIcon />
          </button>
        </div>
        <div className="fz-topbar__title fz-truncate">{title}</div>
        <div className="fz-topbar__spacer" />
        {actions}
      </div>

      <div className="fz-page fz-scroll fz-page-enter" ref={scrollRef} onScroll={onScroll}>
        {hero ?? (
          <header className="fz-page__header">
            <h1 className="fz-page__title">{title}</h1>
            {subtitle && <p className="fz-page__subtitle">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
