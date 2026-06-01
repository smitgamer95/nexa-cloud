import emailjs from '@emailjs/browser';
import { supabase } from '@/db/supabase';
import type { OtpType } from '@/types/types';

const EMAIL_SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const OTP_TEMPLATE = import.meta.env.VITE_EMAILJS_OTP_TEMPLATE_ID as string;
const RESET_TEMPLATE = import.meta.env.VITE_EMAILJS_RESET_TEMPLATE_ID as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailJsOtp(
  email: string,
  username: string,
  code: string,
  templateId: string
): Promise<void> {
  // Validate required EmailJS config before calling the API
  if (!EMAIL_SERVICE || !templateId || !PUBLIC_KEY) {
    throw new Error(
      'Email service is not configured. Check VITE_EMAILJS_SERVICE_ID, template ID, and VITE_EMAILJS_PUBLIC_KEY in .env'
    );
  }

  const digits = code.split('');
  const time = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  const templateParams = {
    // Send all common recipient field variants — matches whatever the EmailJS template uses
    to_email: email,
    email: email,
    user_email: email,
    recipient: email,
    to: email,
    username,
    o1: digits[0],
    o2: digits[1],
    o3: digits[2],
    o4: digits[3],
    o5: digits[4],
    o6: digits[5],
    time,
  };

  try {
    await emailjs.send(EMAIL_SERVICE, templateId, templateParams, { publicKey: PUBLIC_KEY });
  } catch (err: unknown) {
    // EmailJS SDK throws an object with a `text` field on failure
    const detail =
      err && typeof err === 'object' && 'text' in err
        ? (err as { text: string }).text
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(`Failed to send OTP email: ${detail}`);
  }
}

export async function sendOtp(email: string, type: OtpType, username?: string): Promise<void> {
  const code = generateOtp();

  // Store OTP in database first
  const { error: dbError } = await supabase.from('otp_codes').insert({
    email,
    code,
    type,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    used: false,
  });

  if (dbError) throw new Error(`Database error: ${dbError.message}`);

  const displayName = username || email.split('@')[0];
  const templateId = type === 'reset' ? RESET_TEMPLATE : OTP_TEMPLATE;
  await sendEmailJsOtp(email, displayName, code, templateId);
}

export async function verifyOtp(email: string, code: string, type: OtpType): Promise<boolean> {
  const { data, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .eq('type', type)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  // Check expiry
  if (new Date(data.expires_at) < new Date()) return false;

  // Mark as used
  await supabase.from('otp_codes').update({ used: true }).eq('id', data.id);
  return true;
}

export async function sendSecurityAlertEmail(
  email: string,
  username: string,
  browser: string,
  device: string,
  location: string
): Promise<void> {
  if (!EMAIL_SERVICE || !OTP_TEMPLATE || !PUBLIC_KEY) return;

  const time = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  const alertTime = `${time} | ${browser} | ${device} | ${location}`;

  try {
    await emailjs.send(
      EMAIL_SERVICE,
      OTP_TEMPLATE,
      {
        to_email: email,
        email: email,
        user_email: email,
        recipient: email,
        to: email,
        username,
        o1: '!',
        o2: 'N',
        o3: 'E',
        o4: 'W',
        o5: '!',
        o6: ' ',
        time: `NEW LOGIN ALERT — ${alertTime}`,
      },
      { publicKey: PUBLIC_KEY }
    );
  } catch {
    console.warn('Failed to send security alert email');
  }
}
