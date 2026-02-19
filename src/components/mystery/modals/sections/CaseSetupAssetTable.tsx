import React from 'react';

interface CaseSetupAssetTableProps {
  title: string;
  items: any[];
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  busy: boolean;
  isAdmin: boolean;
  scenarioId: string;
}

export function CaseSetupAssetTable({
  title, items, selectedIds, setSelectedIds, busy, isAdmin, scenarioId
}: CaseSetupAssetTableProps) {
  return (
    <div className="col-lg-6">
      <div className="fw-bold">{title}</div>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th style={{ width: 42 }}></th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const id = Number(item.id);
              const checked = selectedIds.includes(id);
              return (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={checked}
                      disabled={busy || !scenarioId || !isAdmin}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSelectedIds((prev) => {
                          const s = new Set(prev);
                          if (on) s.add(id);
                          else s.delete(id);
                          return Array.from(s);
                        });
                      }}
                    />
                  </td>
                  <td title={item.slug ? ('Slug: ' + String(item.slug)) : ''}>{item.name}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={2} className="text-muted text-center py-2">No items found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
