import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { BrandedConfirmFn } from '../../../hooks/useBrandedConfirm';

export function useUserAccounts(open: boolean, confirm: BrandedConfirmFn, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [users, setUsers] = useState<any[]>([]);

  const [createUsername, setCreateUsername] = React.useState('');
  const [createEmail, setCreateEmail] = React.useState('');
  const [createPassword, setCreatePassword] = React.useState('');
  const [createIsAdmin, setCreateIsAdmin] = React.useState(false);
  const [createIsActive, setCreateIsActive] = React.useState(true);

  const [editUserId, setEditUserId] = useState<number>(0);
  const [editUsername, setEditUsername] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [pwUserId, setPwUserId] = useState<number>(0);
  const [pwValue, setPwValue] = React.useState('');

  const load = React.useCallback(() => {
    setBusy(true);
    setError('');
    setMessage('');
    ApiClient.get('/api/settings/users.php?action=list')
      .then((res) => setUsers(Array.isArray(res?.users) ? res.users : []))
      .catch((e) => setError(e?.message || 'Failed to load users'))
      .finally(() => setBusy(false));
  }, []);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  React.useEffect(() => {
    if (error && onToast) {
      onToast({ tone: 'error', message: String(error) });
      setError('');
    }
  }, [error, onToast]);

  React.useEffect(() => {
    if (message && onToast) {
      onToast({ tone: 'success', message: String(message) });
      setMessage('');
    }
  }, [message, onToast]);

  const toggle = async (id: number, field: string, value: any) => {
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/users.php?action=update', { id, field, value });
      load();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
      setBusy(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/users.php?action=create_user', {
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
        is_admin: createIsAdmin ? 1 : 0,
        is_active: createIsActive ? 1 : 0,
      });
      setCreateUsername('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateIsAdmin(false);
      setCreateIsActive(true);
      setMessage('User created.');
      load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
      setBusy(false);
    }
  };

  const startEdit = (u: any) => {
    setEditUserId(Number(u?.id || 0));
    setEditUsername(String(u?.username || ''));
    setEditEmail(String(u?.email || ''));
  };

  const cancelEdit = () => {
    setEditUserId(0);
    setEditUsername('');
    setEditEmail('');
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/users.php?action=update_user', {
        id: editUserId,
        username: editUsername.trim(),
        email: editEmail.trim(),
      });
      setMessage('User updated.');
      cancelEdit();
      load();
    } catch (err: any) {
      setError(err?.message || 'Update failed');
      setBusy(false);
    }
  };

  const startPassword = (u: any) => {
    setPwUserId(Number(u?.id || 0));
    setPwValue('');
  };

  const cancelPassword = () => {
    setPwUserId(0);
    setPwValue('');
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwUserId) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/users.php?action=set_password', { id: pwUserId, password: pwValue });
      setMessage('Password updated.');
      cancelPassword();
    } catch (err: any) {
      setError(err?.message || 'Password update failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (u: any) => {
    const id = Number(u?.id || 0);
    if (!id) return;
    const confirmed = await confirm({
      title: 'Delete User?',
      message: 'Are you sure you want to delete this user?',
      confirmLabel: 'Delete User',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/settings/users.php?action=delete_user', { id });
      setMessage('User deleted.');
      if (editUserId === id) cancelEdit();
      if (pwUserId === id) cancelPassword();
      load();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
      setBusy(false);
    }
  };

  return {
    busy, users,
    createUsername, setCreateUsername,
    createEmail, setCreateEmail,
    createPassword, setCreatePassword,
    createIsAdmin, setCreateIsAdmin,
    createIsActive, setCreateIsActive,
    editUserId, editUsername, setEditUsername,
    editEmail, setEditEmail,
    pwUserId, pwValue, setPwValue,
    load, toggle, createUser, startEdit, cancelEdit, saveEdit,
    startPassword, cancelPassword, savePassword, deleteUser
  };
}
