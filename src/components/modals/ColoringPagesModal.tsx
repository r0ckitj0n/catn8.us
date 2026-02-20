import React from 'react';

import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useColoringPagesAdmin } from './hooks/useColoringPagesAdmin';

import './ColoringPagesModal.css';

interface ColoringPagesModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

const TABS = [
  { key: 'categories', label: 'Categories' },
  { key: 'themes', label: 'Themes' },
  { key: 'difficulties', label: 'Difficulties' },
  { key: 'pages', label: 'Pages' },
  { key: 'generate', label: 'Generate AI Page' },
] as const;

export function ColoringPagesModal({ open, onClose, onToast }: ColoringPagesModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useColoringPagesAdmin(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade catn8-coloring-admin-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Coloring Pages</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <div className="catn8-coloring-admin-tabs" role="tablist" aria-label="Coloring settings tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={state.activeTab === tab.key ? 'catn8-coloring-admin-tab is-active' : 'catn8-coloring-admin-tab'}
                  onClick={() => state.setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {state.activeTab === 'categories' && (
              <div className="catn8-coloring-admin-grid">
                <form className="catn8-coloring-admin-form" onSubmit={(e) => {
                  e.preventDefault();
                  const action = state.categoryForm.id > 0 ? 'update_category' : 'create_category';
                  void state.postAndReload(action, state.categoryForm, 'Category saved');
                }}>
                  <h6>{state.categoryForm.id > 0 ? 'Edit Category' : 'New Category'}</h6>
                  <input className="form-control" placeholder="Slug" value={state.categoryForm.slug} onChange={(e) => state.setCategoryForm((p) => ({ ...p, slug: e.target.value }))} />
                  <input className="form-control" placeholder="Name" value={state.categoryForm.name} onChange={(e) => state.setCategoryForm((p) => ({ ...p, name: e.target.value }))} />
                  <textarea className="form-control" placeholder="Description" value={state.categoryForm.description} onChange={(e) => state.setCategoryForm((p) => ({ ...p, description: e.target.value }))} />
                  <div className="row g-2"><div className="col-6"><input className="form-control" type="number" value={state.categoryForm.sort_order} onChange={(e) => state.setCategoryForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))} /></div><div className="col-6"><select className="form-select" value={state.categoryForm.is_active} onChange={(e) => state.setCategoryForm((p) => ({ ...p, is_active: Number(e.target.value) ? 1 : 0 }))}><option value={1}>Active</option><option value={0}>Inactive</option></select></div></div>
                  <div className="d-flex gap-2"><button className="btn btn-primary" disabled={state.busy} type="submit">Save</button><button className="btn btn-outline-secondary" disabled={state.busy} type="button" onClick={state.resetCategory}>Reset</button></div>
                </form>
                <div className="catn8-coloring-admin-list">{state.data.categories.map((item) => <div className="catn8-coloring-admin-row" key={item.id}><div><strong>{item.name}</strong><div className="text-muted small">{item.slug}</div></div><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => state.editCategory(item)}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void state.postAndReload('delete_category', { id: item.id }, 'Category deleted')}>Delete</button></div></div>)}</div>
              </div>
            )}

            {state.activeTab === 'themes' && (
              <div className="catn8-coloring-admin-grid">
                <form className="catn8-coloring-admin-form" onSubmit={(e) => {
                  e.preventDefault();
                  const action = state.themeForm.id > 0 ? 'update_theme' : 'create_theme';
                  void state.postAndReload(action, state.themeForm, 'Theme saved');
                }}>
                  <h6>{state.themeForm.id > 0 ? 'Edit Theme' : 'New Theme'}</h6>
                  <select className="form-select" value={state.themeForm.category_id} onChange={(e) => state.setThemeForm((p) => ({ ...p, category_id: Number(e.target.value) || 0 }))}>{state.data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <input className="form-control" placeholder="Slug" value={state.themeForm.slug} onChange={(e) => state.setThemeForm((p) => ({ ...p, slug: e.target.value }))} />
                  <input className="form-control" placeholder="Name" value={state.themeForm.name} onChange={(e) => state.setThemeForm((p) => ({ ...p, name: e.target.value }))} />
                  <textarea className="form-control" placeholder="Description" value={state.themeForm.description} onChange={(e) => state.setThemeForm((p) => ({ ...p, description: e.target.value }))} />
                  <div className="row g-2"><div className="col-6"><input className="form-control" type="number" value={state.themeForm.sort_order} onChange={(e) => state.setThemeForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))} /></div><div className="col-6"><select className="form-select" value={state.themeForm.is_active} onChange={(e) => state.setThemeForm((p) => ({ ...p, is_active: Number(e.target.value) ? 1 : 0 }))}><option value={1}>Active</option><option value={0}>Inactive</option></select></div></div>
                  <div className="d-flex gap-2"><button className="btn btn-primary" disabled={state.busy} type="submit">Save</button><button className="btn btn-outline-secondary" disabled={state.busy} type="button" onClick={state.resetTheme}>Reset</button></div>
                </form>
                <div className="catn8-coloring-admin-list">{state.data.themes.map((item) => <div className="catn8-coloring-admin-row" key={item.id}><div><strong>{item.name}</strong><div className="text-muted small">{item.slug}</div></div><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => state.editTheme(item)}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void state.postAndReload('delete_theme', { id: item.id }, 'Theme deleted')}>Delete</button></div></div>)}</div>
              </div>
            )}

            {state.activeTab === 'difficulties' && (
              <div className="catn8-coloring-admin-grid">
                <form className="catn8-coloring-admin-form" onSubmit={(e) => {
                  e.preventDefault();
                  const action = state.difficultyForm.id > 0 ? 'update_difficulty' : 'create_difficulty';
                  void state.postAndReload(action, state.difficultyForm, 'Difficulty saved');
                }}>
                  <h6>{state.difficultyForm.id > 0 ? 'Edit Difficulty' : 'New Difficulty'}</h6>
                  <input className="form-control" placeholder="Slug" value={state.difficultyForm.slug} onChange={(e) => state.setDifficultyForm((p) => ({ ...p, slug: e.target.value }))} />
                  <input className="form-control" placeholder="Name" value={state.difficultyForm.name} onChange={(e) => state.setDifficultyForm((p) => ({ ...p, name: e.target.value }))} />
                  <textarea className="form-control" placeholder="Description" value={state.difficultyForm.description} onChange={(e) => state.setDifficultyForm((p) => ({ ...p, description: e.target.value }))} />
                  <div className="row g-2"><div className="col-4"><input className="form-control" type="number" value={state.difficultyForm.complexity_level} onChange={(e) => state.setDifficultyForm((p) => ({ ...p, complexity_level: Number(e.target.value) || 1 }))} /></div><div className="col-4"><input className="form-control" type="number" value={state.difficultyForm.sort_order} onChange={(e) => state.setDifficultyForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))} /></div><div className="col-4"><select className="form-select" value={state.difficultyForm.is_active} onChange={(e) => state.setDifficultyForm((p) => ({ ...p, is_active: Number(e.target.value) ? 1 : 0 }))}><option value={1}>Active</option><option value={0}>Inactive</option></select></div></div>
                  <div className="d-flex gap-2"><button className="btn btn-primary" disabled={state.busy} type="submit">Save</button><button className="btn btn-outline-secondary" disabled={state.busy} type="button" onClick={state.resetDifficulty}>Reset</button></div>
                </form>
                <div className="catn8-coloring-admin-list">{state.data.difficulties.map((item) => <div className="catn8-coloring-admin-row" key={item.id}><div><strong>{item.name}</strong><div className="text-muted small">{item.slug} • Level {item.complexity_level}</div></div><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => state.editDifficulty(item)}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void state.postAndReload('delete_difficulty', { id: item.id }, 'Difficulty deleted')}>Delete</button></div></div>)}</div>
              </div>
            )}

            {state.activeTab === 'pages' && (
              <div className="catn8-coloring-admin-grid">
                <form className="catn8-coloring-admin-form" onSubmit={(e) => {
                  e.preventDefault();
                  const action = state.pageForm.id > 0 ? 'update_page' : 'create_page';
                  void state.postAndReload(action, state.pageForm, 'Page saved');
                }}>
                  <h6>{state.pageForm.id > 0 ? 'Edit Page' : 'New Page'}</h6>
                  <input className="form-control" placeholder="Title" value={state.pageForm.title} onChange={(e) => state.setPageForm((p) => ({ ...p, title: e.target.value }))} />
                  <textarea className="form-control" placeholder="Description" value={state.pageForm.description} onChange={(e) => state.setPageForm((p) => ({ ...p, description: e.target.value }))} />
                  <select className="form-select" value={state.pageForm.category_id} onChange={(e) => state.setPageForm((p) => ({ ...p, category_id: Number(e.target.value) || 0 }))}>{state.data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <select className="form-select" value={state.pageForm.theme_id} onChange={(e) => state.setPageForm((p) => ({ ...p, theme_id: Number(e.target.value) || 0 }))}>{state.data.themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  <select className="form-select" value={state.pageForm.difficulty_id} onChange={(e) => state.setPageForm((p) => ({ ...p, difficulty_id: Number(e.target.value) || 0 }))}>{state.data.difficulties.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                  <input className="form-control" placeholder="Image URL" value={state.pageForm.image_url} onChange={(e) => state.setPageForm((p) => ({ ...p, image_url: e.target.value }))} />
                  <div className="d-flex gap-2"><button className="btn btn-primary" disabled={state.busy} type="submit">Save</button><button className="btn btn-outline-secondary" disabled={state.busy} type="button" onClick={state.resetPage}>Reset</button></div>
                </form>
                <div className="catn8-coloring-admin-list">{state.data.pages.map((item) => <div className="catn8-coloring-admin-row" key={item.id}><div><strong>{item.title}</strong><div className="text-muted small">{item.image_url || 'No image'}</div></div><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => state.editPage(item)}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void state.postAndReload('delete_page', { id: item.id }, 'Page deleted')}>Delete</button></div></div>)}</div>
              </div>
            )}

            {state.activeTab === 'generate' && (
              <form className="catn8-coloring-admin-form catn8-coloring-admin-generate" onSubmit={(e) => {
                e.preventDefault();
                void state.generatePage();
              }}>
                <h6>Generate Page With AI</h6>
                <input className="form-control" placeholder="Page Name" value={state.generateForm.title} onChange={(e) => state.setGenerateForm((p) => ({ ...p, title: e.target.value }))} />
                <textarea className="form-control" placeholder="Description" value={state.generateForm.description} onChange={(e) => state.setGenerateForm((p) => ({ ...p, description: e.target.value }))} />
                <select className="form-select" value={state.generateForm.category_id} onChange={(e) => state.setGenerateForm((p) => ({ ...p, category_id: Number(e.target.value) || 0 }))}>{state.data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className="form-select" value={state.generateForm.theme_id} onChange={(e) => state.setGenerateForm((p) => ({ ...p, theme_id: Number(e.target.value) || 0 }))}>{state.data.themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select className="form-select" value={state.generateForm.difficulty_id} onChange={(e) => state.setGenerateForm((p) => ({ ...p, difficulty_id: Number(e.target.value) || 0 }))}>{state.data.difficulties.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                <button type="submit" className="btn btn-primary" disabled={state.busy}>Generate and Save</button>
                <div className="small text-muted">Uses your configured AI image provider key and stores image URL, prompt, palette JSON, and regions JSON in MySQL.</div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
