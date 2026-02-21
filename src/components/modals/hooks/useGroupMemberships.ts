import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { BrandedConfirmFn } from '../../../hooks/useBrandedConfirm';

export function useGroupMemberships(open: boolean, confirm: BrandedConfirmFn, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groupSlug, setGroupSlug] = React.useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [addUserId, setAddUserId] = React.useState('');

  const [newGroupSlug, setNewGroupSlug] = React.useState('');
  const [newGroupTitle, setNewGroupTitle] = React.useState('');
  const [editGroupId, setEditGroupId] = useState<number>(0);
  const [editGroupSlug, setEditGroupSlug] = React.useState('');
  const [editGroupTitle, setEditGroupTitle] = React.useState('');

  const loadUsers = async () => {
    const res = await ApiClient.get('/api/settings/users.php?action=list');
    return Array.isArray(res?.users) ? res.users : [];
  };

  const loadGroups = async () => {
    const res = await ApiClient.get('/api/settings/groups.php?action=list_groups');
    return Array.isArray(res?.groups) ? res.groups : [];
  };

  const loadMembers = async (slug: string) => {
    const res = await ApiClient.get('/api/settings/groups.php?action=list_members&group_slug=' + encodeURIComponent(String(slug)));
    return Array.isArray(res?.members) ? res.members : [];
  };

  const load = React.useCallback(async (slug: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const glist = await loadGroups();
      setGroups(glist);
      const nextSlug = String(slug || (glist[0]?.slug || '') || '');
      if (!nextSlug) {
        setMembers([]);
        setUsers([]);
        return;
      }
      if (groupSlug !== nextSlug) {
        setGroupSlug(nextSlug);
      }

      const list = await loadUsers();
      setUsers(list);
      const m = await loadMembers(nextSlug);
      setMembers(m);
      const memberIds = new Set(m.map((u) => Number(u?.id || 0)));
      const pick = list.find((u) => !memberIds.has(Number(u?.id || 0)));
      setAddUserId(pick ? String(pick.id) : '');

      const g = glist.find((x: any) => String(x?.slug || '') === nextSlug);
      setEditGroupId(Number(g?.id || 0));
      setEditGroupSlug(String(g?.slug || ''));
      setEditGroupTitle(String(g?.title || ''));
    } catch (e: any) {
      setError(e?.message || 'Failed to load group memberships');
    } finally {
      setBusy(false);
    }
  }, [groupSlug]);

  React.useEffect(() => {
    if (open) {
      load(groupSlug);
    }
  }, [open, load, groupSlug]);

  React.useEffect(() => {
    if (error && onToast) {
      onToast({ tone: 'error', message: error });
      setError('');
    }
  }, [error, onToast]);

  React.useEffect(() => {
    if (message && onToast) {
      onToast({ tone: 'success', message: message });
      setMessage('');
    }
  }, [message, onToast]);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/groups.php?action=create_group', {
        slug: newGroupSlug.trim(),
        title: newGroupTitle.trim(),
      });
      setNewGroupSlug('');
      setNewGroupTitle('');
      setMessage('Group created.');
      await load(groupSlug);
    } catch (err: any) {
      setError(err?.message || 'Create group failed');
      setBusy(false);
    }
  };

  const updateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupId) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/groups.php?action=update_group', {
        id: editGroupId,
        slug: editGroupSlug.trim(),
        title: editGroupTitle.trim(),
      });
      setMessage('Group updated.');
      await load(editGroupSlug.trim());
    } catch (err: any) {
      setError(err?.message || 'Update group failed');
      setBusy(false);
    }
  };

  const deleteGroup = async () => {
    if (!editGroupId) return;
    const confirmed = await confirm({
      title: 'Delete Group?',
      message: 'Are you sure you want to delete this group?',
      confirmLabel: 'Delete Group',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/groups.php?action=delete_group', { id: editGroupId });
      setMessage('Group deleted.');
      setGroupSlug('');
      await load('');
    } catch (err: any) {
      setError(err?.message || 'Delete group failed');
      setBusy(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = Number(addUserId);
    if (!uid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/groups.php?action=add_member', { group_slug: groupSlug, user_id: uid });
      setMessage('Added.');
      await load(groupSlug);
    } catch (err: any) {
      setError(err?.message || 'Add failed');
      setBusy(false);
    }
  };

  const removeMember = async (uid: number) => {
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/groups.php?action=remove_member', { group_slug: groupSlug, user_id: Number(uid) });
      setMessage('Removed.');
      await load(groupSlug);
    } catch (err: any) {
      setError(err?.message || 'Remove failed');
      setBusy(false);
    }
  };

  const memberIds = React.useMemo(() => new Set(members.map((m) => Number(m?.id || 0))), [members]);
  const availableUsers = React.useMemo(() => users.filter((u) => !memberIds.has(Number(u?.id || 0))), [users, memberIds]);

  return {
    busy, groups, groupSlug, setGroupSlug, members, addUserId, setAddUserId,
    newGroupSlug, setNewGroupSlug, newGroupTitle, setNewGroupTitle,
    editGroupId, editGroupSlug, setEditGroupSlug, editGroupTitle, setEditGroupTitle,
    availableUsers, load, createGroup, updateGroup, deleteGroup, addMember, removeMember
  };
}
