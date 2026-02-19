import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';

export interface DeployConfig {
  deploy_host: string;
  deploy_user: string;
  deploy_base_url: string;
  public_base: string;
  remote_sql_dir: string;
  confirm_full_db_overwrite: string;
  dry_run: string;
  skip_release_build: string;
  full_replace: string;
  include_vendor: string;
  upload_live_env: string;
}

export interface TestCheck {
  key: string;
  message: string;
  ok: boolean;
}

const LS_DEPLOY_TEST = 'catn8.last_test.deploy.config';

export function useDeployConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [lastDeployTest, setLastDeployTest] = React.useState('');
  const [testChecks, setTestChecks] = useState<TestCheck[]>([]);

  const emptyCfg: DeployConfig = React.useMemo(() => ({
    deploy_host: '',
    deploy_user: '',
    deploy_base_url: '',
    public_base: '',
    remote_sql_dir: '',
    confirm_full_db_overwrite: '',
    dry_run: '',
    skip_release_build: '',
    full_replace: '',
    include_vendor: '',
    upload_live_env: '',
  }), []);

  const [cfg, setCfg] = useState<DeployConfig>(emptyCfg);
  const [initialCfg, setInitialCfg] = useState<DeployConfig>(emptyCfg);
  const [secrets, setSecrets] = React.useState({ deploy_pass: '', admin_token: '' });
  const [secretStatus, setSecretStatus] = React.useState({ CATN8_DEPLOY_PASS_set: false, CATN8_ADMIN_TOKEN_set: false });
  const [source, setSource] = React.useState('env');

  const load = React.useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/settings/deploy.php?action=get');
      setSource(String(res?.source || 'env'));
      const nextCfg: DeployConfig = {
        deploy_host: String(res?.cfg?.deploy_host || ''),
        deploy_user: String(res?.cfg?.deploy_user || ''),
        deploy_base_url: String(res?.cfg?.deploy_base_url || ''),
        public_base: String(res?.cfg?.public_base || ''),
        remote_sql_dir: String(res?.cfg?.remote_sql_dir || ''),
        confirm_full_db_overwrite: String(res?.cfg?.confirm_full_db_overwrite || ''),
        dry_run: String(res?.cfg?.dry_run || ''),
        skip_release_build: String(res?.cfg?.skip_release_build || ''),
        full_replace: String(res?.cfg?.full_replace || ''),
        include_vendor: String(res?.cfg?.include_vendor || ''),
        upload_live_env: String(res?.cfg?.upload_live_env || ''),
      };
      setCfg(nextCfg);
      setInitialCfg(nextCfg);
      setSecrets({ deploy_pass: '', admin_token: '' });
      setSecretStatus({
        CATN8_DEPLOY_PASS_set: Boolean(res?.secrets?.CATN8_DEPLOY_PASS_set),
        CATN8_ADMIN_TOKEN_set: Boolean(res?.secrets?.CATN8_ADMIN_TOKEN_set),
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load deploy config');
    } finally {
      setBusy(false);
    }
  }, [emptyCfg]);

  React.useEffect(() => {
    if (open) {
      load();
      setLastDeployTest(catn8LocalStorageGet(LS_DEPLOY_TEST));
    }
  }, [open, load]);

  const isDirty = React.useMemo(() => {
    const current = { ...cfg, secrets: { deploy_pass: secrets.deploy_pass ? 'x' : '', admin_token: secrets.admin_token ? 'x' : '' } };
    const initial = { ...initialCfg, secrets: { deploy_pass: '', admin_token: '' } };
    return JSON.stringify(current) !== JSON.stringify(initial);
  }, [cfg, initialCfg, secrets]);

  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post('/api/settings/deploy.php?action=save', {
        cfg,
        secrets: {
          deploy_pass: secrets.deploy_pass,
          admin_token: secrets.admin_token,
        },
      });

      setInitialCfg(cfg);
      setSecrets({ deploy_pass: '', admin_token: '' });
      setMessage(String(res?.message || 'Saved'));
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save deploy config');
    } finally {
      setBusy(false);
    }
  };

  const testDeployment = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post('/api/settings/deploy.php?action=test', { cfg, secrets });
      const ok = Boolean(res?.ok);
      const checks = Array.isArray(res?.checks) ? res.checks : [];
      setTestChecks(checks);
      const next = formatTestResult(ok ? 'success' : 'failure', ok ? 'OK' : 'Failed');
      setLastDeployTest(next);
      catn8LocalStorageSet(LS_DEPLOY_TEST, next);
      if (ok) setMessage('Deployment config test OK');
      else setError('Deployment config test failed');
    } catch (err: any) {
      const next = formatTestResult('failure', String(err?.message || 'Test failed'));
      setLastDeployTest(next);
      catn8LocalStorageSet(LS_DEPLOY_TEST, next);
      setError(err?.message || 'Deployment config test failed');
    } finally {
      setBusy(false);
    }
  };

  const generateAdminToken = () => {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
      setError('Secure random generator not available in this browser');
      return;
    }
    const bytes = new Uint8Array(48);
    cryptoObj.getRandomValues(bytes);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = window.btoa(binary);
    const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    setSecrets((s) => ({ ...s, admin_token: b64url }));
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
    cfg, setCfg,
    secrets, setSecrets,
    secretStatus,
    source,
    lastDeployTest,
    testChecks,
    load, save, testDeployment,
    generateAdminToken
  };
}
