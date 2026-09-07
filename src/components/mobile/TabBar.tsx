/** The five destinations that live at the bottom of the screen on a phone. */

import { NavLink } from 'react-router-dom';

import { BrowseIcon, ListenNowIcon, NoteIcon, RadioIcon, SearchIcon } from '../Icons';

const TABS = [
  { to: '/', label: 'Listen Now', icon: <ListenNowIcon />, end: true },
  { to: '/browse', label: 'Browse', icon: <BrowseIcon /> },
  { to: '/radio', label: 'Radio', icon: <RadioIcon /> },
  { to: '/library', label: 'Library', icon: <NoteIcon /> },
  { to: '/search', label: 'Search', icon: <SearchIcon /> },
];

export function TabBar() {
  return (
    <nav className="fz-tabbar" aria-label="Sections">
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
