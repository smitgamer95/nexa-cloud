import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Loader2, Code2, ExternalLink, RotateCcw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getSignedUrl, saveFileContent, isRunnable, listFiles } from '@/services/fileService';
import { getLangInfo } from '@/services/codeRunner';
import { formatBytes } from '@/services/profileService';
import { FileIcon } from './FileIcon';
import { CodeRunner } from './CodeRunner';
import type { CloudFile } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';

interface CodeEditorProps {
  file: CloudFile | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}


// ── Asset inliner ──────────────────────────────────────────────────────────
// Scans HTML for <link href="X.css"> and <script src="X.js"> then fetches
// each sibling file from Supabase Storage and inlines it so the blob URL
// preview is fully self-contained (blob: has no origin → relative refs fail).
async function resolveHtmlAssets(
  html: string,
  userId: string,
  folderId: string | null,
): Promise<string> {
  // 1. Fetch files in the SAME folder. If at root, folderId is null.
  //    Also fetch ALL root files as fallback so cross-location refs still work.
  const [siblings, rootFiles] = await Promise.all([
    listFiles(userId, folderId),
    folderId !== null ? listFiles(userId, null) : Promise.resolve([]),
  ]);
  const allFiles = [...siblings, ...rootFiles];

  // 2. Resolve a filename to its text content
  const fetchFileText = async (refName: string): Promise<string | null> => {
    // Strip query string and leading path segments
    const bare = decodeURIComponent(refName.split('?')[0].split('/').pop() || refName).toLowerCase();
    if (!bare) return null;
    const match = allFiles.find(
      f => f.name.toLowerCase() === bare || f.original_name.toLowerCase() === bare,
    );
    if (!match) return null;
    try {
      const url = await getSignedUrl(match.storage_path);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; }
  };

  let out = html;

  // 3. Inline CSS: <link ... href="*.css" ...>
  // Matches both attribute orderings robustly
  const cssTagRe = /<link\s[^>]*>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  const relRe = /rel=["']stylesheet["']/i;
  for (const tag of [...out.matchAll(cssTagRe)].map(m => m[0])) {
    const hrefMatch = hrefRe.exec(tag);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].split('?')[0];
    if (href.startsWith('http') || href.startsWith('//') || href.startsWith('data:')) continue;
    // Accept any href ending .css OR tags with rel="stylesheet"
    if (!href.endsWith('.css') && !relRe.test(tag)) continue;
    const css = await fetchFileText(href);
    if (css !== null) {
      out = out.replace(tag, `<style>/* inlined: ${href} */
${css}
</style>`);
    }
  }

  // 4. Inline JS: <script src="X.js"></script>
  const scriptSrcRe = /<script[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  for (const m of [...out.matchAll(scriptSrcRe)]) {
    const src = m[1].split('?')[0];
    if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) continue;
    const js = await fetchFileText(src);
    if (js !== null) {
      out = out.replace(m[0], `<script>/* inlined: ${src} */
${js}
</script>`);
    }
  }

  return out;
}
// Language label shown in the status bar
function langLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'HTML', htm: 'HTML', css: 'CSS',
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
    ts: 'TypeScript', tsx: 'TSX', jsx: 'JSX',
    json: 'JSON', jsonc: 'JSON', xml: 'XML',
    md: 'Markdown', mdx: 'MDX',
    yaml: 'YAML', yml: 'YAML', toml: 'TOML', ini: 'INI',
    py: 'Python', php: 'PHP', rb: 'Ruby',
    go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin',
    c: 'C', cpp: 'C++', h: 'C Header', hpp: 'C++ Header', cs: 'C#',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh', fish: 'Fish',
    sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL',
    vue: 'Vue', svelte: 'Svelte', csv: 'CSV',
    txt: 'Plain Text',
  };
  return map[ext] || ext.toUpperCase() || 'Text';
}

