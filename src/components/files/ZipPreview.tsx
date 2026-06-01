import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Archive, FileText, Image, Film, Music, Code2,
  Folder, Loader2, X, Download, ChevronRight, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getSignedUrl } from '@/services/fileService';
import type { CloudFile } from '@/types/types';

// JSZip internal data shape (private but stable across v3.x)
interface ZipObjInternal { dir: boolean; _data?: { uncompressedSize?: number } }

interface ZipEntry {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  depth: number;
}

function formatBytes(b: number) {
  if (b === 0) return '—';
  const k = 1024;
  const s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}

function entryIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp','svg','ico'].includes(ext))
    return <Image className="h-3.5 w-3.5 text-pink-400 shrink-0" />;
  if (['mp4','mov','webm','avi','mkv'].includes(ext))
    return <Film className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
  if (['mp3','wav','ogg','flac'].includes(ext))
    return <Music className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
  if (['html','htm','css','js','ts','jsx','tsx','py','c','cpp','java','go','rs','php','rb'].includes(ext))
    return <Code2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
  return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

interface ZipPreviewProps {
  file: CloudFile | null;
  open: boolean;
  onClose: () => void;
}

export function ZipPreview({ file, open, onClose }: ZipPreviewProps) {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    if (!file || !open) { setEntries([]); setError(null); return; }
    setLoading(true);
    setError(null);
    setCollapsed(new Set());

    (async () => {
      try {
        const url = await getSignedUrl(file.storage_path);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Could not fetch ZIP file.');
        const buf = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        const list: ZipEntry[] = [];
        let total = 0;

        zip.forEach((relativePath, zipEntry) => {
          const internal = zipEntry as unknown as ZipObjInternal;
          const isDir = internal.dir || relativePath.endsWith('/');
          const cleanPath = relativePath.replace(/\/$/, '');
          const parts = cleanPath.split('/');
          const depth = parts.length - 1;
          const name = parts[parts.length - 1] || cleanPath;
          const size = isDir ? 0 : (internal._data?.uncompressedSize ?? 0);
          if (!isDir) total += size;
          list.push({ path: relativePath, name, isDir, size, depth });
        });

        list.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.path.localeCompare(b.path);
        });

        setEntries(list);
        setTotalSize(total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to read ZIP.');
      } finally {
        setLoading(false);
      }
    })();
  }, [file, open]);

  const toggleCollapse = (path: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const visible = entries.filter(e => {
    const parts = e.path.replace(/\/$/, '').split('/');
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('/') + '/';
      if (collapsed.has(parentPath)) return false;
    }
    return true;
  });

  const fileCount = entries.filter(e => !e.isDir).length;
  const dirCount  = entries.filter(e => e.isDir).length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl h-[80vh] bg-[#0d0d0d] border-border p-0 flex flex-col overflow-hidden [&>button]:hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-[#111] px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Archive className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="truncate text-sm font-medium text-foreground">{file?.name}</span>
          </div>
          <Button variant="ghost" size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats */}
        {!loading && !error && entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border/40 bg-[#0f0f0f] px-4 py-2 text-xs text-muted-foreground shrink-0">
            <span><span className="text-foreground font-medium">{fileCount}</span> file{fileCount !== 1 ? 's' : ''}</span>
            {dirCount > 0 && <span><span className="text-foreground font-medium">{dirCount}</span> folder{dirCount !== 1 ? 's' : ''}</span>}
            {totalSize > 0 && <span>Uncompressed: <span className="text-foreground font-medium">{formatBytes(totalSize)}</span></span>}
            <span>ZIP size: <span className="text-foreground font-medium">{formatBytes(file?.file_size ?? 0)}</span></span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Reading ZIP contents…</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-destructive">
              <Archive className="h-8 w-8 opacity-50" />
              <span className="text-sm text-center px-4">{error}</span>
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Archive className="h-8 w-8 opacity-30" />
              <span className="text-sm">Empty ZIP file</span>
            </div>
          )}
          {!loading && !error && visible.length > 0 && (
            <div className="font-mono text-xs">
              {visible.map(entry => {
                const folderKey = entry.isDir ? entry.path : null;
                const isCollapsed = folderKey ? collapsed.has(folderKey) : false;
                return (
                  <div
                    key={entry.path}
                    className={cn(
                      'flex items-center gap-2 border-b border-border/10 py-1.5 hover:bg-muted/20 transition-colors',
                      entry.isDir && 'cursor-pointer select-none',
                    )}
                    style={{ paddingLeft: `${12 + entry.depth * 16}px`, paddingRight: '12px' }}
                    onClick={entry.isDir && folderKey ? () => toggleCollapse(folderKey) : undefined}
                  >
                    {entry.isDir ? (
                      <>
                        {isCollapsed
                          ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          : <ChevronDown  className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <Folder className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-yellow-300/90">{entry.name}/</span>
                      </>
                    ) : (
                      <>
                        <span className="h-3 w-3 shrink-0" />
                        {entryIcon(entry.name)}
                        <span className="flex-1 min-w-0 truncate text-foreground/80">{entry.name}</span>
                        <span className="shrink-0 text-muted-foreground/50 tabular-nums">{formatBytes(entry.size)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-border/40 bg-[#111] px-4 py-2">
          <span className="text-xs text-muted-foreground/50">
            {entries.length > 0 ? `${visible.length} / ${entries.length} entries shown` : ''}
          </span>
          <Button size="sm" variant="ghost"
            className="h-7 gap-1.5 text-xs border border-border/50 text-foreground hover:bg-muted"
            onClick={onClose}>
            <Download className="h-3 w-3" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
