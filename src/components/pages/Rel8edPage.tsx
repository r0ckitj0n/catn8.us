import React from 'react';

import { NavBar } from '../layout/NavBar';
import { PedigreeChart } from '../rel8ed/PedigreeChart';
import { PersonProfile } from '../rel8ed/PersonProfile';
import { MigrationMap } from '../rel8ed/MigrationMap';
import { Rel8edHomePanels } from '../rel8ed/Rel8edHomePanels';
import { Rel8edDnaPanel } from '../rel8ed/Rel8edDnaPanel';
import { Rel8edImportPanel } from '../rel8ed/Rel8edImportPanel';
import { Rel8edSearchPanel } from '../rel8ed/Rel8edSearchPanel';
import {
  Rel8edAuditPanel,
  Rel8edGalleryPanel,
  Rel8edQualityPanel,
  Rel8edRelatePanel,
  Rel8edStoriesPanel,
} from '../rel8ed/Rel8edSidePanels';
import { useRel8ed } from '../../hooks/useRel8ed';
import type { SharedLayoutProps } from '../../entries/appConfig';
import './Rel8edPage.css';

type ToastFn = (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
type Props = SharedLayoutProps & { onToast?: ToastFn };
type Tab =
  | 'home' | 'tree' | 'person' | 'search' | 'map' | 'relate'
  | 'quality' | 'dna' | 'stories' | 'gallery' | 'import' | 'audit';

const TABS: Array<[Tab, string]> = [
  ['home', 'Home'], ['tree', 'Tree'], ['person', 'Person'], ['search', 'Search'],
  ['map', 'Map'], ['relate', 'Relate'], ['quality', 'Quality'], ['dna', 'DNA'],
  ['stories', 'Stories'], ['gallery', 'Gallery'], ['import', 'Import'],
];

export function Rel8edPage({ viewer, isAdmin, onLoginClick, onLogout, onAccountClick, onToast }: Props) {
  const r = useRel8ed();
  const [tab, setTab] = React.useState<Tab>('home');
  const [query, setQuery] = React.useState('');
  const [fromId, setFromId] = React.useState('');
  const [toId, setToId] = React.useState('');
  const [noteBody, setNoteBody] = React.useState('');
  const [noteTitle, setNoteTitle] = React.useState('');

  const toast = (tone: 'success' | 'error' | 'info' | 'warning', message: string) => onToast?.({ tone, message });
  const canEdit = Boolean(isAdmin || Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_rel8ed_user || 0) === 1);
  const showAdmin = isAdmin || r.isAdmin;

  React.useEffect(() => {
    void (async () => {
      try {
        await r.bootstrap();
        await r.loadDashboard();
        await r.loadPedigree();
        await r.searchPeople();
      } catch {
        // surfaced via hook
      }
    })();
  }, []);

  React.useEffect(() => {
    if (tab === 'map') void r.loadMap().catch(() => undefined);
    if (tab === 'dna') void r.loadDna().catch(() => undefined);
    if (tab === 'quality') void r.loadQuality().catch(() => undefined);
    if (tab === 'stories') void r.loadStories().catch(() => undefined);
    if (tab === 'gallery') void r.loadMedia().catch(() => undefined);
    if (tab === 'search') void r.loadSurnames().catch(() => undefined);
    if (tab === 'audit' && showAdmin) void r.loadAudit().catch((err) => toast('error', err.message));
  }, [tab]);

  const openPerson = async (id: number) => {
    try {
      await r.loadPerson(id);
      setTab('person');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Load failed');
    }
  };

  const dash = r.dashboard;
  const tabItems = showAdmin ? [...TABS, ['audit', 'Audit'] as [Tab, string]] : TABS;

  return (
    <div className="rel8ed-page">
      <NavBar
        active="rel8ed"
        viewer={viewer}
        isAdmin={isAdmin}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
      />
      <div className="rel8ed-shell">
        <header className="rel8ed-hero">
          <div>
            <p className="rel8ed-kicker">Rel8r · private family tree</p>
            <h1>REL8ED</h1>
            <p>Ancestors, sources, places, and stories — private to this household.</p>
          </div>
          <div className="rel8ed-stats">
            <span>{dash?.counts?.people ?? 0} people</span>
            <span>{dash?.counts?.families ?? 0} families</span>
            <span>{dash?.counts?.sources ?? 0} sources</span>
            <span>{dash?.counts?.quality_flags ?? 0} flags</span>
          </div>
        </header>

        <nav className="rel8ed-tabs" aria-label="Rel8ed sections">
          {tabItems.map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>

        {r.error ? <div className="rel8ed-error">{r.error}</div> : null}
        {r.loading ? <div className="rel8ed-loading">Loading…</div> : null}

        {tab === 'home' ? (
          <Rel8edHomePanels
            dashboard={dash}
            onOpenPerson={(id) => void openPerson(id)}
            onSurname={(surname) => {
              setTab('search');
              void r.searchPeople('', surname);
            }}
          />
        ) : null}

        {tab === 'tree' ? (
          <section className="rel8ed-section rel8ed-print">
            <h2>Pedigree</h2>
            <PedigreeChart root={r.pedigree} onSelect={(id) => void openPerson(id)} />
          </section>
        ) : null}

        {tab === 'person' ? (
          <PersonProfile
            person={r.selectedPerson}
            canEdit={canEdit}
            onSetRoot={(id) => void r.setRoot(id).then(() => toast('success', 'Root updated')).catch((e) => toast('error', e.message))}
          />
        ) : null}

        {tab === 'search' ? (
          <Rel8edSearchPanel
            query={query}
            onQueryChange={setQuery}
            onSearch={() => { void r.searchPeople(query).catch((err) => toast('error', err.message)); }}
            people={r.people}
            peopleTotal={r.peopleTotal}
            surnames={r.surnames}
            onOpenPerson={(id) => void openPerson(id)}
            onSurname={(surname) => void r.searchPeople('', surname)}
          />
        ) : null}

        {tab === 'map' ? (
          <section className="rel8ed-section">
            <h2>Migration map</h2>
            <MigrationMap
              places={r.places}
              canGeocode={showAdmin}
              onGeocode={() => void r.geocode(8).then(() => toast('info', 'Geocode batch finished')).catch((e) => toast('error', e.message))}
            />
          </section>
        ) : null}

        {tab === 'relate' ? (
          <Rel8edRelatePanel
            fromId={fromId}
            toId={toId}
            onFrom={setFromId}
            onTo={setToId}
            onSubmit={() => {
              void r.calcRelation(Number(fromId), Number(toId))
                .then(() => toast('success', 'Calculated'))
                .catch((err) => toast('error', err.message));
            }}
            result={r.relationResult}
          />
        ) : null}

        {tab === 'quality' ? <Rel8edQualityPanel rows={r.quality} /> : null}

        {tab === 'dna' ? (
          <Rel8edDnaPanel
            regions={r.dna?.regions || []}
            communities={r.dna?.communities || []}
            isAdmin={showAdmin}
          />
        ) : null}

        {tab === 'stories' ? (
          <Rel8edStoriesPanel
            canEdit={canEdit}
            noteTitle={noteTitle}
            noteBody={noteBody}
            onTitle={setNoteTitle}
            onBody={setNoteBody}
            onSubmit={() => {
              void r.addNote(noteBody, r.selectedPerson?.id, true, noteTitle)
                .then(() => {
                  setNoteBody('');
                  setNoteTitle('');
                  toast('success', 'Story saved');
                })
                .catch((err) => toast('error', err.message));
            }}
            stories={r.stories}
          />
        ) : null}

        {tab === 'gallery' ? (
          <Rel8edGalleryPanel
            canEdit={canEdit}
            media={r.media}
            onUpload={(file) => {
              void r.uploadMedia(file, file.name, r.selectedPerson?.id)
                .then(() => toast('success', 'Uploaded'))
                .catch((err) => toast('error', err.message));
            }}
          />
        ) : null}

        {tab === 'import' ? (
          <Rel8edImportPanel
            importPreview={r.importPreview}
            onPreviewFile={(file) => {
              void r.previewImport(file)
                .then(() => toast('info', 'Diff ready — review then apply'))
                .catch((err) => toast('error', err.message));
            }}
            onApply={(importId) => {
              void r.applyImport(importId)
                .then((res) => toast('success', `Applied (${JSON.stringify(res.counts)})`))
                .catch((err) => toast('error', err.message));
            }}
            onCancel={() => r.setImportPreview(null)}
          />
        ) : null}

        {tab === 'audit' ? <Rel8edAuditPanel rows={r.audit} /> : null}
      </div>
    </div>
  );
}
