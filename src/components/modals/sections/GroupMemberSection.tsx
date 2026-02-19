import React from 'react';

interface GroupMemberSectionProps {
  busy: boolean;
  groupSlug: string;
  availableUsers: any[];
  addUserId: string;
  setAddUserId: (v: string) => void;
  members: any[];
  addMember: (e: React.FormEvent) => Promise<void>;
  removeMember: (uid: number) => Promise<void>;
  load: (slug: string) => Promise<void>;
}

export function GroupMemberSection({
  busy,
  groupSlug,
  availableUsers,
  addUserId,
  setAddUserId,
  members,
  addMember,
  removeMember,
  load
}: GroupMemberSectionProps) {
  return (
    <>
      <form onSubmit={addMember} className="mb-3">
        <label className="form-label" htmlFor="group-access-add">Add user to group</label>
        <div className="d-flex gap-2">
          <select
            id="group-access-add"
            className="form-select"
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            disabled={busy || !groupSlug || !availableUsers.length}
          >
            <option value="">Select user...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.username} ({u.email})
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={busy || !groupSlug || !Number(addUserId)}>
            Add
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => void load(groupSlug)} disabled={busy}>
            Refresh
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Admin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.is_admin ? 'Yes' : 'No'}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void removeMember(u.id)} disabled={busy}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!members.length && (
              <tr>
                <td colSpan={5} className="text-muted text-center py-3">
                  No members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
