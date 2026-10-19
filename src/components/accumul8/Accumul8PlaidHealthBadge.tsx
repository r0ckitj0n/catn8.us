import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { Accumul8PlaidHealthResponse } from '../../types/accumul8-plaid';

const FLAG_LABELS: Record<string, string> = {
  needs_reauth: 'needs reconnect',
  stale_sync: 'last successful sync is older than 36 hours',
  repeated_errors: 'repeated sync errors',
  missing_webhook: 'Plaid webhook is missing',
  credential_failure: 'Plaid API or credential failure',
};

interface Accumul8PlaidHealthBadgeProps {
  healthUrl: string;
}

export function Accumul8PlaidHealthBadge({ healthUrl }: Accumul8PlaidHealthBadgeProps) {
  const [health, setHealth] = React.useState<Accumul8PlaidHealthResponse | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setFailed(false);
    ApiClient.get<Accumul8PlaidHealthResponse>(healthUrl)
      .then((response) => {
        if (!cancelled) setHealth(response);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [healthUrl]);

  if (failed) {
    return <div className="accumul8-plaid-health is-attention" role="status">Plaid status is unavailable. Open the Sync tab again after reconnecting.</div>;
  }
  if (!health) {
    return <div className="accumul8-plaid-health" role="status">Checking Plaid sync…</div>;
  }
  const problems = (health.connections || []).filter((connection) => (connection.flags || []).length > 0);
  if (Number(health.healthy) === 1 || problems.length === 0) {
    const empty = (health.connections || []).length === 0;
    return (
      <div className="accumul8-plaid-health is-healthy" role="status">
        {empty ? 'No Plaid banks connected yet' : 'Plaid sync healthy'}
      </div>
    );
  }
  return (
    <div className="accumul8-plaid-health is-attention" role="status">
      <strong>Plaid needs attention</strong>
      {problems.map((connection) => {
        const labels = (connection.flags || []).map((flag) => FLAG_LABELS[flag] || 'needs attention');
        return (
          <div key={connection.connection_id}>
            {connection.institution_name || 'Connected bank'}: {labels.join('; ')}. Click Reconnect via Plaid.
          </div>
        );
      })}
    </div>
  );
}
