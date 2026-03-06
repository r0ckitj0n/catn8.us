import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { BrandedConfirmFn } from '../../../hooks/useBrandedConfirm';
import { Accumul8AccessGrant, Accumul8AccessListResponse, Accumul8AccessUser } from '../../../types/accumul8';

export function useAccumul8Access(open: boolean, confirm: BrandedConfirmFn, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [users, setUsers] = React.useState<Accumul8AccessUser[]>([]);
  const [grants, setGrants] = React.useState<Accumul8AccessGrant[]>([]);
  const [granteeUserId, setGranteeUserId] = React.useState('');
  const [ownerUserId, setOwnerUserId] = React.useState('');

  const load = React.useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get<Accumul8AccessListResponse>('/api/settings/accumul8_access.php?action=list');
      const nextUsers = Array.isArray(res?.users) ? res.users : [];
      const nextGrants = Array.isArray(res?.grants) ? res.grants : [];
      setUsers(nextUsers);
      setGrants(nextGrants);
      setGranteeUserId((prev) => (prev || nextUsers.length === 0 ? prev : String(nextUsers[0].id)));
      setOwnerUserId((prev) => (prev || nextUsers.length < 2 ? prev : String(nextUsers[1].id)));
    } catch (e: any) {
      setError(e?.message || 'Failed to load Accumul8 access grants');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

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

  const grantAccess = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const granteeId = Number(granteeUserId || 0);
    const ownerId = Number(ownerUserId || 0);
    if (granteeId <= 0 || ownerId <= 0) {
      setError('Select both users to create a grant');
      return;
    }

    setBusy(true);
    try {
      await ApiClient.post('/api/settings/accumul8_access.php?action=grant', {
        grantee_user_id: granteeId,
        owner_user_id: ownerId,
      });
      setMessage('Accumul8 access granted.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to grant access');
      setBusy(false);
    }
  }, [granteeUserId, load, ownerUserId]);

  const revokeAccess = React.useCallback(async (grant: Accumul8AccessGrant) => {
    const confirmed = await confirm({
      title: 'Revoke Access?',
      message: `Remove ${grant.grantee_username}'s access to ${grant.owner_username}'s Accumul8 account?`,
      confirmLabel: 'Revoke Access',
      tone: 'danger',
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await ApiClient.post('/api/settings/accumul8_access.php?action=revoke', { id: grant.id });
      setMessage('Accumul8 access revoked.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to revoke access');
      setBusy(false);
    }
  }, [confirm, load]);

  return {
    busy,
    users,
    grants,
    granteeUserId,
    ownerUserId,
    setGranteeUserId,
    setOwnerUserId,
    load,
    grantAccess,
    revokeAccess,
  };
}
