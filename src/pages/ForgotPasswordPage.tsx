import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { supabase } from '@/db/supabase';
import { sendOtp } from '@/services/emailService';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalized = email.toLowerCase().trim();

      // Use RPC (SECURITY DEFINER) — anon users can't read profiles directly via RLS
      const { data: exists, error: rpcError } = await supabase.rpc('check_email_registered', {
        p_email: normalized,
      });

      if (rpcError) throw new Error(rpcError.message);

      if (!exists) {
        toast.error('No account found with this email.');
        setLoading(false);
        return;
      }

      await sendOtp(normalized, 'reset');
      toast.success('OTP sent to your email!');
      navigate('/forgot-password/otp', { state: { email: normalized, type: 'reset' } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP. Try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send a verification code to your email">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-normal text-muted-foreground">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-muted border-border pl-10 text-foreground placeholder:text-muted-foreground focus:border-primary"
              required autoFocus
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? 'Sending OTP…' : 'Send Reset Code'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Remember it?{' '}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
