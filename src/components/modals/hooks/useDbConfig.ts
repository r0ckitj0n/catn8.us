import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';

export interface DbConfig {
  host: string;
  db: string;
  user: string;
  pass: string;
  port: number;
  socket: string;
}

const LS_DB_TEST = 'catn8.last_test.db.test_connection';

export function useDbConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [lastDbTest, setLastDbTest] = React.useState('');

  const emptyCfg: DbConfig = React.useMemo(() => ({ host: '', db: '', user: '', pass: '', port: 3306, socket: '' }), []);
  const [cfgByProfile, setCfgByProfile] = useState<Record<string, DbConfig>>({ dev: emptyCfg, live: emptyCfg });
  const [initialCfgByProfile, setInitialCfgByProfile] = useState<Record<string, DbConfig>>({ dev: emptyCfg, live: emptyCfg });
  const [selectedProfile, setSelectedProfile] = React.useState('dev');
  const [activeProfile, setActiveProfile] = React.useState('dev');
  const [source, setSource] = React.useState('env');

  const normalizeCfg = (c: DbConfig) => {
    return {
      host: String(c?.host || ''),
      db: String(c?.db || ''),
      user: String(c?.user || ''),
      pass: String(c?.pass || ''),
      port: Number(c?.port || 0) || 3306,
      socket: String(c?.socket || ''),
    };
  };

  const load = React.useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/settings/db.php?action=get');
      const profiles = res?.profiles || {};
      setSource(String(res?.source || 'env'));
      const ap = String(res?.active_profile || 'dev');
      setActiveProfile(ap);

      const nextCfgByProfile = {
        dev: {
          host: String(profiles?.dev?.host || ''),
          db: String(profiles?.dev?.db || ''),
          user: String(profiles?.dev?.user || ''),
          pass: '',
          port: Number(profiles?.dev?.port || 3306),
          socket: String(profiles?.dev?.socket || ''),
        },
        live: {
          host: String(profiles?.live?.host || ''),
          db: String(profiles?.live?.db || ''),
          user: String(profiles?.live?.user || ''),
          pass: '',
          port: Number(profiles?.live?.port || 3306),
          socket: String(profiles?.live?.socket || ''),
        },
      };

      setCfgByProfile(nextCfgByProfile);
      setInitialCfgByProfile(nextCfgByProfile);
      setSelectedProfile(ap === 'live' ? 'live' : 'dev');
    } catch (e: any) {
      setError(e?.message || 'Failed to load DB config');
    } finally {
      setBusy(false);
    }
  }, [emptyCfg]);

  React.useEffect(() => {
    if (open) {
      load();
      setLastDbTest(catn8LocalStorageGet(LS_DB_TEST));
    }
  }, [open, load]);

  const isDirty = React.useMemo(() => {
    const current = normalizeCfg((cfgByProfile || {})[selectedProfile]);
    const initial = normalizeCfg((initialCfgByProfile || {})[selectedProfile]);
    return JSON.stringify(current) !== JSON.stringify(initial);
  }, [cfgByProfile, initialCfgByProfile, selectedProfile]);

  const save = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const cfg = cfgByProfile[selectedProfile] || emptyCfg;
      const res = await ApiClient.post('/api/settings/db.php?action=save', {
        profile: selectedProfile,
        cfg: {
          host: cfg.host,
          db: cfg.db,
          user: cfg.user,
          pass: cfg.pass,
          port: Number(cfg.port || 0) || 3306,
          socket: cfg.socket,
        },
      });

      setCfgByProfile((all) => ({
        ...all,
        [selectedProfile]: { ...(all[selectedProfile] || emptyCfg), pass: '' },
      }));
      setInitialCfgByProfile((all) => ({
        ...all,
        [selectedProfile]: normalizeCfg({ ...(cfgByProfile[selectedProfile] || emptyCfg), pass: '' }),
      }));

      setMessage(String(res?.message || 'Saved'));
    } catch (err: any) {
      setError(err?.message || 'Failed to save DB config');
    } finally {
      setBusy(false);
    }
  };

  const test = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setLastDbTest('Running…');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const cfg = cfgByProfile[selectedProfile] || emptyCfg;
      const res = await ApiClient.post('/api/settings/db.php?action=test', {
        host: cfg.host,
        db: cfg.db,
        user: cfg.user,
        pass: cfg.pass,
        port: Number(cfg.port || 0) || 3306,
        socket: cfg.socket,
      });
      const next = formatTestResult('success', String(res?.message || 'Connection successful'));
      setLastDbTest(next);
      catn8LocalStorageSet(LS_DB_TEST, next);
      setMessage(String(res?.message || 'Connection successful'));
    } catch (err: any) {
      const next = formatTestResult('failure', String(err?.message || 'Connection failed'));
      setLastDbTest(next);
      catn8LocalStorageSet(LS_DB_TEST, next);
      setError(err?.message || 'Connection failed');
    } finally {
      setBusy(false);
    }
  };

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

  return {
    busy, isDirty,
    cfgByProfile, setCfgByProfile,
    selectedProfile, setSelectedProfile,
    activeProfile,
    source,
    lastDbTest,
    load, save, test,
    emptyCfg
  };
}
