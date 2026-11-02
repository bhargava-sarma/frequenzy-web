/**
 * The side panel on a desktop: the queue, the lyrics, or the details of what
 * is playing, beside whatever page you are on. Wide windows give it a column
 * of its own; narrower ones float it over the page.
 */

import { CloseIcon, InfoIcon, LyricsIcon, QueueIcon } from '../Icons';
import { LyricsView } from '../player/LyricsView';
import { QueueList } from '../player/QueueList';
import { TrackDetails } from '../TrackDetails';
import { useIsWide } from '../../hooks/useLayout';
import { usePlayer } from '../../state/player';
import { ui, useUI, type InspectorPanel } from '../../state/ui';

const TABS: { id: InspectorPanel; label: string; icon: JSX.Element }[] = [
  { id: 'queue', label: 'queue', icon: <QueueIcon /> },
  { id: 'lyrics', label: 'lyrics', icon: <LyricsIcon /> },
  { id: 'info', label: 'info', icon: <InfoIcon /> },
];

export function Inspector() {
  const panel = useUI((s) => s.inspector);
  const wide = useIsWide();
  const current = usePlayer((s) => s.current);
  if (!panel) return null;

  return (
    <>
      {!wide && <div className="inspector-scrim" onClick={() => ui.setInspector(null)} />}
      <aside className={`inspector ${wide ? 'inspector--docked' : 'inspector--floating'}`} aria-label="Side panel">
        <div className="inspector__tabs">
          <div className="seg seg--sm" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={panel === tab.id}
                className={panel === tab.id ? 'is-active' : ''}
                onClick={() => ui.setInspector(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <button type="button" className="ibtn ibtn--sm" aria-label="Close the panel" onClick={() => ui.setInspector(null)}>
            <CloseIcon />
          </button>
        </div>
        <div className="inspector__body">
          {panel === 'queue' && <QueueList variant="panel" />}
          {panel === 'lyrics' &&
            (current && !current.isRadio ? (
              <LyricsView key={current.id} song={current} variant="panel" />
            ) : (
              <div className="inspector__empty">{current ? 'radio has no lyrics' : 'nothing playing'}</div>
            ))}
          {panel === 'info' &&
            (current ? (
              <div className="inspector__scroll">
                <TrackDetails key={current.id} song={current} compact />
              </div>
            ) : (
              <div className="inspector__empty">nothing playing</div>
            ))}
        </div>
      </aside>
    </>
  );
}
