export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  storage_used: number;
  storage_limit: number;
  created_at: string;
  updated_at: string;
}

export interface CloudFile {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  public_url: string | null;
  is_trashed: boolean;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginHistory {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  device: string | null;
  location: string | null;
  login_at: string;
  success: boolean;
}

export interface OtpCode {
  id: string;
  email: string;
  code: string;
  type: 'registration' | 'login' | 'reset';
  expires_at: string;
  used: boolean;
  created_at: string;
}

export type OtpType = 'registration' | 'login' | 'reset';

export type FileCategory = 'all' | 'images' | 'videos' | 'documents' | 'audio' | 'archives' | 'code';

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export interface ShareLink {
  id: string;
  file_id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  created_at: string;
}
