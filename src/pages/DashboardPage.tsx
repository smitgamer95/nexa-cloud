import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Upload, Cloud, HardDrive, Files, Image, Video,
  Music, FileText, Archive, Folder, Plus, TrendingUp,
  Clock, Star, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FileCard, FileCardSkeleton } from '@/components/files/FileCard';
import { FilePreview } from '@/components/files/FilePreview';
import { CodeEditor } from '@/components/files/CodeEditor';
import { UploadZone } from '@/components/files/UploadZone';
import { useAuth } from '@/contexts/AuthContext';
import { listFiles, listFolders, getSignedUrl } from '@/services/fileService';
import { formatBytes, storagePercent } from '@/services/profileService';
import type { CloudFile, CloudFolder, FileCategory } from '@/types/types';
import { cn } from '@/lib/utils';

type FilterKey = FileCategory | 'folders';

const CATEGORIES: { key: FilterKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all',       label: 'All',     icon: Files,    color: 'text-foreground' },
  { key: 'folders',   label: 'Folders', icon: Folder,   color: 'text-yellow-400' },
  { key: 'images',    label: 'Photos',  icon: Image,    color: 'text-blue-400' },
  { key: 'videos',    label: 'Videos',  icon: Video,    color: 'text-purple-400' },
  { key: 'documents', label: 'Docs',    icon: FileText, color: 'text-red-400' },
  { key: 'audio',     label: 'Audio',   icon: Music,    color: 'text-green-400' },
  { key: 'archives',  label: 'Archives',icon: Archive,  color: 'text-yellow-400' },
];

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const [editFile, setEditFile] = useState<CloudFile | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fileCategory: FileCategory | undefined =
        filter === 'folders' ? undefined : filter === 'all' ? undefined : filter as FileCategory;
      const [fileData, folderData] = await Promise.all([
        filter === 'folders'
          ? Promise.resolve([] as CloudFile[])
          : listFiles(user.id, undefined, fileCategory, search),
        (filter === 'all' || filter === 'folders')
          ? listFolders(user.id)
          : Promise.resolve([] as CloudFolder[]),
      ]);
      setFiles(fileData);
      setFolders(folderData);
    } finally { setLoading(false); }
  }, [user, filter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredFolders = search
    ? folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : folders;

  const used = profile?.storage_used ?? 0;
  const limit = profile?.storage_limit ?? 5368709120;
  const pct = storagePercent(used, limit);
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    { label: 'Total Files', value: files.length, icon: Files,      color: 'text-primary',      bg: 'bg-primary/10',    delay: 'stagger-1' },
    { label: 'Storage Used', value: formatBytes(used), icon: HardDrive, color: 'text-amber-400', bg: 'bg-amber-400/10', delay: 'stagger-2', isString: true },
    { label: 'Photos',       value: files.filter(f => f.file_type === 'images').length,   icon: Image,   color: 'text-blue-400',   bg: 'bg-blue-400/10',   delay: 'stagger-3' },
    { label: 'Videos',       value: files.filter(f => f.file_type === 'videos').length,   icon: Video,   color: 'text-purple-400', bg: 'bg-purple-400/10', delay: 'stagger-4' },
  ];

  const recentFiles = [...files]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 4);

  const showFolders = (filter === 'all' || filter === 'folders') && filteredFolders.length > 0;
  const showFiles   = filter !== 'folders' && files.length > 0;
  const isEmpty     = !loading && !showFolders && !showFiles;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className={cn(
          'flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-all duration-500',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">{greeting} 👋</p>
            <h1 className="text-xl font-bold text-foreground text-balance">
              Welcome back, <span className="text-primary">{displayName}</span>
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
              Here's what's happening with your storage today.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/files')}
              className="gap-2 border border-border text-foreground hover:bg-muted/40">
              <Folder className="h-4 w-4" /> Files
            </Button>
            <Button onClick={() => setUploadOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        </div>

        {/* ── Storage + Stats grid ─────────────────────────────────── */}
        <div className={cn(
          'grid grid-cols-1 md:grid-cols-5 gap-4 transition-all duration-500 delay-100',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}>
          {/* Storage card — wider */}
          <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Cloud className="h-4.5 w-4.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">Storage</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatBytes(used)} / {formatBytes(limit)}
              </span>
            </div>

            {/* Segmented bar */}
            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex gap-0.5">
                {[
                  { type: 'images',    color: 'bg-blue-400' },
                  { type: 'videos',    color: 'bg-purple-400' },
                  { type: 'documents', color: 'bg-red-400' },
                  { type: 'audio',     color: 'bg-green-400' },
                ].map(seg => {
                  const segFiles = files.filter(f => f.file_type === seg.type);
                  const segBytes = segFiles.reduce((s, f) => s + (f.file_size ?? 0), 0);
                  const segPct = limit > 0 ? (segBytes / limit) * 100 : 0;
                  return segPct > 0.5 ? (
                    <div key={seg.type} className={cn('h-full rounded-sm transition-all duration-700', seg.color)}
                      style={{ width: `${segPct}%` }} />
                  ) : null;
                })}
                {/* remaining */}
                <div className="flex-1 h-full" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{pct}% used</p>
                {pct >= 90 && <p className="text-xs text-destructive font-medium">Almost full!</p>}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Photos', color: 'bg-blue-400' },
                { label: 'Video',  color: 'bg-purple-400' },
                { label: 'Docs',   color: 'bg-red-400' },
                { label: 'Audio',  color: 'bg-green-400' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', l.color)} />
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          {statCards.map((card, i) => (
            <div key={card.label}
              className={cn(
                'rounded-2xl border border-border bg-card p-4 flex flex-col justify-between gap-3 h-full transition-all duration-500',
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
              )}
              style={{ transitionDelay: `${(i + 2) * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.bg)}>
                  <card.icon className={cn('h-4 w-4', card.color)} />
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
              <div>
                <p className={cn('text-2xl font-bold text-foreground animate-count-up', card.delay)}>
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick actions ─────────────────────────────────────────── */}
        <div className={cn(
          'flex flex-wrap gap-2 transition-all duration-500 delay-200',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}>
          <Button size="sm" variant="ghost" onClick={() => setUploadOpen(true)}
            className="gap-2 border border-border text-foreground hover:bg-muted/40 h-9">
            <Upload className="h-3.5 w-3.5 text-primary" /> Upload Files
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/files')}
            className="gap-2 border border-border text-foreground hover:bg-muted/40 h-9">
            <Folder className="h-3.5 w-3.5 text-yellow-400" /> My Files
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/compiler')}
            className="gap-2 border border-border text-foreground hover:bg-muted/40 h-9">
            <Activity className="h-3.5 w-3.5 text-green-400" /> Compiler
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/trash')}
            className="gap-2 border border-border text-foreground hover:bg-muted/40 h-9">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" /> Trash
          </Button>
        </div>

        {/* ── Recent files strip ────────────────────────────────────── */}
        {!loading && recentFiles.length > 0 && (
          <div className={cn(
            'transition-all duration-500 delay-300',
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          )}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" /> Recent
              </h2>
              <button onClick={() => navigate('/files')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recentFiles.map((file, i) => (
                <div key={file.id}
                  className={cn('animate-fade-in', `stagger-${i + 1}`)}>
                  <FileCard
                    file={file}
                    onDeleted={fetchData}
                    onRenamed={fetchData}
                    onPreview={f => setPreviewFile(f)}
                    onEdit={f => setEditFile(f)}
                    onRun={async () => {}}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search + filter ───────────────────────────────────────── */}
        <div className={cn(
          'flex flex-col gap-3 md:flex-row md:items-center transition-all duration-500 delay-300',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search files and folders…"
              className="bg-muted border-border pl-9 text-foreground placeholder:text-muted-foreground focus:border-primary" />
          </div>
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 md:pb-0">
            {CATEGORIES.map(cat => (
              <Button key={cat.key} variant={filter === cat.key ? 'default' : 'ghost'} size="sm"
                onClick={() => setFilter(cat.key)}
                className={cn('gap-1.5 shrink-0 h-9',
                  filter !== cat.key && 'text-muted-foreground hover:text-foreground border border-border')}>
                <cat.icon className={cn('h-3.5 w-3.5', filter === cat.key ? '' : cat.color)} />
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ── File grid ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <FileCardSkeleton key={i} />)}
          </div>
        ) : isEmpty ? (
          <EmptyState search={search} filter={filter} onUpload={() => setUploadOpen(true)} />
        ) : (
          <div className="space-y-6">
            {showFolders && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Folder className="h-4 w-4 text-yellow-400" /> Folders
                  <span className="text-xs text-muted-foreground/60">({filteredFolders.length})</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredFolders.map((folder, i) => (
                    <div key={folder.id} className={cn('animate-scale-in', i < 8 ? `stagger-${Math.min(i + 1, 8)}` : '')}>
                      <FolderCard folder={folder} onClick={() => navigate('/files')} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showFiles && (
              <div>
                {showFolders && (
                  <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Files className="h-4 w-4 text-primary" /> Files
                    <span className="text-xs text-muted-foreground/60">({files.length})</span>
                  </h2>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-stagger">
                  {files.map(file => (
                    <FileCard key={file.id} file={file}
                      onDeleted={fetchData} onRenamed={fetchData}
                      onPreview={f => setPreviewFile(f)}
                      onEdit={f => setEditFile(f)}
                      onRun={async () => {}} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FilePreview file={previewFile} open={!!previewFile} onClose={() => setPreviewFile(null)}
        onEdit={f => { setPreviewFile(null); setEditFile(f); }} />
      <CodeEditor file={editFile} open={!!editFile} onClose={() => setEditFile(null)} onSaved={fetchData} />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Upload Files
            </DialogTitle>
          </DialogHeader>
          <UploadZone onUploadComplete={() => { fetchData(); setUploadOpen(false); }} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function FolderCard({ folder, onClick }: { folder: CloudFolder; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 h-full flex flex-col gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-colors">
        <Folder className="h-5.5 w-5.5 text-yellow-400" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Folder</p>
      </div>
    </button>
  );
}

function EmptyState({ search, filter, onUpload }: { search: string; filter: FilterKey; onUpload: () => void }) {
  if (search) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
      <p className="text-base font-medium text-foreground">No results for "{search}"</p>
      <p className="text-sm text-muted-foreground mt-1 text-pretty">Try a different file name or type.</p>
    </div>
  );
  const label = CATEGORIES.find(c => c.key === filter)?.label ?? 'items';
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 relative">
        <div className="absolute -inset-4 rounded-full opacity-20 animate-float"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }} />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Cloud className="h-10 w-10 text-muted-foreground opacity-60" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground text-balance">
        {filter === 'all' ? 'No files yet' : `No ${label} yet`}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground text-pretty max-w-xs">
        {filter === 'all' ? 'Upload your first file to NexaCloud.' : `No ${label.toLowerCase()} found in your storage.`}
      </p>
      {filter === 'all' && (
        <Button onClick={onUpload} className="mt-6 gap-2">
          <Upload className="h-4 w-4" /> Upload Files
        </Button>
      )}
    </div>
  );
}