export function CodeEditor({ file, open, onClose, onSaved }: CodeEditorProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrcdoc, setPreviewSrcdoc] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);

  // Keep ref in sync so CodeRunner always gets latest unsaved code
  useEffect(() => { contentRef.current = content; }, [content]);

  const isDirty = content !== original;

  // Load file content
  useEffect(() => {
    if (!file || !open) {
      setContent(''); setOriginal(''); setTerminalOpen(false); return;
    }
    setLoading(true);
    getSignedUrl(file.storage_path)
      .then(url => fetch(url))
      .then(r => r.text())
      .then(text => {
        setContent(text);
        setOriginal(text);
        setLineCount(text.split('\n').length);
      })
      .catch(() => toast.error('Could not load file content.'))
      .finally(() => setLoading(false));
  }, [file, open]);

  // Sync line numbers scroll with textarea scroll
  const syncScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setLineCount(val.split('\n').length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newVal);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const updateCursor = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const before = content.substring(0, ta.selectionStart);
    const lines = before.split('\n');
    setCursorLine(lines.length);
    setCursorCol(lines[lines.length - 1].length + 1);
  };

  const handleSave = async () => {
    if (!file || !user || !isDirty) return;
    setSaving(true);
    try {
      await saveFileContent(file, user.id, content);
      setOriginal(content);
      toast.success('File saved.');
      onSaved?.();
    } catch {
      toast.error('Save failed.');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    setContent(original);
    setLineCount(original.split('\n').length);
  };

  // HTML → resolve CSS/JS assets from same folder then open in new tab
  const handleRunBrowser = async () => {
    if (!file || !user) return;
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const resolved = await resolveHtmlAssets(content, user.id, file.folder_id ?? null);
      setPreviewSrcdoc(resolved);
    } catch {
      toast.error('Could not bundle preview assets.');
      setPreviewOpen(false);
    } finally { setPreviewLoading(false); }
  };

  if (!file) return null;

  const canRunBrowser = isRunnable(file.name);
  const langInfo = getLangInfo(file.name);
  const canRunTerminal = langInfo.runnable;
  const terminalWidth = terminalOpen ? 'w-80' : 'w-0';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-6xl h-[90vh] bg-[#0d0d0d] border-border p-0 flex flex-col overflow-hidden [&>button]:hidden">

        {/* ── Title bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border/60 bg-[#111111] px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Code2 className="h-4 w-4 text-primary shrink-0" />
            <FileIcon file={file} className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
            {isDirty && <span className="shrink-0 h-2 w-2 rounded-full bg-primary" title="Unsaved changes" />}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Run in browser (HTML only) */}
            {canRunBrowser && (
              <Button variant="ghost" size="sm"
                className={cn(
                  'gap-1.5 h-7 text-xs border',
                  previewOpen
                    ? 'border-orange-500/60 text-orange-400 hover:bg-muted'
                    : 'border-border/60 text-orange-400 hover:text-orange-300 hover:bg-muted',
                )}
                onClick={previewOpen ? () => setPreviewOpen(false) : handleRunBrowser}>
                {previewLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Bundling…</>
                  : previewOpen
                  ? <><X className="h-3.5 w-3.5" /> Close Preview</>
                  : <><ExternalLink className="h-3.5 w-3.5" /> Preview</>
                }
              </Button>
            )}
            {/* Terminal toggle (all runnable code) */}
            {canRunTerminal && (
              <Button variant="ghost" size="sm"
                className={cn(
                  'gap-1.5 h-7 text-xs border',
                  terminalOpen
                    ? 'border-primary/60 text-primary hover:bg-muted'
                    : 'border-border/60 text-foreground hover:bg-muted',
                )}
                onClick={() => setTerminalOpen(o => !o)}>
                <Terminal className="h-3.5 w-3.5" />
                {terminalOpen ? 'Hide Terminal' : 'Run'}
              </Button>
            )}
            {isDirty && (
              <Button variant="ghost" size="sm"
                className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" /> Revert
              </Button>
            )}
            <Button
              variant="ghost" size="sm"
              className={cn(
                'gap-1.5 h-7 text-xs',
                isDirty
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Editor + Terminal split ────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Editor pane */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden font-mono text-sm">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading…</span>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Line numbers */}
                <div
                  ref={lineNumbersRef}
                  className="shrink-0 overflow-hidden select-none bg-[#111111] border-r border-border/40 text-right py-4 pr-3 pl-3"
                  style={{ width: `${Math.max(3, String(lineCount).length) + 2}ch` }}
                  aria-hidden
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'leading-6 text-xs',
                        i + 1 === cursorLine ? 'text-primary' : 'text-muted-foreground/40',
                      )}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onSelect={updateCursor}
                  onClick={updateCursor}
                  onScroll={syncScroll}
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  className={cn(
                    'flex-1 min-w-0 resize-none outline-none border-none',
                    'bg-transparent text-foreground leading-6 text-sm',
                    'py-4 px-4 overflow-auto',
                    'placeholder:text-muted-foreground/30',
                  )}
                  style={{ tabSize: 2 }}
                  placeholder="// start coding…"
                />
              </div>
            )}
          </div>

          {/* Preview pane (HTML srcdoc — CSS/JS fully inlined) */}
          {previewOpen && (
            <div className="shrink-0 border-l border-border/40 overflow-hidden flex flex-col" style={{width:'50%', minWidth:'280px'}}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#111] border-b border-border/40 shrink-0">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ExternalLink className="h-3 w-3 text-orange-400" /> HTML Preview
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
                    onClick={handleRunBrowser} disabled={previewLoading}>
                    {previewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Refresh
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setPreviewOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {previewLoading ? (
                <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Bundling assets…</span>
                </div>
              ) : (
                <iframe
                  srcDoc={previewSrcdoc}
                  sandbox="allow-scripts allow-same-origin"
                  className="flex-1 w-full bg-white border-0"
                  title="HTML Preview"
                />
              )}
            </div>
          )}

          {/* Terminal pane (slide in/out) */}
          {terminalOpen && (
            <div className={cn('shrink-0 border-l border-border/40 overflow-hidden transition-all', terminalWidth, 'w-80')}>
              <CodeRunner
                fileName={file.name}
                getCode={() => contentRef.current}
                onClose={() => setTerminalOpen(false)}
              />
            </div>
          )}
        </div>

        {/* ── Status bar ────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-t border-border/40 bg-[#111111] px-4 py-1 text-xs text-muted-foreground/60 select-none">
          <div className="flex items-center gap-4">
            <span>{langLabel(file.name)}</span>
            <span>{formatBytes(file.file_size)}</span>
            {isDirty && <span className="text-primary">● Modified</span>}
          </div>
          <div className="flex items-center gap-4">
            <span>Ln {cursorLine}, Col {cursorCol}</span>
            <span>{lineCount} lines</span>
            <span title="Press Ctrl+S to save">Ctrl+S</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
