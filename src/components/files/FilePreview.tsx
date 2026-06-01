import React, { useEffect, useState } from 'react';
import { X, Download, Loader2, AlertCircle, Code2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getSignedUrl, downloadFile, isRunnable, isCodeFile } from '@/services/fileService';
import { formatBytes } from '@/services/profileService';
import { FileIcon } from './FileIcon';
import type { CloudFile } from '@/types/types';
import { toast } from 'sonner';

interface FilePreviewProps {
  file: CloudFile | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (file: CloudFile) => void;
}

export function FilePreview({ file, open, onClose, onEdit }: FilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !open) { setUrl(null); setError(null); return; }
    setLoading(true);
    getSignedUrl(file.storage_path)
      .then(u => { setUrl(u); setLoading(false); })
      .catch(() => { setError('Could not load preview.'); setLoading(false); });
  }, [file, open]);

  if (!file) return null;

  const ext = file.original_name.split('.').pop()?.toLowerCase() || '';
  const isCode = isCodeFile(file.name);
  const canRun = isRunnable(file.name);
  const isText = file.mime_type === 'text/plain' || ext === 'txt';
  const isPdf = file.mime_type === 'application/pdf';

  const canPreview =
    ['images', 'videos', 'audio'].includes(file.file_type) ||
    isPdf || isText || isCode;

  const handleRun = async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const tab = window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      if (!tab) toast.error('Popup blocked — allow popups for this site.');
    } catch { toast.error('Could not run file.'); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] md:max-w-3xl bg-card border-border p-0 overflow-hidden [&>button]:hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon file={file} className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.file_size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canRun && (
              <Button variant="ghost" size="sm"
                className="gap-1.5 h-7 text-xs border border-border/60 text-orange-400 hover:text-orange-300 hover:bg-muted"
                onClick={handleRun}>
                <Play className="h-3.5 w-3.5" /> Run
              </Button>
            )}
            {isCode && onEdit && (
              <Button variant="ghost" size="sm"
                className="gap-1.5 h-7 text-xs border border-border/60 text-cyan-400 hover:text-cyan-300 hover:bg-muted"
                onClick={() => { onClose(); onEdit(file); }}>
                <Code2 className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => downloadFile(file)} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex min-h-[300px] max-h-[70vh] items-center justify-center overflow-auto bg-muted/20 p-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && url && (
            <>
              {file.file_type === 'images' && (
                <img src={url} alt={file.name}
                  className="max-h-[65vh] max-w-full rounded-lg object-contain" />
              )}
              {file.file_type === 'videos' && (
                <div className="w-full rounded-lg overflow-hidden bg-black">
                  <video src={url} controls autoPlay={false} playsInline
                    className="w-full max-h-[65vh] object-contain block"
                    style={{ aspectRatio: 'auto' }}>
                    Your browser does not support video playback.
                  </video>
                </div>
              )}
              {file.file_type === 'audio' && (
                <div className="w-full max-w-sm space-y-4">
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                      <FileIcon file={file} className="h-10 w-10" />
                    </div>
                    <p className="text-sm font-medium text-foreground text-center">{file.name}</p>
                  </div>
                  <audio src={url} controls className="w-full" autoPlay={false} />
                </div>
              )}
              {isPdf && (
                <iframe src={url} className="h-[65vh] w-full rounded-lg" title={file.name} />
              )}
              {/* Code / text files */}
              {(isCode || isText) && (
                <CodePreview url={url} ext={ext} />
              )}
            </>
          )}

          {!loading && !error && !canPreview && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileIcon file={file} className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No preview available</p>
                <p className="text-xs text-muted-foreground mt-1">Download the file to open it</p>
              </div>
              <Button onClick={() => downloadFile(file)} className="gap-2">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CodePreview — read-only syntax-styled view ───────────────────────────────
const EXT_COLOR: Record<string, string> = {
  html: 'text-orange-300', htm: 'text-orange-300',
  css: 'text-blue-300',
  js: 'text-yellow-300', mjs: 'text-yellow-300', cjs: 'text-yellow-300',
  ts: 'text-blue-400', tsx: 'text-blue-300', jsx: 'text-cyan-300',
  json: 'text-green-300', jsonc: 'text-green-300',
  xml: 'text-rose-300', yaml: 'text-purple-300', yml: 'text-purple-300',
  py: 'text-yellow-200', php: 'text-indigo-300', rb: 'text-red-300',
  go: 'text-cyan-300', rs: 'text-orange-400', java: 'text-orange-300',
  sql: 'text-sky-300', sh: 'text-green-200', bash: 'text-green-200',
};

function CodePreview({ url, ext }: { url: string; ext: string }) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(url)
      .then(r => r.text())
      .then(t => { setText(t); setLoaded(true); })
      .catch(() => { setText('// Could not load file content.'); setLoaded(true); });
  }, [url]);

  const lineCount = text.split('\n').length;
  const codeColor = EXT_COLOR[ext] || 'text-foreground';

  return (
    <div className="w-full h-[60vh] flex overflow-hidden rounded-lg border border-border/40 bg-[#0d0d0d] font-mono text-xs">
      {/* Line numbers */}
      <div className="shrink-0 select-none border-r border-border/30 bg-[#111111] overflow-y-auto py-4 px-3 text-right"
        style={{ width: `${Math.max(3, String(lineCount).length) + 2}ch` }}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-5 text-muted-foreground/30">{i + 1}</div>
        ))}
      </div>
      {/* Code */}
      <div className="flex-1 overflow-auto py-4 px-4">
        {loaded ? (
          <pre className={cn('leading-5 whitespace-pre', codeColor)}>
            {text}
          </pre>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground pt-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
      </div>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    fetch(url).then(r => r.text()).then(setText).catch(() => setText('Could not load text.'));
  }, [url]);
  return (
    <pre className="max-h-[60vh] w-full overflow-auto rounded-lg bg-muted p-4 text-xs text-foreground whitespace-pre-wrap font-mono">
      {text || 'Loading…'}
    </pre>
  );
}

