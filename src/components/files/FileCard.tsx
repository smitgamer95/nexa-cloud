import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye, Download, Trash2, Pencil, X, Check, Code2, Play, Share2, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FileIcon } from './FileIcon';
import {
  downloadFile, renameFile, trashFile, getSignedUrl,
  isRunnable, isCodeFile,
} from '@/services/fileService';
import { formatBytes } from '@/services/profileService';
import type { CloudFile } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';

interface FileCardProps {
  file: CloudFile;
  onDeleted: () => void;
  onRenamed: () => void;
  onPreview: (file: CloudFile) => void;
  onEdit: (file: CloudFile) => void;
  onRun: (file: CloudFile) => void;
  onShare?: (file: CloudFile) => void;
  onOpenCompiler?: (file: CloudFile) => void;
  selected?: boolean;
  onToggleSelect?: (file: CloudFile) => void;
  selectionMode?: boolean;
}

export function FileCard({ file, onDeleted, onRenamed, onPreview, onEdit, onRun, onShare, onOpenCompiler, selected = false, onToggleSelect, selectionMode = false }: FileCardProps) {
  const { user } = useAuth();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [loading, setLoading] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  const canEdit = isCodeFile(file.name);
  const canRun = isRunnable(file.name);

  useEffect(() => {
    if (file.file_type !== 'images') return;
    getSignedUrl(file.storage_path)
      .then(url => setThumbUrl(url))
      .catch(() => setThumbUrl(null));
  }, [file]);

  const handleDelete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await trashFile(file.id, user.id);
      toast.success(`"${file.name}" moved to trash.`);
      onDeleted();
    } catch {
      toast.error('Could not delete file.');
    } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    try { await downloadFile(file); }
    catch { toast.error('Download failed.'); }
  };

  const handleRenameConfirm = async () => {
    if (!user || !newName.trim() || newName === file.name) { setRenaming(false); return; }
    try {
      await renameFile(file.id, user.id, newName.trim());
      toast.success('File renamed.');
      onRenamed();
    } catch {
      toast.error('Rename failed.');
    } finally { setRenaming(false); }
  };

  const startRename = () => { setNewName(file.name); setRenaming(true); };

  const date = new Date(file.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Primary click action depends on file type
  const handlePrimaryClick = () => {
    if (canRun) { onRun(file); return; }
    if (canEdit) { onEdit(file); return; }
    onPreview(file);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn(
          'group relative flex flex-col rounded-xl border border-border bg-card',
          'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30',
          canRun && 'hover:border-orange-500/30',
          canEdit && !canRun && 'hover:border-cyan-500/30',
          loading && 'opacity-60 pointer-events-none',
          selected && 'border-primary ring-2 ring-primary/30 -translate-y-0.5',
        )}>
          {/* Selection checkbox — visible in selection mode or on hover */}
          {onToggleSelect && (
            <button
              className={cn(
                'absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded',
                'border-2 transition-all duration-150',
                selected
                  ? 'border-primary bg-primary text-primary-foreground opacity-100'
                  : 'border-white/60 bg-black/30 text-transparent opacity-0 group-hover:opacity-100',
                selectionMode && 'opacity-100',
              )}
              onClick={e => { e.stopPropagation(); onToggleSelect(file); }}
              title={selected ? 'Deselect' : 'Select for ZIP download'}
            >
              {selected && <Check className="h-3 w-3" />}
            </button>
          )}

          {/* Thumbnail / icon */}
          <div
            className="flex h-32 cursor-pointer items-center justify-center rounded-t-xl bg-muted/40 overflow-hidden relative"
            onClick={selectionMode && onToggleSelect ? () => onToggleSelect(file) : handlePrimaryClick}
          >
            {thumbUrl ? (
              <img src={thumbUrl} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileIcon file={file} className="h-10 w-10" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  {file.original_name.split('.').pop()?.toUpperCase()}
                </span>
              </div>
            )}

            {/* Run badge for HTML files */}
            {canRun && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                <Play className="h-2.5 w-2.5" /> Run
              </div>
            )}
            {/* Edit badge for code files */}
            {canEdit && !canRun && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                <Code2 className="h-2.5 w-2.5" /> Code
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-1 p-3">
            {renaming ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="h-7 text-xs bg-muted border-border"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameConfirm();
                    if (e.key === 'Escape') setRenaming(false);
                  }}
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-green-500"
                  onClick={handleRenameConfirm}><Check className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={() => setRenaming(false)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                {file.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{formatBytes(file.file_size)} · {date}</p>
          </div>

          {/* Quick actions row */}
          <div className="flex items-center gap-1 border-t border-border px-3 py-2">
            {canRun ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-400 hover:text-orange-300"
                onClick={() => onRun(file)} title="Run in Web">
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => onPreview(file)} title="Preview">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-400 hover:text-cyan-300"
                onClick={() => onEdit(file)} title="Open with Editor">
                <Code2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onOpenCompiler && canEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-400 hover:text-violet-300"
                onClick={() => onOpenCompiler(file)} title="Open with Compiler">
                <Cpu className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleDownload} title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            {onShare && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => onShare(file)} title="Share">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={startRename} title="Rename">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive ml-auto"
              onClick={handleDelete} title="Move to Trash">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Right-click context menu */}
      <ContextMenuContent className="w-56 bg-card border-border shadow-lg">
        {canRun && (
          <>
            <ContextMenuItem onClick={() => onRun(file)} className="cursor-pointer gap-2 text-orange-400 focus:text-orange-400">
              <Play className="h-4 w-4" /> Run in Web
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {canEdit && (
          <>
            <ContextMenuItem onClick={() => onEdit(file)} className="cursor-pointer gap-2 text-cyan-400 focus:text-cyan-400">
              <Code2 className="h-4 w-4" /> Open with Editor
            </ContextMenuItem>
            {onOpenCompiler && (
              <ContextMenuItem onClick={() => onOpenCompiler(file)} className="cursor-pointer gap-2 text-violet-400 focus:text-violet-400">
                <Cpu className="h-4 w-4" /> Open with Compiler
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={() => onPreview(file)} className="cursor-pointer gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" /> Preview
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDownload} className="cursor-pointer gap-2">
          <Download className="h-4 w-4 text-muted-foreground" /> Download
        </ContextMenuItem>
        <ContextMenuSeparator />
        {onShare && (
          <>
            <ContextMenuItem onClick={() => onShare(file)} className="cursor-pointer gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" /> Share
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={startRename} className="cursor-pointer gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" /> Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Move to Trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function FileCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="border-t border-border px-3 py-2 flex gap-1">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}