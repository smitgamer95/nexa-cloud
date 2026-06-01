import React, { useState, useEffect, useRef } from 'react';
import {
  User, Lock, Monitor, LogOut, Eye, EyeOff, Upload, Loader2,
  ShieldCheck, Clock, CheckCircle2, AlertCircle, Download, Cloud, Code2, Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { updateProfile, formatBytes } from '@/services/profileService';
import { getLoginHistory } from '@/services/deviceService';
import type { LoginHistory } from '@/types/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut, signOutAllDevices } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    setHistoryLoading(true);
    getLoginHistory(user.id).then(h => {
      setLoginHistory(h);
      setHistoryLoading(false);
    });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateProfile(user.id, { display_name: displayName.trim() || null });
      await refreshProfile();
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match.'); return; }
    setChangingPw(true);
    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      });
      if (signInError) { toast.error('Current password is incorrect.'); return; }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success('Password updated!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch {
      toast.error('Failed to update password.');
    } finally {
      setChangingPw(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Avatar must be under 2 MB.'); return; }

    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('user-files').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(path);
      await updateProfile(user.id, { avatar_url: urlData.publicUrl });
      await refreshProfile();
      toast.success('Avatar updated!');
    } catch {
      toast.error('Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleSignOutAll = async () => {
    await signOutAllDevices();
    toast.success('Signed out from all devices.');
    navigate('/login');
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out.');
    navigate('/login');
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-2xl space-y-5">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="profile" className="gap-1.5">
              <User className="h-3.5 w-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Security
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Monitor className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
          </TabsList>

          {/* Profile tab */}
          <TabsContent value="profile" className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="h-16 w-16 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary text-2xl font-semibold">
                      {(profile?.display_name || profile?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{profile?.display_name || 'Set a name'}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  <button
                    onClick={() => avatarRef.current?.click()}
                    className="mt-1 text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {avatarUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {avatarUploading ? 'Uploading…' : 'Change photo'}
                  </button>
                  <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Display name</Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Email</Label>
                <Input value={profile?.email || ''} disabled className="bg-muted border-border text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Storage</Label>
                <p className="text-sm text-foreground">
                  {formatBytes(profile?.storage_used ?? 0)} used of {formatBytes(profile?.storage_limit ?? 5368709120)}
                </p>
              </div>

              <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>

            {/* Sign out */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-sm font-medium text-foreground">Session</h3>
              <div className="flex flex-col gap-2 md:flex-row">
                <Button variant="ghost" onClick={handleSignOut}
                  className="gap-2 border border-border text-foreground hover:bg-muted">
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
                <Button variant="ghost" onClick={handleSignOutAll}
                  className="gap-2 text-destructive hover:bg-destructive/10 border border-destructive/30">
                  <LogOut className="h-4 w-4" /> Sign Out All Devices
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Security tab */}
          <TabsContent value="security">
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium text-foreground">Change Password</h3>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">Current password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      className="bg-muted border-border text-foreground pr-10"
                      required
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">New password</Label>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="bg-muted border-border text-foreground pr-10"
                      required
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">Confirm new password</Label>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className="bg-muted border-border text-foreground"
                    required
                  />
                </div>
                <Button type="submit" disabled={changingPw} className="gap-2">
                  {changingPw && <Loader2 className="h-4 w-4 animate-spin" />}
                  {changingPw ? 'Updating…' : 'Update Password'}
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Activity tab */}
          <TabsContent value="activity">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium text-foreground">Login History</h3>
              </div>
              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : loginHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No login history yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loginHistory.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                      <div className="shrink-0 mt-0.5">
                        {entry.success
                          ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                          : <AlertCircle className="h-4 w-4 text-destructive" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {entry.browser || 'Unknown Browser'} · {entry.device || 'Unknown Device'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.login_at).toLocaleString('en-US', {
                            dateStyle: 'medium', timeStyle: 'short',
                          })}
                          {entry.location ? ` · ${entry.location}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="about" className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              {/* App identity */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                  <Cloud className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">NexaCloud</h3>
                  <p className="text-xs text-muted-foreground">Secure private cloud storage platform</p>
                </div>
              </div>

              {/* Feature list */}
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { icon: Cloud,    label: '5 GB secure storage' },
                  { icon: Code2,    label: 'Built-in code editor (15+ languages)' },
                  { icon: Archive,  label: 'ZIP upload, preview & download' },
                  { icon: Monitor,  label: 'Browser compiler — JS, Python, C/C++' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    {label}
                  </div>
                ))}
              </div>

              {/* Download source code */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-primary" /> Download Source Code
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Download the complete NexaCloud source code as a ZIP file.
                    Includes all React/TypeScript components, services, and configuration.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = '/nexacloud-source.zip';
                    a.download = 'nexacloud-source.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> nexacloud-source.zip
                </Button>
              </div>

              {/* Version info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground/60 border-t border-border/40 pt-3">
                <span>© {new Date().getFullYear()} NexaCloud</span>
                <span>·</span>
                <span>Your Files. Your Privacy.</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
