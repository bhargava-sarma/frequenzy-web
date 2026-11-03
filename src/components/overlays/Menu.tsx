/**
 * The one menu.
 *
 * On a desktop it opens at the pointer or under the button that asked for it,
 * flipping away from the edges of the window; on a phone it is a sheet that
 * rises from the bottom, headed by whatever was pressed. Submenus — the list
 * of playlists, ratings, sort orders — open in place with a way back, so they
 * work the same with a mouse, a finger and a keyboard.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { Artwork } from '../Artwork';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import { useIsCompact } from '../../hooks/useLayout';
import { ui, useUI, type MenuEntry, type MenuHeader, type MenuItem, type MenuRequest } from '../../state/ui';

function isItem(entry: MenuEntry): entry is MenuItem {
  return !('separator' in entry) && !('heading' in entry);
}

interface Level {
  title?: string;
  entries: MenuEntry[];
}

function useLevels(request: MenuRequest) {
  const [levels, setLevels] = useState<Level[]>([{ entries: request.entries }]);
  useEffect(() => setLevels([{ entries: request.entries }]), [request]);
  const top = levels[levels.length - 1];
  const push = (item: MenuItem) => item.submenu && setLevels((prev) => [...prev, { title: item.label, entries: item.submenu!() }]);
  const pop = () => setLevels((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  return { top, depth: levels.length, push, pop };
}

/** Run an item: open its submenu, or do it and close. */
function choose(item: MenuItem, push: (item: MenuItem) => void) {
  if (item.disabled) return;
  if (item.submenu) {
    push(item);
    return;
  }
  ui.closeMenu();
  item.onSelect?.();
}

export function MenuHost() {
  const menu = useUI((s) => s.menu);
  const compact = useIsCompact();
  if (!menu) return null;
  return compact ? <ActionSheet request={menu} /> : <FloatingMenu request={menu} />;
}

/* ------------------------------------------------------------ desktop */

