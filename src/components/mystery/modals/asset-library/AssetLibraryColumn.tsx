import React from 'react';

export function AssetLibraryColumn({
  title,
  type,
  items,
  isAdmin,
  busy,
  loader,
  newVal,
  setNewVal,
  upserter,
  placeholder,
  getMasterAssetNameDraft,
  updateMasterAssetNameDraft,
  saveMasterAssetInlineName,
  masterAssetsIncludeArchived,
  requestMasterAssetDelete,
  openMasterAssetDetails,
  setMasterAssetRegenLock,
  archiveMasterAsset,
  trashSvg,
  pencilSvg,
  lockSvg,
  unlockSvg,
}: any) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <div className="catn8-card catn8-mystery-roster-card p-2 h-100">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div>
            <div className="fw-bold">{title}</div>
            <div className="form-text">Shared roster across all cases.</div>
          </div>
          {isAdmin ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loader} disabled={busy}>Refresh</button> : null}
        </div>
        {isAdmin ? (
          <form className="row g-2 mt-3" onSubmit={upserter}>
            <div className="col-8"><input className="form-control" value={newVal.name} onChange={(e) => setNewVal({ name: e.target.value })} disabled={busy} placeholder={placeholder} /></div>
            <div className="col-4"><button type="submit" className="btn btn-primary w-100" disabled={busy}>Add</button></div>
          </form>
        ) : null}
        <div className="table-responsive mt-3">
          <table className="table table-sm align-middle">
            <thead><tr><th>Name</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    <input className="form-control form-control-sm" value={getMasterAssetNameDraft({ type, id: item.id, fallback: item.name })} onChange={(e) => updateMasterAssetNameDraft({ type, id: item.id, value: e.target.value })} onBlur={() => saveMasterAssetInlineName({ type, item })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} disabled={busy || !isAdmin} />
                    {Number(item.is_archived || 0) ? <div className="form-text">Archived</div> : null}
                  </td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm" role="group">
                      {isAdmin ? (
                        <>
                          {masterAssetsIncludeArchived && Number(item.is_archived || 0)
                            ? <button type="button" className="btn btn-outline-danger" onClick={() => requestMasterAssetDelete({ type, item })} disabled={busy} title="Delete permanently">{trashSvg}</button>
                            : <button type="button" className="btn btn-outline-secondary" onClick={() => openMasterAssetDetails({ type, item })} disabled={busy} title="Edit details">{pencilSvg}</button>}
                          <button type="button" className={Number(item.is_case_locked || 0) ? 'btn btn-outline-danger' : (Number(item.is_regen_locked || 0) ? 'btn btn-outline-warning' : 'btn btn-outline-secondary')} onClick={() => { if (!Number(item.is_case_locked || 0)) setMasterAssetRegenLock({ type, item, is_regen_locked: Number(item.is_regen_locked || 0) ? 0 : 1 }); }} disabled={busy || Boolean(Number(item.is_case_locked || 0))}>
                            {Number(item.is_case_locked || 0) ? <span className="text-danger">{lockSvg}</span> : (Number(item.is_regen_locked || 0) ? lockSvg : unlockSvg)}
                          </button>
                          <button type="button" className={Number(item.is_archived || 0) ? 'btn btn-outline-success' : 'btn btn-outline-danger'} onClick={() => archiveMasterAsset({ type, id: item.id, is_archived: Number(item.is_archived || 0) ? 0 : 1 })} disabled={busy}>{Number(item.is_archived || 0) ? 'Restore' : 'Archive'}</button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-outline-secondary" onClick={() => openMasterAssetDetails({ type, item })} disabled={busy} title="View details"><i className="bi bi-eye"></i></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length ? <tr><td colSpan={2} className="text-muted">{isAdmin ? `No master ${type}s yet.` : 'Not available.'}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
