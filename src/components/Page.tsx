/**
 * The frame every page sits in: a sticky top bar, a printed heading, and the
 * content. The top bar starts clear and takes over the title once the heading
 * has scrolled underneath it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { navigate } from '../lib/nav';
import { useIsCompact } from '../hooks/useLayout';
import { useRefresh, useScroller } from '../hooks/useScroller';

interface PageProps {
  title: string;
  /** Small printed label above the title. */
  eyebrow?: string;
  /** A mono line under the title: counts, durations. */
  meta?: ReactNode;
  /** Controls on the right of the top bar. */
  actions?: ReactNode;
  /** A row under the heading — filters, sort, view. */
  toolbar?: ReactNode;
  /** Replaces the standard heading (detail pages draw their own). */
  head?: ReactNode;
  /** A tab's top level on a phone: no back button. */
  root?: boolean;
  onRefresh?: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
}

function canGoBack(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx > 0 : window.history.length > 1;
}

export function Page({ title, eyebrow, meta, actions, toolbar, head, root, onRefresh, children, className = '' }: PageProps) {
  const compact = useIsCompact();
  const scroller = useScroller();
  const sentinel = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  useRefresh(onRefresh);

  useEffect(() => {
    const el = sentinel.current;
    const rootEl = scroller;
    if (!el || !rootEl || typeof IntersectionObserver === 'undefined') return;
    const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 54;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + bar),
      { root: rootEl, rootMargin: `-${bar}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scroller]);

  const showBack = compact ? !root : true;

  return (
    <div className={`page ${className}`}>
      <header className={`topbar ${stuck ? 'is-stuck' : ''}`}>
        {showBack && (
          <div className="topbar__nav">
            <button
              type="button"
              className="ibtn"
              aria-label="Back"
              onClick={() => (canGoBack() ? navigate(-1) : navigate('/'))}
            >
              <ChevronLeftIcon />
            </button>
            {!compact && (
              <button type="button" className="ibtn" aria-label="Forward" onClick={() => navigate(1)}>
                <ChevronRightIcon />
              </button>
            )}
          </div>
        )}
        <div className="topbar__title truncate" aria-hidden={!stuck}>
          {title}
        </div>
        {actions && <div className="topbar__actions">{actions}</div>}
      </header>

      {head ?? (
        <div className="page-head">
          {eyebrow && <div className="label page-head__eyebrow">{eyebrow}</div>}
          <h1 className="page-head__title">{title}</h1>
          {meta && <div className="page-head__meta meta">{meta}</div>}
        </div>
      )}
      <div ref={sentinel} className="page__sentinel" aria-hidden="true" />
      {toolbar && <div className="page-toolbar">{toolbar}</div>}
      <div className="page__body">{children}</div>
    </div>
  );
}

/** A numbered section heading with a rule running off to the right. */
export function Section({
  index, title, action, children, className = '', id,
}: {
  index?: number;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`section ${className}`} id={id}>
      <div className="section__head">
        {index !== undefined && <span className="section__index">{String(index).padStart(2, '0')}</span>}
        <h2 className="section__title">{title}</h2>
        <span className="section__rule" aria-hidden="true" />
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({
  icon, title, children, action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <div className="empty__title">{title}</div>
      {children && <div className="empty__body">{children}</div>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <Empty
      title="couldn't load this"
      action={
        onRetry ? (
          <button type="button" className="key" onClick={onRetry}>
            try again
          </button>
        ) : undefined
      }
    >
      {error?.message ?? 'The server did not answer.'}
    </Empty>
  );
}
