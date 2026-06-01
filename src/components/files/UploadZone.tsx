import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile, validateFile, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '@/services/fileService';
import { formatBytes } from '@/services/profileService';
import type { UploadProgress } from '@/types/types';

interface UploadZoneProps {
  folderId?: string | null;
  onUploadComplete?: () => void;
}

export function UploadZone({ folderId, onUploadComplete }: UploadZoneProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const updateUpload = (fileId: string, patch: Partial<UploadProgress>) => {
    setUploads(prev => prev.map(u => u.fileId === fileId ? { ...u, ...patch } : u));
  };

  const processFiles = useCallback(async (files: File[]) => {
    if (!user) return;

    const storageUsed = profile?.storage_used ?? 0;
    const storageLimit = profile?.storage_limit ?? 5368709120;

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }

      if (storageUsed + file.size > storageLimit) {
        toast.error('Storage limit reached. Delete files or upgrade storage.');
        continue;
      }

      const fileId = `${Date.now()}_${file.name}`;
      setUploads(prev => [...prev, {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      }]);

      try {
        await uploadFile(user.id, file, folderId ?? null, (pct) => {
          updateUpload(fileId, { progress: pct });
        });
        updateUpload(fileId, { progress: 100, status: 'done' });
        toast.success(`${file.name} uploaded!`);
        await refreshProfile();
        onUploadComplete?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        updateUpload(fileId, { status: 'error', error: msg });
        toast.error(`${file.name}: ${msg}`);
      }
    }

    // Clear completed uploads after delay
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.status !== 'done'));
    }, 3000);
  }, [user, profile, folderId, refreshProfile, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = '';
  };

  const removeUpload = (fileId: string) => {
    setUploads(prev => prev.filter(u => u.fileId !== fileId));
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragEnter={() => setDragging(true)}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200',
          dragging
            ? 'border-primary bg-primary/5 glow-blue scale-[1.01]'
            : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <div className={cn(
          'mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-colors',
          dragging ? 'bg-primary/20' : 'bg-muted'
        )}>
          {dragging
            ? <FolderOpen className="h-6 w-6 text-primary" />
            : <Upload className="h-6 w-6 text-muted-foreground" />
          }
        </div>

        <p className="text-sm font-medium text-foreground">
          {dragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or{' '}
          <label className="cursor-pointer text-primary hover:underline">
            browse files
            <input
              type="file"
              multiple
              className="sr-only"
              accept={ALLOWED_EXTENSIONS.map(e => `.${e}`).join(',')}
              onChange={handleFileInput}
            />
          </label>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Max {formatBytes(MAX_FILE_SIZE)} per file
        </p>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map(upload => (
            <div key={upload.fileId}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="shrink-0">
                {upload.status === 'done' && <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />}
                {upload.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                {upload.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="truncate text-xs font-medium text-foreground">{upload.fileName}</p>
                {upload.status === 'uploading' && (
                  <Progress value={upload.progress} className="h-1" />
                )}
                {upload.status === 'error' && (
                  <p className="text-xs text-destructive">{upload.error}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => removeUpload(upload.fileId)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
