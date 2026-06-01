import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { OtpInput } from '@/components/ui/OtpInput';
import { verifyOtp, sendOtp } from '@/services/emailService';
import type { OtpType } from '@/types/types';
import { cn } from '@/lib/utils';

const OTP_TTL = 15 * 60; // 15 minutes in seconds

interface LocationState {
  email: string;
  type?: OtpType;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function OtpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const email = state?.email || '';
  const type: OtpType = state?.type || 'registration';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(OTP_TTL);
  const isExpired = timeLeft === 0;

  // Countdown tick
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < 6) { toast.error('Please enter all 6 digits'); return; }
    if (isExpired) { toast.error('OTP has expired. Please request a new code.'); return; }
    setLoading(true);
    try {
      const valid = await verifyOtp(email, code, type);
      if (!valid) {
        toast.error('Invalid or expired OTP. Please try again.');
        return;
      }
      toast.success('OTP verified!');
      if (type === 'registration') navigate('/register/password', { state: { email } });
      else if (type === 'login') navigate('/login/password', { state: { email } });
      else if (type === 'reset') navigate('/forgot-password/new', { state: { email } });
    } catch {
      toast.error('Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      await sendOtp(email, type);
      toast.success('New OTP sent!');
      setDigits(Array(6).fill(''));
      setTimeLeft(OTP_TTL); // reset countdown
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resend OTP';
      toast.error(msg);
    } finally {
      setResending(false);
    }
  }, [email, type]);

  const titles: Record<OtpType, { title: string; subtitle: string }> = {
    registration: { title: 'Verify your email',  subtitle: `Enter the 6-digit code sent to ${email}` },
    login:        { title: 'Login verification',  subtitle: `Enter the code sent to ${email}` },
    reset:        { title: 'Reset password',       subtitle: `Enter the code sent to ${email}` },
  };
  const { title, subtitle } = titles[type];

  // Color shifts red as time runs out
  const timerColor =
    timeLeft > 5 * 60 ? 'text-primary' :
    timeLeft > 2 * 60 ? 'text-yellow-400' :
    'text-destructive';

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <div className="space-y-6">
        {/* Countdown timer */}
        <div className={cn(
          'flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
          isExpired
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-border bg-muted/50',
        )}>
          <Clock className={cn('h-4 w-4 shrink-0', isExpired ? 'text-destructive' : timerColor)} />
          {isExpired ? (
            <span>Code expired — request a new one below</span>
          ) : (
            <span>
              Code expires in{' '}
              <span className={cn('font-mono font-bold tabular-nums', timerColor)}>
                {formatTime(timeLeft)}
              </span>
            </span>
          )}
        </div>

        <OtpInput value={digits} onChange={setDigits} disabled={loading || isExpired} />

        <Button
          onClick={handleVerify}
          disabled={loading || isExpired}
          className="w-full gap-2"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ShieldCheck className="h-4 w-4" />}
          {loading ? 'Verifying…' : 'Verify Code'}
        </Button>

        {/* Resend */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            {resending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            {resending ? 'Sending…' : isExpired ? 'Send new code' : 'Resend code'}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground border-t border-border pt-4">
          🔒 NexaCloud will never ask for your password or OTP. Never share your verification code.
        </p>
      </div>
    </AuthLayout>
  );
}
