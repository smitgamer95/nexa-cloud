import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Link2, Trash2, Plus, Clock, Loader2, Check, ExternalLink, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { createShareLink, listShareLinks, deleteShareLink } from '@/services/fileService';
import { useAuth } from '@/contexts/AuthContext';
import type { CloudFile, ShareLink } from '@/types/types';
import { toast } from 'sonner';

interface ShareDialogProps {
  file: CloudFile | null;
  open: boolean;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: 'Never', value: 'never' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

function expiryToDate(value: string): string | null {
  if (value === 'never') return null;
  const now = new Date();
  if (value === '1h') now.setHours(now.getHours() + 1);
  else if (value === '24h') now.setDate(now.getDate() + 1);
  else if (value === '7d') now.setDate(now.getDate() + 7);
  else if (value === '30d') now.setDate(now.getDate() + 30);
  return now.toISOString();
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Never expires';
  const d = new Date(expiresAt);
  const now = new Date();
  if (d < now) return 'Expired';
  const diff = d.getTime() - now.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Expires in < 1 hour';
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

function ShareLinkUrl({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/share/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied to clipboard!');
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="flex-1 truncate text-xs font-mono text-foreground">{url}</span>
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        title="Copy link"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => window.open(url, '_blank')}
        title="Open link"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ShareDialog({ file, open, onClose }: ShareDialogProps) {
  const { user } = useAuth();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expiry, setExpiry] = useState('7d');

  const loadLinks = useCallback(async () => {
    if (!user || !file) return;
    setLoading(true);
    try {
      const data = await listShareLinks(user.id, file.id);
      setLinks(data);
    } finally { setLoading(false); }
  }, [user, file]);

  useEffect(() => {
    if (open && file) loadLinks();
    else setLinks([]);
  }, [open, file, loadLinks]);

  const handleCreate = async () => {
    if (!user || !file) return;
    setCreating(true);
    try {
      const expiresAt = expiryToDate(expiry);
      await createShareLink(file.id, user.id, expiresAt);
      toast.success('Share link created!');
      loadLinks();
    } catch { toast.error('Could not create share link.'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (link: ShareLink) => {
    if (!user) return;
    try {
      await deleteShareLink(link.id, user.id);
      setLinks(prev => prev.filter(l => l.id !== link.id));
      toast.success('Share link deleted.');
    } catch { toast.error('Could not delete link.'); }
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Share2 className="h-4 w-4 text-primary" /> Share "{file.name}"
          </DialogTitle>
        </DialogHeader>

        {/* Create new link */}
        <div className="space-y-3 border border-border/50 rounded-xl p-4 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Create new share link</p>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="flex-1 h-8 text-xs bg-muted border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {EXPIRY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>

        {/* Existing links */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active links ({links.length})
          </p>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : links.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No share links yet. Create one above.
            </div>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {links.map(link => {
                const isExpired = link.expires_at ? new Date(link.expires_at) < new Date() : false;
                return (
                  <div key={link.id} className={cn('space-y-1.5 rounded-xl border p-3', isExpired ? 'border-border/30 opacity-50' : 'border-border/60')}>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-xs', isExpired ? 'text-destructive' : 'text-muted-foreground')}>
                        {formatExpiry(link.expires_at)}
                      </span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(link)}
                        title="Delete link"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <ShareLinkUrl token={link.token} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
