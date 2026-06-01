import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, FileX, Loader2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileIcon } from '@/components/files/FileIcon';
import { getShareLinkFile, downloadFile } from '@/services/fileService';
import { formatBytes } from '@/services/profileService';
import type { CloudFile } from '@/types/types';

const LOGO_URL = 'https://i.postimg.cc/HnxcmmVK/Chat-GPT-Image-May-22-2026-01-39-42-PM.png';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<CloudFile | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [webRunSrcdoc, setWebRunSrcdoc] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); setExpired(true); return; }
    getShareLinkFile(token)
      .then(result => {
        if (!result) { setExpired(true); return; }
        setFile(result.file);
        setSignedUrl(result.signedUrl);
      })
      .catch(() => setExpired(true))
      .finally(() => setLoading(false));
  }, [token]);

  const ext = file?.original_name?.split('.').pop()?.toLowerCase() || '';
  const isImage = file?.file_type === 'images';
  const isVideo = file?.file_type === 'videos';
  const isAudio = file?.file_type === 'audio';
  const isPdf = file?.mime_type === 'application/pdf' || ext === 'pdf';
  const isHtml = ext === 'html' || ext === 'htm';

  const handleRunInWeb = async () => {
    if (!signedUrl) return;
    try {
      const res = await fetch(signedUrl);
      const html = await res.text();
      setWebRunSrcdoc(html);
    } catch { alert('Could not load file.'); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3">
        <Link to="/" className="flex items-center gap-2.5 w-fit">
          <img src={LOGO_URL} alt="NexaCloud" className="h-8 w-8 rounded-xl object-cover shrink-0" draggable={false} />
          <span className="text-base font-bold text-foreground tracking-tight">NexaCloud</span>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">Loading shared file…</p>
          </div>
        ) : expired || !file ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FileX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Link not found or expired</h1>
            <p className="text-sm text-muted-foreground text-pretty">
              This share link may have expired or been deleted by the owner.
            </p>
            <Link to="/">
              <Button variant="ghost" className="border border-border text-foreground hover:bg-muted">
                Go to NexaCloud
              </Button>
            </Link>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-6">
            {/* File info card */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted shrink-0">
                  <FileIcon file={file} className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-foreground truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(file.file_size)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button className="gap-2" onClick={() => downloadFile(file)}>
                  <Download className="h-4 w-4" /> Download
                </Button>
                {isHtml && !webRunSrcdoc && (
                  <Button variant="ghost"
                    className="gap-2 border border-border text-orange-400 hover:text-orange-300 hover:bg-muted"
                    onClick={handleRunInWeb}>
                    <Monitor className="h-4 w-4" /> Run in Web
                  </Button>
                )}
                {isHtml && webRunSrcdoc && (
                  <Button variant="ghost"
                    className="gap-2 border border-border text-muted-foreground hover:bg-muted"
                    onClick={() => setWebRunSrcdoc(null)}>
                    Close Preview
                  </Button>
                )}
              </div>
            </div>

            {/* In-app web preview */}
            {webRunSrcdoc && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
                  <Monitor className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-xs text-muted-foreground">Run in Web — {file.name}</span>
                </div>
                <iframe
                  key={webRunSrcdoc}
                  srcDoc={webRunSrcdoc}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                  className="w-full border-0 bg-white"
                  style={{ height: '60vh' }}
                  title={file.name}
                />
              </div>
            )}

            {/* Media preview */}
            {signedUrl && !webRunSrcdoc && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {isImage && (
                  <div className="flex items-center justify-center p-4 bg-muted/20">
                    <img src={signedUrl} alt={file.name}
                      className="max-h-[60vh] max-w-full rounded-xl object-contain" />
                  </div>
                )}
                {isVideo && (
                  <video src={signedUrl} controls
                    className="w-full max-h-[60vh]"
                    playsInline
                    style={{ display: 'block' }}
                  />
                )}
                {isAudio && (
                  <div className="p-6">
                    <audio src={signedUrl} controls className="w-full" />
                  </div>
                )}
                {isPdf && (
                  <iframe src={signedUrl} className="w-full" style={{ height: '70vh' }} title={file.name} />
                )}
                {!isImage && !isVideo && !isAudio && !isPdf && (
                  <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                    <FileIcon file={file} className="h-12 w-12" />
                    <p className="text-sm">Preview not available — download to view</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground/50">
              Shared via{' '}
              <Link to="/" className="hover:text-primary transition-colors">NexaCloud</Link>
              {' '}· Your Files. Your Privacy.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
