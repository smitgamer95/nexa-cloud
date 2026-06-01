import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function updateStorageUsed(userId: string, delta: number): Promise<void> {
  // Use increment via RPC-style raw update
  const profile = await getProfile(userId);
  if (!profile) return;
  const newUsed = Math.max(0, profile.storage_used + delta);
  await supabase
    .from('profiles')
    .update({ storage_used: newUsed })
    .eq('id', userId);
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>
): Promise<void> {
  await supabase.from('profiles').update(updates).eq('id', userId);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function storagePercent(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
