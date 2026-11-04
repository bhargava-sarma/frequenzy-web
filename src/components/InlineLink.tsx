/**
 * A link that stays inline text.
 *
 * A button is an atomic inline: when a line runs out of room, the ellipsis
 * swallows the whole button, so "Artist · A Long Album Name" became
 * "Artist · …". An anchor truncates mid-name like any other text, and its
 * real href means a middle-click or ⌘-click opens a new tab.
 */

import type { MouseEvent, ReactNode } from 'react';

import { navigate } from '../lib/nav';

interface InlineLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  tabIndex?: number;
  /** Runs before navigating, e.g. to close the full player. */
  onNavigate?: () => void;
}

export function InlineLink({ to, children, className, tabIndex, onNavigate }: InlineLinkProps) {
  return (
    <a
      href={to}
      className={className}
      tabIndex={tabIndex}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        // Never let the row or display underneath act on this click as well.
        event.stopPropagation();
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export const albumPath = (id: string) => `/album/${encodeURIComponent(id)}`;
export const artistPath = (id: string) => `/artist/${encodeURIComponent(id)}`;
