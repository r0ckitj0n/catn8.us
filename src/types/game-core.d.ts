export interface IUser {
  id: number;
  username: string;
  email: string;
  password_hash?: string;
  is_admin: number;
  is_active: number;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface IGroup {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ISecret {
  id: number;
  key: string;
  value_enc: string;
  created_at: string;
  updated_at: string;
}
