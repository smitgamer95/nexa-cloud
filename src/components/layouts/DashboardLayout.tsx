import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderOpen, Trash2, Settings, LogOut,
  Menu, HardDrive, Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { formatBytes, storagePercent } from '@/services/profileService';
import { toast } from 'sonner';

const LOGO_URL = 'https://i.postimg.cc/HnxcmmVK/Chat-GPT-Image-May-22-2026-01-39-42-PM.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: FolderOpen,      label: 'My Files',  to: '/files' },
  { icon: Code2,           label: 'Compiler',  to: '/compiler' },
  { icon: Trash2,          label: 'Trash',     to: '/trash' },
  { icon: Settings,        label: 'Settings',  to: '/settings' },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/login');
    onClose?.();
  };

  const used = profile?.storage_used ?? 0;
  const limit = profile?.storage_limit ?? 5368709120;
  const pct = storagePercent(used, limit);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-sidebar-border">
        <img
          src={LOGO_URL}
          alt="NexaCloud"
          className="h-9 w-9 rounded-xl object-cover shrink-0"
          draggable={false}
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground tracking-tight leading-none">NexaCloud</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Private Cloud Storage</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Storage meter */}
      <div className="mx-3 mb-3 rounded-lg bg-sidebar-accent p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground">
          <HardDrive className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Storage</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatBytes(used)} / {formatBytes(limit)}
        </p>
      </div>

      {/* User + Logout */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between rounded-lg px-2 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar"
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-primary/30" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">
                {(profile?.display_name || profile?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                {profile?.display_name || 'User'}
              </p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="shrink-0 h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Mobile header */}
        <header className="flex lg:hidden items-center justify-between border-b border-border px-4 py-2.5 bg-card">
          <div className="flex items-center gap-2.5">
            <img
              src={LOGO_URL}
              alt="NexaCloud"
              className="h-7 w-7 rounded-lg object-cover shrink-0"
              draggable={false}
            />
            <span className="text-sm font-bold text-foreground tracking-tight">NexaCloud</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
