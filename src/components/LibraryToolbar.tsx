/**
 * The sort / filter / density controls that sit in a library page's title bar.
 *
 * Sorting is a menu rather than a row of buttons because the list of options is
 * long enough to crowd a phone, and the current choice reads better as a label.
 */

import { useContextMenu, type MenuEntry } from './ContextMenu';
import { CheckIcon, GridIcon, ListIcon, SortIcon } from './Icons';
import { useSettings } from '../state/settings';

export interface SortOption<T extends string> {
  id: T;
  label: string;
}

interface LibraryToolbarProps<T extends string> {
  sorts?: SortOption<T>[];
  sort?: T;
  onSortChange?: (sort: T) => void;
  /** Free-text filter applied to whatever the page is listing. */
  filter?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  showViewToggle?: boolean;
}

export function LibraryToolbar<T extends string>({
  sorts,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  filterPlaceholder = 'Filter',
  showViewToggle,
}: LibraryToolbarProps<T>) {
  const { settings, update } = useSettings();
  const { openAt, menu } = useContextMenu();

  const entries: MenuEntry[] = [
    { id: 'head', label: 'Sort By', heading: true },
    ...(sorts ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      icon: sort === option.id ? <CheckIcon /> : undefined,
      onSelect: () => onSortChange?.(option.id),
    })),
  ];

  const current = sorts?.find((option) => option.id === sort);

  return (
    <>
      {onFilterChange && (
        <div className="fz-input fz-toolbar-filter">
          <SortIcon style={{ transform: 'scaleY(0.8)' }} />
          <input
            type="search"
            value={filter ?? ''}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            onChange={(event) => onFilterChange(event.target.value)}
          />
        </div>
      )}

      {sorts && sorts.length > 0 && (
        <button
          type="button"
          className="fz-btn"
          aria-label="Sort"
          onClick={(event) => openAt(event.currentTarget, entries)}
        >
          <SortIcon />
          <span className="fz-toolbar-sortlabel">{current?.label ?? 'Sort'}</span>
        </button>
      )}

      {showViewToggle && (
        <div className="fz-segmented" role="group" aria-label="View">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={settings.libraryView === 'grid'}
            className={settings.libraryView === 'grid' ? 'is-active' : ''}
            onClick={() => update({ libraryView: 'grid' })}
          >
            <GridIcon style={{ width: 15, height: 15 }} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={settings.libraryView === 'list'}
            className={settings.libraryView === 'list' ? 'is-active' : ''}
            onClick={() => update({ libraryView: 'list' })}
          >
            <ListIcon style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}
      {menu}
    </>
  );
}
