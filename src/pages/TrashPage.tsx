import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2, RotateCcw, AlertTriangle, Clock, Square,
  CheckSquare, X, Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FileIcon } from '@/components/files/FileIcon';
import { useAuth } from '@/contexts/AuthContext';
import {
  listTrashedFiles, restoreFile, permanentlyDeleteFile,
} from '@/services/fileService';
import { formatBytes } from '@/services/profileService';
import type { CloudFile } from '@/types/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function TrashPage() {
  const { user, refreshProfile } = useAuth();
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CloudFile | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const fetchTrash = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listTrashedFiles(user.id);
      setFiles(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  // Ctrl+A
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSelectedIds(new Set(files.map(f => f.id)));
      }
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => setSelectedIds(new Set(files.map(f => f.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // ── Single restore
  const handleRestore = async (file: CloudFile) => {
    if (!user) return;
    try {
      await restoreFile(file.id, user.id);
      toast.success(`${file.name} restored.`);
      fetchTrash();
    } catch {
      toast.error('Could not restore file.');
    }
  };

  // ── Single permanent delete
  const handlePermanentDelete = async () => {
    if (!user || !deleteTarget) return;
    try {
      await permanentlyDeleteFile(deleteTarget.id, user.id);
      toast.success(`${deleteTarget.name} permanently deleted.`);
      setDeleteTarget(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
      await refreshProfile();
      fetchTrash();
    } catch {
      toast.error('Could not delete file.');
    }
  };

  // ── Bulk restore
  const handleBulkRestore = async () => {
    if (!user || !selectedIds.size) return;
    const toRestore = files.filter(f => selectedIds.has(f.id));
    setWorking(true);
    const toastId = toast.loading(`Restoring ${toRestore.length} file${toRestore.length > 1 ? 's' : ''}…`);
    try {
      await Promise.all(toRestore.map(f => restoreFile(f.id, user.id)));
      toast.success(`${toRestore.length} file${toRestore.length > 1 ? 's' : ''} restored.`, { id: toastId });
      clearSelection();
      fetchTrash();
    } catch {
      toast.error('Could not restore files.', { id: toastId });
    } finally { setWorking(false); }
  };

  // ── Bulk permanent delete
  const handleBulkDelete = async () => {
    if (!user || !selectedIds.size) return;
    const toDelete = files.filter(f => selectedIds.has(f.id));
    setWorking(true);
    const toastId = toast.loading(`Permanently deleting ${toDelete.length} file${toDelete.length > 1 ? 's' : ''}…`);
    try {
      await Promise.all(toDelete.map(f => permanentlyDeleteFile(f.id, user.id)));
      toast.success(`${toDelete.length} file${toDelete.length > 1 ? 's' : ''} permanently deleted.`, { id: toastId });
      clearSelection();
      await refreshProfile();
      fetchTrash();
    } catch {
      toast.error('Could not delete files.', { id: toastId });
    } finally { setWorking(false); }
  };

  function daysUntilCleanup(trashedAt: string | null): number {
    if (!trashedAt) return 30;
    const elapsed = (Date.now() - new Date(trashedAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.round(30 - elapsed));
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" /> Trash
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 text-pretty">
              Files are permanently deleted after 30 days.
            </p>
          </div>
        </div>

        {/* Bulk toolbar */}
        {!loading && files.length > 0 && (
          <div className="text-sm">
            {selectedIds.size === 0 ? (
              <button onClick={selectAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Square className="h-3.5 w-3.5" />
                Select files (or Ctrl+A)
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">{selectedIds.size} selected</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={selectAll}>All ({files.length})</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearSelection}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <Button size="sm" variant="ghost"
                    className="h-7 gap-1.5 text-xs border border-border/60 text-foreground hover:bg-muted/30"
                    onClick={handleBulkRestore} disabled={working}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                  <Button size="sm" variant="ghost"
                    className="h-7 gap-1.5 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmBulkDelete(true)} disabled={working}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete Forever
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* File list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                <Skeleton className="h-10 w-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48 bg-muted" />
                  <Skeleton className="h-3 w-24 bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Trash2 className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-base font-medium text-foreground">Trash is empty</p>
            <p className="text-sm text-muted-foreground">Files you delete will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(file => {
              const days = daysUntilCleanup(file.trashed_at);
              const urgent = days <= 3;
              const selected = selectedIds.has(file.id);
              return (
                <div
                  key={file.id}
                  onClick={() => toggleSelect(file.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150 select-none',
                    selected
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/40 bg-card hover:border-border hover:bg-muted/20',
                  )}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    'shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors',
                    selected ? 'bg-primary border-primary' : 'border-muted-foreground/30',
                  )}>
                    {selected && <svg viewBox="0 0 12 10" className="h-2.5 w-2.5 fill-none stroke-white stroke-2"><polyline points="1,5 4,8 11,1" /></svg>}
                  </div>

                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <FileIcon file={file} className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatBytes(file.file_size)}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className={cn('flex items-center gap-1 text-xs', urgent ? 'text-destructive' : 'text-muted-foreground')}>
                        <Clock className="h-3 w-3" />
                        {days === 0 ? 'Deletes today' : `${days}d left`}
                        {urgent && <AlertTriangle className="h-3 w-3" />}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm"
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => handleRestore(file)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(file)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Single-file delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be deleted forever.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handlePermanentDelete}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={o => !o && setConfirmBulkDelete(false)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {selectedIds.size} file{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              These files will be deleted forever. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmBulkDelete(false); handleBulkDelete(); }}>
              Delete {selectedIds.size} file{selectedIds.size > 1 ? 's' : ''} forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
