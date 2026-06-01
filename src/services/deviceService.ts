import { supabase } from '@/db/supabase';
import type { LoginHistory } from '@/types/types';

function getBrowser(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera')) return 'Opera';
  return 'Unknown Browser';
}

function getDevice(ua: string): string {
  if (/iPad|tablet/i.test(ua)) return 'Tablet';
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

function getDeviceFingerprint(ua: string, browser: string, device: string): string {
  return btoa(`${browser}::${device}::${ua.slice(0, 60)}`).slice(0, 40);
}

export function parseUserAgent(): { browser: string; device: string; ua: string; fingerprint: string } {
  const ua = navigator.userAgent;
  const browser = getBrowser(ua);
  const device = getDevice(ua);
  const fingerprint = getDeviceFingerprint(ua, browser, device);
  return { browser, device, ua, fingerprint };
}

export async function isNewDevice(userId: string, fingerprint: string): Promise<boolean> {
  const { data } = await supabase
    .from('known_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint)
    .maybeSingle();
  return !data;
}

export async function registerDevice(
  userId: string,
  fingerprint: string,
  browser: string,
  device: string
): Promise<void> {
  await supabase.from('known_devices').insert({
    user_id: userId,
    fingerprint,
    browser,
    device,
  });
}

export async function recordLogin(
  userId: string,
  browser: string,
  device: string,
  ua: string,
  success = true
): Promise<void> {
  await supabase.from('login_history').insert({
    user_id: userId,
    user_agent: ua,
    browser,
    device,
    location: 'Unknown Location',
    success,
  });
}

export async function getLoginHistory(userId: string): Promise<LoginHistory[]> {
  const { data } = await supabase
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('login_at', { ascending: false })
    .limit(50);
  return Array.isArray(data) ? data : [];
}