function FloatingMenu({ request }: { request: MenuRequest }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { top, depth, push, pop } = useLevels(request);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  const [active, setActive] = useState(-1);

  const items = top.entries;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = request.x;
    let topY = request.y;
    let originX = 'left';
    let originY = 'top';
    if (request.anchor) {
      left = request.anchor.left;
      topY = request.anchor.bottom + 6;
      if (left + rect.width > vw - margin) {
        left = Math.max(margin, request.anchor.right - rect.width);
        originX = 'right';
      }
      if (topY + rect.height > vh - margin) {
        const above = request.anchor.top - 6 - rect.height;
        topY = above >= margin ? above : Math.max(margin, vh - margin - rect.height);
        originY = 'bottom';
      }
    } else {
      if (left + rect.width > vw - margin) {
        left = Math.max(margin, request.x - rect.width);
        originX = 'right';
      }
      if (topY + rect.height > vh - margin) {
        topY = Math.max(margin, request.y - rect.height);
        originY = 'bottom';
      }
    }
    setPos({ left, top: topY, origin: `${originY} ${originX}` });
    // Re-measure when a submenu changes the height.
  }, [request, depth]);

  useEffect(() => {
    setActive(-1);
    ref.current?.focus({ preventScroll: true });
  }, [top]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) ui.closeMenu();
    };
    const close = () => ui.closeMenu();
    // Deferred, so the click that opened the menu does not close it.
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', onDown, true);
    }, 0);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    const onWheel = (event: WheelEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  const enabled = items.map((entry, i) => (isItem(entry) && !entry.disabled ? i : -1)).filter((i) => i >= 0);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (enabled.length === 0) return;
      const at = enabled.indexOf(active);
      const next =
        event.key === 'ArrowDown'
          ? enabled[(at + 1 + enabled.length) % enabled.length]
          : enabled[(at - 1 + enabled.length) % enabled.length];
      setActive(at === -1 && event.key === 'ArrowUp' ? enabled[enabled.length - 1] : next);
    } else if (event.key === 'Enter' || event.key === ' ' || (event.key === 'ArrowRight' && active >= 0)) {
      const entry = items[active];
      if (entry && isItem(entry)) {
        event.preventDefault();
        if (event.key === 'ArrowRight' && !entry.submenu) return;
        choose(entry, push);
      }
    } else if ((event.key === 'ArrowLeft' || event.key === 'Backspace') && depth > 1) {
      event.preventDefault();
      pop();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (depth > 1) pop();
      else ui.closeMenu();
    } else if (event.key === 'Tab') {
      event.preventDefault();
    }
  };

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={
        pos
          ? { left: pos.left, top: pos.top, transformOrigin: pos.origin }
          : { left: request.x, top: request.y, visibility: 'hidden' }
      }
    >
      {request.header && depth === 1 && <MenuHeaderRow header={request.header} />}
      {depth > 1 && (
        <button type="button" className="menu__back" onClick={pop}>
          <ChevronLeftIcon />
          <span className="truncate">{top.title}</span>
        </button>
      )}
      <div className="menu__items">
        {items.map((entry, i) => (
          <MenuRow key={entry.id} entry={entry} active={i === active} onHover={() => setActive(i)} onChoose={(item) => choose(item, push)} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function MenuHeaderRow({ header }: { header: MenuHeader }) {
  return (
    <div className="menu__header">
      {header.coverArt !== undefined && (
        <Artwork coverArt={header.coverArt} name={header.title} size={36} round={header.round} className="menu__header-art" />
      )}
      <div className="menu__header-text">
        <div className="menu__header-title truncate">{header.title}</div>
        {header.subtitle && <div className="menu__header-sub truncate">{header.subtitle}</div>}
      </div>
    </div>
  );
}

function MenuRow({
  entry, active, onHover, onChoose,
}: {
  entry: MenuEntry;
  active: boolean;
  onHover: () => void;
  onChoose: (item: MenuItem) => void;
}) {
  if ('separator' in entry) return <div className="menu__sep" role="separator" />;
  if ('heading' in entry) return <div className="menu__heading label">{entry.label}</div>;
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu__item ${active ? 'is-active' : ''} ${entry.danger ? 'is-danger' : ''}`}
      disabled={entry.disabled}
      aria-haspopup={entry.submenu ? 'menu' : undefined}
      onPointerEnter={onHover}
      onClick={() => onChoose(entry)}
    >
      <span className="menu__icon">{entry.icon}</span>
      <span className="menu__label truncate">{entry.label}</span>
      {entry.checked && <CheckIcon className="menu__check" />}
      {entry.hint && <span className="menu__hint">{entry.hint}</span>}
      {entry.submenu && <ChevronRightIcon className="menu__chev" />}
    </button>
  );
}

/* ----------------------------------------------------------------- phone */

function ActionSheet({ request }: { request: MenuRequest }) {
  const { top, depth, push, pop } = useLevels(request);
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => ui.closeMenu(), 190);
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  const run = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.submenu) {
      push(item);
      return;
    }
    setClosing(true);
    setTimeout(() => {
      ui.closeMenu();
      item.onSelect?.();
    }, 140);
  };

  return createPortal(
    <div
      className={`sheet-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className={`sheet ${closing ? 'is-closing' : ''}`} role="menu">
        <div className="sheet__grip" aria-hidden="true" />
        {request.header && depth === 1 && (
          <div className="sheet__header">
            {request.header.coverArt !== undefined && (
              <Artwork
                coverArt={request.header.coverArt}
                name={request.header.title}
                size={48}
                round={request.header.round}
                className="sheet__art"
              />
            )}
            <div className="sheet__header-text">
              <div className="sheet__title truncate">{request.header.title}</div>
              {request.header.subtitle && <div className="sheet__sub truncate">{request.header.subtitle}</div>}
            </div>
          </div>
        )}
        {depth > 1 && (
          <button type="button" className="sheet__back" onClick={pop}>
            <ChevronLeftIcon />
            <span className="truncate">{top.title}</span>
          </button>
        )}
        <div className="sheet__items">
          {top.entries.map((entry) => {
            if ('separator' in entry) return <div key={entry.id} className="sheet__sep" />;
            if ('heading' in entry) {
              return (
                <div key={entry.id} className="sheet__heading label">
                  {entry.label}
                </div>
              );
            }
            return (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                className={`sheet__item ${entry.danger ? 'is-danger' : ''}`}
                onClick={() => run(entry)}
              >
                <span className="sheet__icon">{entry.icon}</span>
                <span className="sheet__label truncate">{entry.label}</span>
                {entry.checked && <CheckIcon className="sheet__check" />}
                {entry.hint && <span className="sheet__hint">{entry.hint}</span>}
                {entry.submenu && <ChevronRightIcon className="sheet__chev" />}
              </button>
            );
          })}
        </div>
        <button type="button" className="sheet__cancel key key--lg" onClick={dismiss}>
          cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
