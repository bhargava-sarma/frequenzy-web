/** Filter, sort and view controls for a library page. */

import type { ReactNode } from 'react';

import { Segmented } from './controls';
import { CloseIcon, FilterIcon, GridIcon, ListIcon, SortIcon } from './Icons';
import { updateSettings, useSettings } from '../state/settings';
import { ui } from '../state/ui';

export interface SortOption<T extends string> {
  id: T;
  label: string;
}

interface ToolbarProps<T extends string> {
  filter?: string;
  onFilter?: (value: string) => void;
  placeholder?: string;
  sorts?: SortOption<T>[];
  sort?: T;
  onSort?: (sort: T) => void;
  view?: boolean;
  size?: boolean;
  children?: ReactNode;
}

export function Toolbar<T extends string>({
  filter, onFilter, placeholder = 'filter', sorts, sort, onSort, view, size, children,
}: ToolbarProps<T>) {
  const libraryView = useSettings((s) => s.libraryView);
  const gridSize = useSettings((s) => s.gridSize);
  const current = sorts?.find((option) => option.id === sort);

  return (
    <div className="toolbar">
      {onFilter && (
        <div className="input toolbar__filter">
          <FilterIcon />
          <input
            type="search"
            value={filter ?? ''}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && filter) {
                event.stopPropagation();
                onFilter('');
              }
            }}
          />
          {filter && (
            <button type="button" className="ibtn ibtn--sm" aria-label="Clear the filter" onClick={() => onFilter('')}>
              <CloseIcon />
            </button>
          )}
        </div>
      )}
      {sorts && onSort && (
        <button
          type="button"
          className="key key--sm"
          onClick={(event) =>
            ui.openMenu(
              [
                { id: 'h', label: 'sort by', heading: true },
                ...sorts.map((option) => ({
                  id: option.id,
                  label: option.label,
                  checked: option.id === sort,
                  onSelect: () => onSort(option.id),
                })),
              ],
              event.currentTarget,
            )
          }
        >
          <SortIcon /> {current?.label ?? 'sort'}
        </button>
      )}
      {children}
      <span className="toolbar__spacer" />
      {size && libraryView === 'grid' && (
        <Segmented
          label="Card size"
          mono
          small
          value={gridSize}
          onChange={(value) => updateSettings({ gridSize: value })}
          options={[
            { value: 's', label: 's' },
            { value: 'm', label: 'm' },
            { value: 'l', label: 'l' },
          ]}
        />
      )}
      {view && (
        <Segmented
          label="View"
          small
          value={libraryView}
          onChange={(value) => updateSettings({ libraryView: value })}
          options={[
            { value: 'grid', label: <GridIcon />, title: 'Grid' },
            { value: 'list', label: <ListIcon />, title: 'List' },
          ]}
        />
      )}
    </div>
  );
}
