export interface Accumul8PlaidLinkTokenResponse {
  success: boolean;
  link_token: string;
  expiration?: string;
  environment: string;
  request_id?: string;
  redirect_uri?: string;
}

export interface Accumul8PlaidExchangeResponse {
  success: boolean;
  connection_id: number;
  item_id: string;
  institution_id?: string;
  institution_name?: string;
}

export interface Accumul8PlaidHealthConnection {
  connection_id: number;
  institution_name: string;
  status: string;
  last_sync_at: string;
  flags: string[];
  action: string;
}

export interface Accumul8PlaidHealthResponse {
  success: boolean;
  healthy: number;
  problem_count: number;
  webhook_url?: string;
  connections: Accumul8PlaidHealthConnection[];
}
