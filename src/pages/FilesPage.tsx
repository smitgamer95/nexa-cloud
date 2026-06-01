import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Upload, FolderPlus, FolderOpen, ChevronRight,
  Folder, Home, Pencil, Trash2, Check, FilePlus,
  X, FolderOpenDot, Plus, Archive, Square, CheckSquare,
  Share2, PanelLeftClose, PanelLeft, Monitor, RefreshCw, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FileCard, FileCardSkeleton } from '@/components/files/FileCard';
import { ZipPreview } from '@/components/files/ZipPreview';
import { FilePreview } from '@/components/files/FilePreview';
import { CodeEditor } from '@/components/files/CodeEditor';
import { UploadZone } from '@/components/files/UploadZone';
import { FolderTree } from '@/components/files/FolderTree';
import { ShareDialog } from '@/components/files/ShareDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  listFiles, listFolders, createFolder, deleteFolder,
  renameFolder, createTextFile, searchAllFiles,
  getSignedUrl, downloadFilesAsZip, trashFile,
} from '@/services/fileService';
import type { CloudFile, CloudFolder } from '@/types/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BreadcrumbItem { id: string | null; name: string; }
type ModalType = 'upload' | 'newFolder' | 'newFile' | null;

export default function FilesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CloudFile[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'My Files' }]);
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const [zipPreviewFile, setZipPreviewFile] = useState<CloudFile | null>(null);
  const [editFile, setEditFile] = useState<CloudFile | null>(null);
  const [shareFile, setShareFile] = useState<CloudFile | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [treeRefresh, setTreeRefresh] = useState(0);
  const [webRunSrcdoc, setWebRunSrcdoc] = useState<string | null>(null);
  const [webRunFullscreen, setWebRunFullscreen] = useState(false);

  // ── ZIP selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState(false);

  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileExt, setNewFileExt] = useState('txt');
  const [newFileContent, setNewFileContent] = useState('');
  const [creating, setCreating] = useState(false);

  const [renamingFolder, setRenamingFolder] = useState<CloudFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [f, d] = await Promise.all([
        listFiles(user.id, currentFolderId, 'all'),
        listFolders(user.id, currentFolderId),
      ]);
      setFiles(f);
      setFolders(d);
    } finally {
      setLoading(false);
    }
  }, [user, currentFolderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Global search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      if (!user) return;
      try {
        const results = await searchAllFiles(user.id, search);
        setSearchResults(results);
      } finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, user]);

  const isSearching = search.trim().length > 0;

  const toggleSelect = useCallback((file: CloudFile) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(file.id) ? next.delete(file.id) : next.add(file.id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set((isSearching ? searchResults : files).map((f: CloudFile) => f.id)));
  }, [isSearching, searchResults, files]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Ctrl+A to select all
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        selectAll();
      }
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectAll, clearSelection]);

  const handleBulkTrash = useCallback(async () => {
    if (!user || !selectedIds.size) return;
    const allDisplayed = isSearching ? searchResults : files;
    const toTrash = allDisplayed.filter(f => selectedIds.has(f.id));
    const toastId = toast.loading(`Moving ${toTrash.length} file${toTrash.length > 1 ? 's' : ''} to trash…`);
    try {
      await Promise.all(toTrash.map(f => trashFile(f.id, user.id)));
      toast.success(`${toTrash.length} file${toTrash.length > 1 ? 's' : ''} moved to trash.`, { id: toastId });
      clearSelection();
      fetchData();
    } catch {
      toast.error('Failed to move files to trash.', { id: toastId });
    }
  }, [user, selectedIds, files, searchResults, isSearching, clearSelection, fetchData]);

  const handleDownloadZip = useCallback(async () => {
    if (!selectedIds.size) return;
    const allDisplayed = isSearching ? searchResults : files;
    const toDownload = allDisplayed.filter(f => selectedIds.has(f.id));
    setZipping(true);
    const toastId = toast.loading(`Packing ${toDownload.length} file${toDownload.length > 1 ? 's' : ''}…`);
    try {
      const folderName = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1].name : 'website';
      await downloadFilesAsZip(toDownload, `${folderName}-source.zip`);
      toast.success(`Downloaded ${toDownload.length} file${toDownload.length > 1 ? 's' : ''} as ZIP`, { id: toastId });
      clearSelection();
    } catch {
      toast.error('Failed to create ZIP. Please try again.', { id: toastId });
    } finally {
      setZipping(false);
    }
  }, [selectedIds, files, searchResults, isSearching, breadcrumbs, clearSelection]);

  // ── Navigation
  const navigateToFolder = (folder: CloudFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSearch('');
    setSelectedIds(new Set());
  };

  const navigateToBreadcrumb = (item: BreadcrumbItem, index: number) => {
    setCurrentFolderId(item.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    setSearch('');
    setSelectedIds(new Set());
  };

  // Called from FolderTree
  const handleTreeSelect = (
    id: string | null,
    _name: string,
    crumbs: { id: string | null; name: string }[],
  ) => {
    setCurrentFolderId(id);
    setBreadcrumbs(crumbs);
    setSearch('');
    setSelectedIds(new Set());
  };

  // ── Handlers
  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    setCreating(true);
    try {
      await createFolder(user.id, newFolderName.trim(), currentFolderId);
      toast.success('Folder created!');
      setModal(null); setNewFolderName('');
      fetchData();
      setTreeRefresh(n => n + 1);
    } catch { toast.error('Could not create folder.'); }
    finally { setCreating(false); }
  };

  const handleCreateFile = async () => {
    if (!user || !newFileName.trim()) return;
    setCreating(true);
    try {
      await createTextFile(user.id, newFileName.trim(), newFileContent, currentFolderId, newFileExt);
      toast.success(`"${newFileName}.${newFileExt}" created!`);
      setModal(null); setNewFileName(''); setNewFileContent(''); setNewFileExt('txt'); fetchData();
    } catch { toast.error('Could not create file.'); }
    finally { setCreating(false); }
  };

  const handleDeleteFolder = async (folder: CloudFolder) => {
    if (!user) return;
    try {
      await deleteFolder(folder.id, user.id);
      toast.success('Folder deleted.');
      fetchData();
      setTreeRefresh(n => n + 1);
    } catch { toast.error('Could not delete folder.'); }
  };

  const handleRenameFolder = async () => {
    if (!user || !renamingFolder || !renameFolderName.trim()) { setRenamingFolder(null); return; }
    try {
      await renameFolder(renamingFolder.id, user.id, renameFolderName.trim());
      toast.success('Folder renamed.');
      fetchData();
      setTreeRefresh(n => n + 1);
    } catch { toast.error('Rename failed.'); }
    finally { setRenamingFolder(null); }
  };

  const openModal = (type: ModalType) => {
    setNewFolderName(''); setNewFileName(''); setNewFileContent('');
    setModal(type);
  };

  const handleRunFile = async (file: CloudFile) => {
    try {
      // Fetch all files in the same folder for CSS/JS inlining
      const folderFiles = await listFiles(user!.id, file.folder_id ?? null);
      const fileMap: Record<string, string> = {};
      await Promise.all(folderFiles.map(async f => {
        try {
          const url = await getSignedUrl(f.storage_path);
          const res = await fetch(url);
          fileMap[f.name.toLowerCase()] = await res.text();
        } catch { /* skip */ }
      }));
      let html = fileMap[file.name.toLowerCase()] || '';
      html = html.replace(/<link\s[^>]*href=["']([^"']+\.css)["'][^>]*\/?>/gi, (_orig, href) => {
        const key = (href as string).split('/').pop()?.toLowerCase() || '';
        return fileMap[key] ? '<style>' + fileMap[key] + '</style>' : _orig;
      });
      html = html.replace(/<script[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (_orig, src) => {
        const key = (src as string).split('/').pop()?.toLowerCase() || '';
        return fileMap[key] ? '<script>' + fileMap[key] + '</script>' : _orig;
      });
      setWebRunSrcdoc(html);
      setWebRunFullscreen(false);
    } catch { toast.error('Could not load file for preview.'); }
  };

  const handleOpenCompiler = async (file: CloudFile) => {
    try {
      const url = await getSignedUrl(file.storage_path);
      const res = await fetch(url);
      const content = await res.text();
      navigate("/compiler", { state: { file: { name: file.name, content } } });
    } catch { toast.error("Could not open file in Compiler."); }
  };


  const isEmpty = !loading && files.length === 0 && folders.length === 0;
  const displayFiles = isSearching ? searchResults : files;
  const displayFolders = isSearching ? [] : folders;

  return (
    <DashboardLayout>
      <div className="flex" style={{ minHeight: 'calc(100vh - 0px)' }}>

        {/* ── Folder tree sidebar ─────────────────────────────────────── */}
        {treeOpen && user && (
          <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-border bg-card/50">
            <FolderTree
              userId={user.id}
              selectedId={currentFolderId}
              onSelect={handleTreeSelect}
              refreshTrigger={treeRefresh}
            />
          </aside>
        )}

        {/* ── Main panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top bar */}
          <div className="flex flex-col gap-3 p-4 md:p-5 pb-0 md:pb-0 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {/* Tree toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setTreeOpen(o => !o)}
                title={treeOpen ? 'Collapse folder tree' : 'Expand folder tree'}
              >
                {treeOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground">My Files</h1>
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {breadcrumbs.map((bc, idx) => (
                    <React.Fragment key={bc.id ?? 'root'}>
                      {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      <button
                        onClick={() => navigateToBreadcrumb(bc, idx)}
                        className={cn(
                          'text-sm transition-colors',
                          idx === breadcrumbs.length - 1
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground hover:text-primary',
                        )}
                      >
                        {idx === 0 ? <Home className="h-3.5 w-3.5" /> : bc.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 border border-border text-foreground hover:bg-muted">
                    <Plus className="h-4 w-4" /> New
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-card border-border shadow-lg">
                  <DropdownMenuItem onClick={() => openModal('newFile')} className="cursor-pointer gap-2">
                    <FilePlus className="h-4 w-4 text-muted-foreground" /> New Text File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openModal('newFolder')} className="cursor-pointer gap-2">
                    <FolderPlus className="h-4 w-4 text-muted-foreground" /> New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openModal('upload')} className="cursor-pointer gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" /> Upload Files
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={() => openModal('upload')} className="gap-2">
                <Upload className="h-4 w-4" /> Upload
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 md:px-5 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search all files…"
                className="bg-muted border-border pl-9 pr-9 text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {isSearching && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                {searching ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${search}"`}
              </p>
            )}
          </div>

          {/* Bulk-select toolbar */}
          {displayFiles.length > 0 && (
            <div className="px-4 md:px-5 pt-3">
              {selectedIds.size === 0 ? (
                <button onClick={() => selectAll()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Square className="h-3.5 w-3.5" />
                  Select files (or Ctrl+A)
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {selectedIds.size} selected
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => selectAll()}>All ({displayFiles.length})</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearSelection}>
                    <X className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                  <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                    <Button size="sm" variant="ghost"
                      className="h-7 gap-1.5 text-xs border border-border/60 text-foreground hover:bg-muted/30"
                      onClick={handleDownloadZip} disabled={zipping}>
                      <Archive className="h-3.5 w-3.5" />
                      {zipping ? 'Packing…' : 'ZIP'}
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-7 gap-1.5 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={handleBulkTrash}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Trash
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="flex-1 px-4 md:px-5 py-4">
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <FileCardSkeleton key={i} />)}
                  </div>
                ) : isSearching && searchResults.length === 0 && !searching ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="h-12 w-12 text-muted-foreground opacity-30 mb-4" />
                    <p className="text-base font-medium text-foreground">No files found</p>
                    <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
                  </div>
                ) : isEmpty && !isSearching ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FolderOpen className="h-16 w-16 text-muted-foreground opacity-30 mb-4" />
                    <p className="text-base font-medium text-foreground">This folder is empty</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Right-click here or use the <strong>New</strong> button above
                    </p>
                    <div className="flex gap-2 mt-5">
                      <Button variant="ghost" onClick={() => openModal('newFile')}
                        className="gap-2 border border-border">
                        <FilePlus className="h-4 w-4" /> New File
                      </Button>
                      <Button onClick={() => openModal('upload')} className="gap-2">
                        <Upload className="h-4 w-4" /> Upload Files
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Folders */}
                    {displayFolders.length > 0 && (
                      <div>
                        <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                          Folders
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {displayFolders.map(folder => (
                            <ContextMenu key={folder.id}>
                              <ContextMenuTrigger asChild>
                                <div className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-context-menu select-none">
                                  {renamingFolder?.id === folder.id ? (
                                    <div className="flex items-center gap-1 flex-1">
                                      <Input
                                        value={renameFolderName}
                                        onChange={e => setRenameFolderName(e.target.value)}
                                        className="h-7 text-xs bg-muted border-border"
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleRenameFolder();
                                          if (e.key === 'Escape') setRenamingFolder(null);
                                        }}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-green-500"
                                        onClick={handleRenameFolder}><Check className="h-3 w-3" /></Button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => navigateToFolder(folder)}
                                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                    >
                                      <Folder className="h-5 w-5 text-primary shrink-0" />
                                      <span className="truncate text-sm font-medium text-foreground">
                                        {folder.name}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48 bg-card border-border shadow-lg">
                                <ContextMenuItem onClick={() => navigateToFolder(folder)} className="cursor-pointer gap-2">
                                  <FolderOpenDot className="h-4 w-4 text-muted-foreground" /> Open
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() => { setRenamingFolder(folder); setRenameFolderName(folder.name); }}
                                  className="cursor-pointer gap-2"
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" /> Rename
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() => handleDeleteFolder(folder)}
                                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files */}
                    {displayFiles.length > 0 && (
                      <div>
                        <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                          {isSearching ? 'Search Results' : 'Files'}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {displayFiles.map(file => (
                            <FileCard
                              key={file.id}
                              file={file}
                              onDeleted={fetchData}
                              onRenamed={fetchData}
                              onPreview={f => {
                                const ext = f.name.split('.').pop()?.toLowerCase();
                                if (ext === 'zip' || ext === 'rar') setZipPreviewFile(f);
                                else setPreviewFile(f);
                              }}
                              onEdit={f => setEditFile(f)}
                              onRun={handleRunFile}
                              onShare={f => setShareFile(f)}
                              onOpenCompiler={handleOpenCompiler}
                              selected={selectedIds.has(file.id)}
                              onToggleSelect={toggleSelect}
                              selectionMode={selectedIds.size > 0}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ContextMenuTrigger>

            {/* Canvas right-click menu */}
            <ContextMenuContent className="w-52 bg-card border-border shadow-lg">
              <ContextMenuItem onClick={() => openModal('newFile')} className="cursor-pointer gap-2">
                <FilePlus className="h-4 w-4 text-muted-foreground" /> New Text File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openModal('newFolder')} className="cursor-pointer gap-2">
                <FolderPlus className="h-4 w-4 text-muted-foreground" /> New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => openModal('upload')} className="cursor-pointer gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" /> Upload Files
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>

      {/* ── Modals / Dialogs ──────────────────────────────────────────────── */}
      <FilePreview
        file={previewFile}
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onEdit={f => { setPreviewFile(null); setEditFile(f); }}
      />
      <ZipPreview file={zipPreviewFile} open={!!zipPreviewFile} onClose={() => setZipPreviewFile(null)} />
      <CodeEditor file={editFile} open={!!editFile} onClose={() => setEditFile(null)} onSaved={fetchData} />
      <ShareDialog file={shareFile} open={!!shareFile} onClose={() => setShareFile(null)} />

      {/* Upload */}
      <Dialog open={modal === 'upload'} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Upload Files
            </DialogTitle>
          </DialogHeader>
          <UploadZone folderId={currentFolderId} onUploadComplete={() => { fetchData(); setModal(null); }} />
        </DialogContent>
      </Dialog>

      {/* New Folder */}
      <Dialog open={modal === 'newFolder'} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" /> New Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="bg-muted border-border text-foreground"
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}
                className="border border-border text-foreground hover:bg-muted">Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New File */}
      <Dialog open={modal === 'newFile'} onOpenChange={o => { if (!o) { setModal(null); setNewFileExt('txt'); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-primary" /> New File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-normal text-muted-foreground">File type</label>
              <Select value={newFileExt} onValueChange={setNewFileExt}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {[
                    ['txt','Plain Text (.txt)'],['html','HTML (.html)'],['css','CSS (.css)'],
                    ['js','JavaScript (.js)'],['ts','TypeScript (.ts)'],['jsx','React JSX (.jsx)'],
                    ['tsx','React TSX (.tsx)'],['json','JSON (.json)'],['md','Markdown (.md)'],
                    ['py','Python (.py)'],['sh','Shell Script (.sh)'],['sql','SQL (.sql)'],
                    ['yaml','YAML (.yaml)'],['xml','XML (.xml)'],['php','PHP (.php)'],
                    ['go','Go (.go)'],['rs','Rust (.rs)'],['java','Java (.java)'],
                    ['c','C (.c)'],['cpp','C++ (.cpp)'],['cs','C# (.cs)'],['rb','Ruby (.rb)'],['csv','CSV (.csv)'],
                  ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-normal text-muted-foreground">File name</label>
              <div className="flex items-center gap-2">
                <Input
                  value={newFileName}
                  onChange={e => setNewFileName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !creating && newFileName.trim() && handleCreateFile()}
                  placeholder={newFileExt === 'html' ? 'index' : newFileExt === 'css' ? 'styles' : newFileExt === 'js' ? 'script' : 'my-file'}
                  className="bg-muted border-border text-foreground"
                  autoFocus
                />
                <span className="shrink-0 text-sm font-mono text-muted-foreground">.{newFileExt}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-normal text-muted-foreground">
                Content <span className="text-xs">(optional)</span>
              </label>
              <Textarea
                value={newFileContent}
                onChange={e => setNewFileContent(e.target.value)}
                placeholder={
                  newFileExt === 'html' ? '<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>'
                  : newFileExt === 'css' ? '/* styles */'
                  : newFileExt === 'js' || newFileExt === 'ts' ? '// code here'
                  : newFileExt === 'py' ? '# python script'
                  : newFileExt === 'md' ? '# Title\n\nContent here.'
                  : 'Start typing…'
                }
                className="bg-muted border-border text-foreground resize-none h-28 font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setModal(null); setNewFileExt('txt'); }}
                className="border border-border text-foreground hover:bg-muted">Cancel</Button>
              <Button onClick={handleCreateFile} disabled={creating || !newFileName.trim()}>
                {creating ? 'Creating…' : 'Create File'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── In-app Web Preview Overlay ──────────────────────────────── */}
      {webRunSrcdoc !== null && (
        <div className={cn(
          'fixed z-50 bg-background border border-border shadow-2xl flex flex-col overflow-hidden',
          webRunFullscreen
            ? 'inset-0 rounded-none'
            : 'bottom-4 right-4 rounded-xl w-[min(600px,calc(100vw-2rem))] h-[min(480px,calc(100vh-6rem))]'
        )}>
          {/* Header bar */}
          <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Monitor className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">Run in Web</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setWebRunSrcdoc(s => s)} title="Refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setWebRunFullscreen(f => !f)}
                title={webRunFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {webRunFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => { setWebRunSrcdoc(null); setWebRunFullscreen(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* iframe */}
          <iframe
            key={webRunSrcdoc}
            srcDoc={webRunSrcdoc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            className="flex-1 w-full border-0 bg-white"
            title="Run in Web"
          />
        </div>
      )}
    </DashboardLayout>
  );
}
