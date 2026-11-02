/**
 * The five destinations at the bottom of a phone screen.
 *
 * A detail page keeps the tab you came from lit, the way iOS does, and
 * tapping the tab you are already on scrolls back to the top.
 */

import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { BrowseIcon, HomeIcon, LibraryIcon, RadioIcon, SearchIcon } from '../Icons';
import { useScrollToTop } from '../../hooks/useScroller';
import { haptic } from '../../state/ui';

const TABS = [
  { to: '/', label: 'home', icon: <HomeIcon />, match: (p: string) => p === '/' },
  { to: '/browse', label: 'browse', icon: <BrowseIcon />, match: (p: string) => p.startsWith('/browse') || p.startsWith('/genre') },
  { to: '/radio', label: 'radio', icon: <RadioIcon />, match: (p: string) => p.startsWith('/radio') },
  {
    to: '/library',
    label: 'library',
    icon: <LibraryIcon />,
    match: (p: string) => p.startsWith('/library') || p.startsWith('/stats') || p.startsWith('/settings'),
  },
  { to: '/search', label: 'search', icon: <SearchIcon />, match: (p: string) => p.startsWith('/search') },
];

export function TabBar() {
  const { pathname } = useLocation();
  const scrollToTop = useScrollToTop();
  const lastTab = useRef('/');

  const direct = TABS.find((tab) => tab.match(pathname));
  if (direct) lastTab.current = direct.to;
  const active = direct?.to ?? lastTab.current;

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((tab) => {
        const on = tab.to === active;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`tab ${on ? 'is-active' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={(event) => {
              haptic(4);
              if (on && pathname === tab.to) {
                event.preventDefault();
                scrollToTop();
              }
            }}
          >
            <span className={`led tab__led ${on ? 'is-on' : ''}`} />
            {tab.icon}
            <span className="tab__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
