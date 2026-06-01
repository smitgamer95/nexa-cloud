import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { supabase } from '@/db/supabase';
import { parseUserAgent, isNewDevice, registerDevice, recordLogin } from '@/services/deviceService';
import { sendSecurityAlertEmail } from '@/services/emailService';
import { getProfile } from '@/services/profileService';

export default function LoginPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email: string } | null;
  const email = state?.email || '';

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        toast.error('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      // Device detection
      const { browser, device, ua, fingerprint } = parseUserAgent();
      const userId = data.user.id;

      const isNew = await isNewDevice(userId, fingerprint);
      if (isNew) {
        // Send security alert
        const profile = await getProfile(userId);
        const username = profile?.display_name || email.split('@')[0];
        await sendSecurityAlertEmail(email, username, browser, device, 'Unknown Location');
        await registerDevice(userId, fingerprint, browser, device);
        toast.warning('New device detected — a security alert was sent to your email.', { duration: 5000 });
      }

      await recordLogin(userId, browser, device, ua);

      // Remember me: persist session
      if (rememberMe) {
        // Supabase default session is persisted in localStorage automatically
        // Setting longer expiry via local storage flag for the inactivity timer
        localStorage.setItem('pc_remember_me', '1');
      } else {
        localStorage.removeItem('pc_remember_me');
      }

      toast.success('Logged in successfully!');
      navigate('/dashboard');
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Enter your password" subtitle={`Signing in as ${email}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-normal text-muted-foreground">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              className="bg-muted border-border pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus:border-primary"
              required autoFocus
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={v => setRememberMe(v === true)}
          />
          <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
            Remember me for 30 days
          </Label>
        </div>

        <Button type="submit" disabled={loading} className="w-full gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </AuthLayout>
  );
}
