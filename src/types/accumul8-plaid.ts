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
