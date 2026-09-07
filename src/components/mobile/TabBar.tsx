/** The five destinations that live at the bottom of the screen on a phone. */

import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { BrowseIcon, ListenNowIcon, NoteIcon, RadioIcon, SearchIcon } from '../Icons';

const TABS = [
  { to: '/', label: 'Listen Now', icon: <ListenNowIcon />, end: true },
  { to: '/browse', label: 'Browse', icon: <BrowseIcon /> },
  { to: '/radio', label: 'Radio', icon: <RadioIcon /> },
  { to: '/library', label: 'Library', icon: <NoteIcon /> },
  { to: '/search', label: 'Search', icon: <SearchIcon /> },
];

export function TabBar() {
  const location = useLocation();
  const barRef = useRef<HTMLElement | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  /**
   * A highlight that travels to the active tab. Measured from the DOM rather
   * than assumed, so it stays correct whatever the labels are.
   */
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const active = bar.querySelector<HTMLElement>('.fz-tab.is-active');
    if (!active) {
      setPill(null);
      return;
    }
    setPill({ left: active.offsetLeft, width: active.offsetWidth });
  }, [location.pathname]);

  return (
    <nav className="fz-tabbar" aria-label="Sections" ref={barRef}>
      {pill && (
        <span
          className="fz-tabbar__pill"
          aria-hidden="true"
          style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
        />
      )}
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `fz-tab ${isActive ? 'is-active' : ''}`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
