import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Play, Loader2, Terminal, X, Trash2, Plus,
  Code2, Monitor, ChevronDown, CheckCircle2, XCircle,
  FolderOpen, RefreshCw, PanelLeftClose, PanelLeft,
  Pencil, Download, Upload, FolderPlus, ChevronRight,
  Minimize2, Maximize2, AlertCircle, Globe, Cpu,
  Cloud, FileCode, Zap,
} from 'lucide-react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { runCode, getLangInfo, type RunResult } from '@/services/codeRunner';
import { createTextFile, listAllFolders, listFiles, getSignedUrl } from '@/services/fileService';
import { useAuth } from '@/contexts/AuthContext';
import type { CloudFolder, CloudFile } from '@/types/types';
import { toast } from 'sonner';

const LOGO_URL = 'https://i.postimg.cc/HnxcmmVK/Chat-GPT-Image-May-22-2026-01-39-42-PM.png';

// ── Types ──────────────────────────────────────────────────────────────────
interface EditorFile {
  id: string;
  name: string;
  content: string;
  dirty: boolean;
  folderId?: string | null;        // which compiler folder it belongs to (null = root)
  savedCloudFolderId?: string | null; // persisted save location in NexaCloud
}
interface EditorFolder {
  id: string;
  name: string;
  open: boolean;
}
interface RunRecord {
  id: number;
  status: 'success' | 'error';
  stdout: string;
  stderr: string;
  exitCode: number;
  language: string;
  engine: string;
  durationMs: number;
}

// ── Language helpers ──────────────────────────────────────────────────────
const LANG_FROM_EXT: Record<string, string> = {
  js:'javascript', mjs:'javascript', cjs:'javascript', jsx:'javascript',
  ts:'typescript', tsx:'typescript',
  py:'python', html:'html', htm:'html', css:'css',
  json:'json', md:'markdown', mdx:'markdown',
  cpp:'cpp', c:'c', h:'c', hpp:'cpp',
  java:'java', go:'go', rs:'rust', rb:'ruby',
  php:'php', sh:'shell', bash:'shell', sql:'sql',
  xml:'xml', yaml:'yaml', yml:'yaml', toml:'ini',
  cs:'csharp', kt:'kotlin', swift:'swift', r:'r', lua:'lua',
};
const LANG_COLORS: Record<string, string> = {
  javascript:'text-yellow-400', typescript:'text-blue-400',
  python:'text-green-400', html:'text-orange-400', css:'text-blue-300',
  cpp:'text-purple-400', c:'text-purple-300', java:'text-red-400',
  go:'text-cyan-400', rust:'text-orange-500', ruby:'text-red-300',
  php:'text-indigo-400', shell:'text-green-300', json:'text-green-300',
  sql:'text-sky-300', markdown:'text-muted-foreground',
};
const STARTERS: Record<string, string> = {
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>My Page</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <script src="script.js"></script>\n</body>\n</html>`,
  css: `* { box-sizing: border-box; margin: 0; padding: 0; }\nbody {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n  background: #0f0f0f;\n  color: #f0f0f0;\n}\nh1 { font-size: 2rem; color: #60a5fa; }`,
  js: `console.log("Hello, World!");\n`,
  py: `print("Hello, World!")\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  ts: `const greet = (name: string): string => \`Hello, \${name}!\`;\nconsole.log(greet("World"));\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n`,
  rs: `fn main() {\n    println!("Hello, World!");\n}\n`,
  rb: `puts "Hello, World!"\n`,
  php: `<?php\necho "Hello, World!\\n";\n`,
  sh: `#!/bin/bash\necho "Hello, World!"\n`,
};
const QUICK_LANGS = [
  {label:'HTML',ext:'html'},{label:'CSS',ext:'css'},{label:'JavaScript',ext:'js'},
  {label:'TypeScript',ext:'ts'},{label:'Python',ext:'py'},{label:'C',ext:'c'},
  {label:'C++',ext:'cpp'},{label:'Java',ext:'java'},{label:'Go',ext:'go'},
  {label:'Rust',ext:'rs'},{label:'Ruby',ext:'rb'},{label:'PHP',ext:'php'},
  {label:'Bash',ext:'sh'},{label:'SQL',ext:'sql'},{label:'JSON',ext:'json'},
  {label:'Markdown',ext:'md'},{label:'YAML',ext:'yaml'},{label:'XML',ext:'xml'},
];
const TEMPLATES = [
  {label:'HTML + CSS + JS', files:['index.html','style.css','script.js']},
  {label:'Python Script',   files:['main.py']},
  {label:'C Program',       files:['main.c']},
  {label:'C++ Program',     files:['main.cpp']},
  {label:'TypeScript',      files:['main.ts']},
  {label:'Go Program',      files:['main.go']},
  {label:'Java',            files:['Main.java']},
  {label:'Rust',            files:['main.rs']},
];

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function getExt(name: string) { return name.split('.').pop()?.toLowerCase() || ''; }
function getMonacoLang(name: string): string { return LANG_FROM_EXT[getExt(name)] || 'plaintext'; }
function langColor(name: string) { return LANG_COLORS[getMonacoLang(name)] || 'text-muted-foreground'; }

// ── Build inlined HTML for preview ────────────────────────────────────────
function buildHtmlPreview(files: EditorFile[]): string {
  const fileMap = Object.fromEntries(files.map(f => [f.name.toLowerCase(), f.content]));
  let html = fileMap['index.html'] || files.find(f => getExt(f.name) === 'html')?.content || '';
  if (!html) return '<div style="font-family:system-ui;padding:2rem;background:#0f0f0f;color:#888;height:100vh;display:flex;align-items:center;justify-content:center"><p>No HTML file. Create an <code style="color:#60a5fa">index.html</code> to preview.</p></div>';
  html = html.replace(/<link\s[^>]*href=["']([^"']+\.css)["'][^>]*\/?>/gi, (orig, href) => {
    const key = href.split('/').pop()?.toLowerCase() || '';
    return fileMap[key] ? `<style>/* inlined: ${href} */\n${fileMap[key]}\n</style>` : orig;
  });
  html = html.replace(/<script[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (orig, src) => {
    const key = src.split('/').pop()?.toLowerCase() || '';
    return fileMap[key] ? `<script>/* inlined: ${src} */\n${fileMap[key]}\n</script>` : orig;
  });
  return html;
}

// ── Opening Splash Animation ───────────────────────────────────────────────
function CompilerSplash({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [progress, setProgress] = useState(0);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 60);
    const t2 = setTimeout(() => { setGlitch(true); setTimeout(() => setGlitch(false), 180); }, 900);
    const t3 = setTimeout(() => setPhase('exit'), 2000);
    const t4 = setTimeout(() => onDone(), 2550);

    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + Math.random() * 15 + 5);
      setProgress(p);
      if (p >= 100) clearInterval(iv);
    }, 80);

    // Matrix rain canvas
    const canvas = canvasRef.current;
    if (!canvas) return () => { clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);clearTimeout(t4);clearInterval(iv); };
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / 18);
    const drops = Array(cols).fill(1);
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01ハヒフヘホマミムメモ';
    let frame = 0;
    const draw = () => {
      frame++;
      ctx.fillStyle = 'rgba(5,5,5,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(99,102,241,0.55)';
      ctx.font = '13px monospace';
      drops.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 18, y * 18);
        if (y * 18 > canvas.height && Math.random() > 0.97) drops[i] = 0;
        drops[i]++;
      });
    };
    const raf = setInterval(draw, 45);

    return () => {
      clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);clearTimeout(t4);
      clearInterval(iv);clearInterval(raf);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #0e0e1a 0%, #030303 100%)',
        opacity: phase === 'enter' ? 0 : phase === 'hold' ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: phase === 'exit' ? 'none' : undefined,
      }}
    >
      {/* Matrix rain */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" />

      {/* Centre glow */}
      <div className="absolute pointer-events-none" style={{
        width: 360, height: 360,
        background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />

      {/* Outer orbit rings */}
      <div className="absolute pointer-events-none rounded-full" style={{
        width: 200, height: 200,
        border: '1px solid rgba(99,102,241,0.25)',
        animation: 'spin 4s linear infinite',
      }} />
      <div className="absolute pointer-events-none rounded-full" style={{
        width: 240, height: 240,
        borderTop: '2px solid rgba(99,102,241,0.7)',
        borderRight: '2px solid rgba(99,102,241,0.12)',
        borderBottom: '2px solid transparent',
        borderLeft: '2px solid transparent',
        borderRadius: '50%',
        animation: 'spin 1.0s linear infinite',
      }} />
      <div className="absolute pointer-events-none rounded-full" style={{
        width: 170, height: 170,
        borderBottom: '1.5px solid rgba(139,92,246,0.5)',
        borderLeft: '1.5px solid rgba(139,92,246,0.12)',
        borderTop: '1.5px solid transparent',
        borderRight: '1.5px solid transparent',
        borderRadius: '50%',
        animation: 'spin 1.6s linear infinite reverse',
      }} />

      {/* Logo */}
      <div className="relative z-10" style={{
        transform: phase === 'hold' ? 'scale(1)' : 'scale(0.6)',
        opacity: phase === 'hold' ? 1 : 0,
        transition: 'all 0.7s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          position: 'absolute', inset: -12, borderRadius: 28,
          background: 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)',
          filter: 'blur(18px)', opacity: 0.8,
        }} />
        <img
          src={LOGO_URL}
          alt="NexaCloud"
          draggable={false}
          style={{
            position: 'relative',
            width: 88, height: 88, borderRadius: 22,
            objectFit: 'cover',
            boxShadow: '0 0 60px rgba(99,102,241,0.6), 0 0 120px rgba(99,102,241,0.2)',
            filter: glitch ? 'hue-rotate(90deg) saturate(3)' : 'none',
            transform: glitch ? 'translateX(4px) skewX(-3deg)' : 'none',
            transition: glitch ? 'none' : 'filter 0.15s, transform 0.15s',
          }}
        />
      </div>

      {/* Text */}
      <div className="relative z-10 mt-7 text-center" style={{
        opacity: phase === 'hold' ? 1 : 0,
        transform: phase === 'hold' ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.7s ease 0.15s',
      }}>
        <p style={{
          fontFamily: 'monospace',
          fontSize: 22, fontWeight: 700, color: '#fff',
          letterSpacing: '-0.5px',
          filter: glitch ? 'blur(2px)' : 'none',
          textShadow: glitch
            ? '2px 0 #f00, -2px 0 #0ff'
            : '0 0 20px rgba(99,102,241,0.6)',
        }}>
          NexaCloud Compiler
        </p>
        <p style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
          Monaco Editor · VS Code Engine
        </p>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mt-8 w-52" style={{
        opacity: phase === 'hold' ? 1 : 0,
        transition: 'opacity 0.5s ease 0.3s',
      }}>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            width: `${progress}%`,
            boxShadow: '0 0 12px rgba(99,102,241,0.8)',
            transition: 'width 0.12s ease-out',
          }} />
        </div>
        <p style={{ marginTop: 8, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: 2, fontFamily: 'monospace' }}>
          {progress < 35 ? 'LOADING MONACO...' : progress < 70 ? 'INITIALIZING ENGINE...' : progress < 99 ? 'ALMOST READY...' : 'READY'}
        </p>
      </div>
    </div>
  );
}

// ── New File Modal ─────────────────────────────────────────────────────────
function NewFileModal({ onAdd, onClose, folders }: {
  onAdd: (name: string, folderId: string | null) => void;
  onClose: () => void;
  folders: EditorFolder[];
}) {
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, folderId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-border rounded-xl shadow-2xl p-5 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> New File
        </h3>
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          placeholder="filename.js"
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          className="w-full rounded-lg bg-muted/20 border border-border text-foreground text-sm px-3 py-2 outline-none focus:border-primary" />
        {folders.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Add to folder (optional)</label>
            <select value={folderId ?? ''} onChange={e => setFolderId(e.target.value || null)}
              className="w-full rounded-lg bg-muted/20 border border-border text-foreground text-sm px-3 py-2 outline-none focus:border-primary">
              <option value="">Root (no folder)</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="border border-border text-foreground hover:bg-muted/30 h-8">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Save to Cloud Modal ────────────────────────────────────────────────────
function SaveToCloudModal({ file, userId, onSaved, onClose }: {
  file: EditorFile; userId: string;
  onSaved: (f: EditorFile) => void; onClose: () => void;
}) {
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  // Pre-select the previously saved folder if exists
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    file.savedCloudFolderId !== undefined ? file.savedCloudFolderId ?? null : null
  );
  const [fileName, setFileName] = useState(file.name);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAllFolders(userId).then(f => { setFolders(f); setLoadingFolders(false); });
  }, [userId]);

  const flatTree: { id: string | null; name: string; depth: number }[] = [{ id: null, name: 'My Files (root)', depth: 0 }];
  function addChildren(parentId: string | null, depth: number) {
    folders.filter(f => (f.parent_id ?? null) === parentId)
      .forEach(f => { flatTree.push({ id: f.id, name: f.name, depth }); addChildren(f.id, depth + 1); });
  }
  if (!loadingFolders) addChildren(null, 1);

  const handleSave = async () => {
    const name = fileName.trim(); if (!name) return;
    setSaving(true);
    try {
      const ext = getExt(name) || 'txt';
      await createTextFile(userId, name.replace(/\.[^.]+$/, ''), file.content, selectedFolderId, ext);
      toast.success(`"${name}" saved to NexaCloud!`);
      // Persist save location so next Ctrl+S skips asking
      onSaved({ ...file, dirty: false, savedCloudFolderId: selectedFolderId });
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-border rounded-xl shadow-2xl p-5 w-96 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" /> Save to NexaCloud
        </h3>
        {file.savedCloudFolderId !== undefined && (
          <p className="text-xs text-muted-foreground/60 -mt-2">
            Location remembered — change if needed, or just hit Save.
          </p>
        )}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">File name</label>
          <input value={fileName} onChange={e => setFileName(e.target.value)}
            className="w-full rounded-lg bg-muted/20 border border-border text-foreground text-sm px-3 py-2 outline-none focus:border-primary" autoFocus />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" /> Save location
          </label>
          {loadingFolders ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading folders…
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/10 py-1">
              {flatTree.map(item => (
                <button key={item.id ?? '__root'} onClick={() => setSelectedFolderId(item.id)}
                  style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                  className={cn('w-full flex items-center gap-2 py-1.5 text-xs transition-colors',
                    selectedFolderId === item.id ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground')}>
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />{item.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="border border-border text-foreground hover:bg-muted/30 h-8">Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !fileName.trim()} className="h-8 gap-1.5">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Cloud className="h-3.5 w-3.5" />Save</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Run Record ─────────────────────────────────────────────────────────────
function RunRecordView({ record }: { record: RunRecord }) {
  const ok = record.status === 'success';
  return (
    <div className={cn('rounded border text-xs mb-2', ok ? 'border-green-900/40' : 'border-red-900/40')}>
      <div className={cn('flex items-center gap-2 px-2 py-1 rounded-t', ok ? 'bg-green-950/30' : 'bg-red-950/30')}>
        {ok ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" /> : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
        <span className={ok ? 'text-green-300' : 'text-red-300'}>exit {record.exitCode}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground/60">{record.durationMs}ms</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground/50 truncate">{record.language}</span>
        <span className="ml-auto text-muted-foreground/30">{record.engine}</span>
      </div>
      {record.stdout && (
        <pre className="px-3 py-2 whitespace-pre-wrap break-words text-green-200/90 leading-5 max-h-64 overflow-y-auto font-mono text-[11px]">
          {record.stdout}
        </pre>
      )}
      {record.stderr && (
        <pre className={cn('px-3 py-2 whitespace-pre-wrap break-words text-red-300/90 leading-5 max-h-64 overflow-y-auto font-mono text-[11px]', record.stdout ? 'border-t border-border/20' : '')}>
          {record.stderr}
        </pre>
      )}
      {!record.stdout && !record.stderr && (
        <p className="px-3 py-2 text-muted-foreground/40 italic text-[11px]">No output.</p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CompilerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [splash, setSplash] = useState(true);
  const [visible, setVisible] = useState(false);
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [folders, setFolders] = useState<EditorFolder[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [runRecords, setRunRecords] = useState<RunRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrcdoc, setPreviewSrcdoc] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [saveModal, setSaveModal] = useState<EditorFile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stdin, setStdin] = useState('');
  const [stdinOpen, setStdinOpen] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderVal, setRenameFolderVal] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Splash done → fade in
  const handleSplashDone = useCallback(() => {
    setSplash(false);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // ── Init from nav state OR start empty
  useEffect(() => {
    const state = location.state as { file?: { name: string; content: string } } | null;
    if (state?.file) {
      const f: EditorFile = { id: makeId(), name: state.file.name, content: state.file.content, dirty: false, folderId: null };
      setFiles([f]);
      setActiveId(f.id);
      window.history.replaceState({}, '');
    }
    // else: start empty — show empty state
  }, []);

  const activeFile = files.find(f => f.id === activeId) ?? null;
  const activeInfo = activeFile ? getLangInfo(activeFile.name) : null;
  const canRunCode = activeInfo?.runnable ?? false;
  const hasHtml = files.some(f => getExt(f.name) === 'html');

  const updateContent = useCallback((val: string | undefined) => {
    if (val === undefined) return;
    setFiles(prev => prev.map(f => f.id === activeId ? { ...f, content: val, dirty: true } : f));
  }, [activeId]);

  const handleEditorMount = (_editor: unknown, monaco: Monaco) => {
    monaco.editor.defineTheme('nexacloud-dark', {
      base: 'vs-dark', inherit: true, rules: [],
      colors: {
        'editor.background': '#0d0d0d',
        'editorLineNumber.foreground': '#404040',
        'editorLineNumber.activeForeground': '#888888',
        'editor.lineHighlightBackground': '#161616',
        'editorIndentGuide.background': '#2a2a2a',
        'editorIndentGuide.activeBackground': '#404040',
      },
    });
    monaco.editor.setTheme('nexacloud-dark');
  };

  // ── File CRUD
  const addFile = (name: string, folderId: string | null = null) => {
    const ext = getExt(name);
    const f: EditorFile = { id: makeId(), name, content: STARTERS[ext] || '', dirty: false, folderId };
    setFiles(prev => [...prev, f]);
    setActiveId(f.id);
  };

  const deleteFile = (id: string) => {
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (id === activeId) setActiveId(next.length > 0 ? next[next.length - 1].id : '');
      return next;
    });
  };

  const startRename = (f: EditorFile) => { setRenamingId(f.id); setRenameVal(f.name); };
  const commitRename = (id: string) => {
    const n = renameVal.trim();
    if (n) setFiles(prev => prev.map(f => f.id === id ? { ...f, name: n } : f));
    setRenamingId(null);
  };

  // ── Folder CRUD
  const addFolder = (name: string) => {
    const f: EditorFolder = { id: makeId(), name, open: true };
    setFolders(prev => [...prev, f]);
  };

  const deleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setFiles(prev => {
      const moved = prev.map(f => f.folderId === id ? { ...f, folderId: null } : f);
      return moved;
    });
  };

  const toggleFolder = (id: string) =>
    setFolders(prev => prev.map(f => f.id === id ? { ...f, open: !f.open } : f));

  const startRenameFolder = (f: EditorFolder) => { setRenamingFolderId(f.id); setRenameFolderVal(f.name); };
  const commitRenameFolder = (id: string) => {
    const n = renameFolderVal.trim();
    if (n) setFolders(prev => prev.map(f => f.id === id ? { ...f, name: n } : f));
    setRenamingFolderId(null);
  };

  // ── Import from local disk
  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const loaded: EditorFile[] = await Promise.all(
      picked.map(async file => {
        const text = await file.text();
        return { id: makeId(), name: file.name, content: text, dirty: false, folderId: null };
      })
    );
    setFiles(prev => [...prev, ...loaded]);
    setActiveId(loaded[0].id);
    e.target.value = '';
    setShowImport(false);
  };

  // ── Import from NexaCloud cloud
  const handleImportCloud = async (cloudFile: CloudFile) => {
    if (!cloudFile.storage_path) return;
    try {
      const url = await getSignedUrl(cloudFile.storage_path);
      const res = await fetch(url);
      const text = await res.text();
      const f: EditorFile = { id: makeId(), name: cloudFile.original_name || cloudFile.name, content: text, dirty: false, folderId: null };
      setFiles(prev => [...prev, f]);
      setActiveId(f.id);
      setShowImport(false);
      toast.success(`Imported "${f.name}" from NexaCloud`);
    } catch { toast.error('Could not import file.'); }
  };

  // ── Load template
  const loadTemplate = (tplFiles: string[]) => {
    const newFiles = tplFiles.map(name => ({
      id: makeId(), name, content: STARTERS[getExt(name)] || '', dirty: false, folderId: null,
    }));
    setFiles(newFiles);
    setFolders([]);
    setActiveId(newFiles[0].id);
    setRunRecords([]);
    setPreviewOpen(false);
    setTermOpen(false);
  };

  // ── Run code
  const handleRun = async () => {
    if (!activeFile || running) return;
    const info = getLangInfo(activeFile.name);
    if (!info.runnable) { toast.info(`${info.label} files cannot be executed.`); return; }
    setRunning(true); setTermOpen(true); setPreviewOpen(false);
    const start = Date.now();
    try {
      const result: RunResult = await runCode(activeFile.name, activeFile.content, stdin);
      const ms = Date.now() - start;
      setRunRecords(prev => [{
        id: Date.now(),
        status: result.exitCode !== 0 ? 'error' : 'success',
        stdout: result.stdout, stderr: result.stderr,
        exitCode: result.exitCode, language: result.language,
        engine: result.engine, durationMs: ms,
      }, ...prev.slice(0, 19)]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setRunRecords(prev => [{
        id: Date.now(), status: 'error', stdout: '', stderr: msg,
        exitCode: 1, language: activeInfo?.label ?? '', engine: activeInfo?.engine ?? '',
        durationMs: Date.now() - start,
      }, ...prev.slice(0, 19)]);
    } finally { setRunning(false); }
  };

  const handlePreview = () => {
    setPreviewSrcdoc(buildHtmlPreview(files));
    setPreviewOpen(true);
    setTermOpen(false);
  };
  const refreshPreview = () => setPreviewSrcdoc(buildHtmlPreview(files));

  // ── Save: open modal (will remember location if already saved)
  const openSave = useCallback((file: EditorFile) => {
    if (!user) return;
    setSaveModal(file);
  }, [user]);

  // ── Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (activeFile && user) openSave(activeFile); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (canRunCode) handleRun(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeFile, canRunCode, running, user, openSave]);

  // ── Build display tree
  const rootFiles = files.filter(f => !f.folderId);

  return (
    <DashboardLayout>
      {splash && <CompilerSplash onDone={handleSplashDone} />}

      <div className={cn(
        'flex flex-col bg-[#0d0d0d] transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      )} style={{ height: 'calc(100vh - 0px)' }}>

        {/* ── TOP TOOLBAR ──────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border/40 bg-[#111] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <button onClick={() => navigate('/files')} className="hidden sm:flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <img src={LOGO_URL} alt="NexaCloud" className="h-5 w-5 rounded-md object-cover shrink-0" draggable={false} />
              NexaCloud Compiler
            </button>
          </div>

          {activeFile && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 overflow-hidden">
              <FileCode className={cn('h-3.5 w-3.5 shrink-0', langColor(activeFile.name))} />
              <span className="truncate text-foreground/80">{activeFile.name}</span>
              {activeFile.dirty && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {user && activeFile && (
              <Button variant="ghost" size="sm"
                className="h-7 text-xs gap-1.5 border border-border/60 text-foreground hover:bg-muted/30"
                onClick={() => openSave(activeFile)} title="Save to NexaCloud (Ctrl+S)">
                <Cloud className="h-3.5 w-3.5" /><span className="hidden sm:inline">Save</span>
              </Button>
            )}
            {hasHtml && (
              <Button variant="ghost" size="sm"
                className={cn('h-7 text-xs gap-1.5 border',
                  previewOpen ? 'border-orange-500/60 text-orange-400 hover:bg-muted/30' : 'border-border/60 text-orange-400 hover:bg-muted/30')}
                onClick={previewOpen ? () => { setPreviewOpen(false); setPreviewFullscreen(false); } : handlePreview}>
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{previewOpen ? 'Close' : 'Run in Web'}</span>
              </Button>
            )}
            {canRunCode && (
              <Button variant="ghost" size="sm"
                className={cn('h-7 text-xs gap-1.5 border',
                  running ? 'border-primary/60 text-primary' : 'border-border/60 text-green-400 hover:bg-muted/30')}
                onClick={running ? undefined : handleRun} disabled={running} title="Run (Ctrl+Enter)">
                {running
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">Running…</span></>
                  : <><Play className="h-3.5 w-3.5" /><span className="hidden sm:inline">Run</span></>}
              </Button>
            )}
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── FILE EXPLORER ─────────────────────────────────────────── */}
          {sidebarOpen && (
            <div className="w-52 shrink-0 border-r border-border/40 flex flex-col bg-[#111] overflow-hidden">
              {/* Explorer header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Explorer</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowNewFile(true)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5" title="New file">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setShowNewFolder(true)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5" title="New folder">
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setShowImport(true)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5" title="Import files">
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* File tree */}
              <div className="flex-1 overflow-y-auto py-1">
                {files.length === 0 && folders.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
                    <FolderOpen className="h-8 w-8 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/50 leading-relaxed">No files yet.<br />Create or import files to get started.</p>
                    <button onClick={() => setShowNewFile(true)}
                      className="text-[11px] text-primary hover:text-primary/80 underline underline-offset-2">
                      + New file
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Folders */}
                    {folders.map(folder => (
                      <div key={folder.id}>
                        <div className="group flex items-center gap-1 px-2 py-1.5 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/10 select-none">
                          <button onClick={() => toggleFolder(folder.id)} className="shrink-0">
                            <ChevronRight className={cn('h-3 w-3 transition-transform', folder.open && 'rotate-90')} />
                          </button>
                          <FolderOpen className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                          {renamingFolderId === folder.id ? (
                            <input autoFocus value={renameFolderVal} onChange={e => setRenameFolderVal(e.target.value)}
                              onBlur={() => commitRenameFolder(folder.id)}
                              onKeyDown={e => { if (e.key === 'Enter') commitRenameFolder(folder.id); if (e.key === 'Escape') setRenamingFolderId(null); }}
                              className="flex-1 bg-transparent border-b border-primary text-xs text-foreground outline-none min-w-0" />
                          ) : (
                            <span className="flex-1 truncate text-xs" onDoubleClick={() => startRenameFolder(folder)}>{folder.name}</span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                            <button onClick={() => { setShowNewFile(true); }} title="New file in folder" className="hover:text-primary p-0.5"><Plus className="h-2.5 w-2.5" /></button>
                            <button onClick={() => startRenameFolder(folder)} title="Rename" className="hover:text-primary p-0.5"><Pencil className="h-2.5 w-2.5" /></button>
                            <button onClick={() => deleteFolder(folder.id)} title="Delete folder" className="hover:text-destructive p-0.5"><Trash2 className="h-2.5 w-2.5" /></button>
                          </div>
                        </div>
                        {/* Files inside folder */}
                        {folder.open && files.filter(f => f.folderId === folder.id).map(f => (
                          <ExplorerFile key={f.id} file={f} activeId={activeId}
                            renamingId={renamingId} renameVal={renameVal}
                            setActiveId={setActiveId} deleteFile={deleteFile}
                            startRename={startRename} commitRename={commitRename}
                            setRenameVal={setRenameVal} setRenamingId={setRenamingId}
                            indent={24} />
                        ))}
                      </div>
                    ))}
                    {/* Root files */}
                    {rootFiles.map(f => (
                      <ExplorerFile key={f.id} file={f} activeId={activeId}
                        renamingId={renamingId} renameVal={renameVal}
                        setActiveId={setActiveId} deleteFile={deleteFile}
                        startRename={startRename} commitRename={commitRename}
                        setRenameVal={setRenameVal} setRenamingId={setRenamingId}
                        indent={8} />
                    ))}
                  </>
                )}
              </div>

              {/* Templates */}
              <div className="border-t border-border/40 px-3 py-2 shrink-0">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1.5">Templates</p>
                {TEMPLATES.map(tpl => (
                  <button key={tpl.label} onClick={() => loadTemplate(tpl.files)}
                    className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/20 transition-colors">
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── EDITOR + PANELS ───────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* File Tabs or empty state */}
            {files.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#0d0d0d] select-none">
                <div className="text-center space-y-5 max-w-xs">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full opacity-20"
                        style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)', filter: 'blur(16px)' }} />
                      <FolderOpen className="relative h-16 w-16 text-muted-foreground/20" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground/60">No files open</p>
                    <p className="text-sm text-muted-foreground/40 mt-1">Create a new file or import from disk or NexaCloud</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" className="gap-2" onClick={() => setShowNewFile(true)}>
                      <Plus className="h-4 w-4" /> New File
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-2 border border-border/40 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowImport(true)}>
                      <Upload className="h-4 w-4" /> Import Files
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="shrink-0 flex items-center overflow-x-auto border-b border-border/40 bg-[#111]">
                  {files.map(f => (
                    <div key={f.id}
                      className={cn(
                        'group flex items-center gap-1.5 px-3 py-2 border-r border-border/30 shrink-0 cursor-pointer select-none transition-colors',
                        f.id === activeId
                          ? 'bg-[#0d0d0d] text-foreground border-t-2 border-t-primary'
                          : 'bg-[#111] text-muted-foreground hover:bg-[#161616] border-t-2 border-t-transparent',
                      )}
                      onClick={() => setActiveId(f.id)}
                    >
                      <FileCode className={cn('h-3.5 w-3.5 shrink-0', langColor(f.name))} />
                      <span className="text-xs truncate max-w-[100px]">{f.name}</span>
                      {f.dirty && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary/70 group-hover:hidden" />}
                      <button
                        className={cn('shrink-0', f.dirty ? 'hidden group-hover:block text-muted-foreground hover:text-foreground' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground')}
                        onClick={e => { e.stopPropagation(); deleteFile(f.id); }}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button className="px-3 py-2 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setShowNewFile(true)} title="New file">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Editor + side panels */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  {/* Monaco */}
                  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <div className="flex-1 min-h-0">
                      {activeFile && (
                        <Editor
                          key={activeId}
                          value={activeFile.content}
                          language={getMonacoLang(activeFile.name)}
                          theme="nexacloud-dark"
                          onMount={handleEditorMount}
                          onChange={updateContent}
                          options={{
                            fontSize: 13,
                            fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",Consolas,monospace',
                            fontLigatures: true,
                            minimap: { enabled: true, scale: 1 },
                            scrollBeyondLastLine: false,
                            wordWrap: 'off',
                            tabSize: 2,
                            insertSpaces: true,
                            autoIndent: 'full',
                            formatOnPaste: true,
                            formatOnType: true,
                            quickSuggestions: true,
                            parameterHints: { enabled: true },
                            bracketPairColorization: { enabled: true },
                            guides: { bracketPairs: true, indentation: true },
                            renderWhitespace: 'selection',
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            padding: { top: 12, bottom: 12 },
                            lineNumbers: 'on',
                            renderLineHighlight: 'line',
                            scrollbar: { vertical: 'auto', horizontal: 'auto', verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                            overviewRulerBorder: false,
                            folding: true,
                            showFoldingControls: 'mouseover',
                            multiCursorModifier: 'alt',
                            hover: { enabled: true },
                            links: true,
                            colorDecorators: true,
                            occurrencesHighlight: 'singleFile',
                            selectionHighlight: true,
                            codeLens: false,
                            glyphMargin: false,
                            lineDecorationsWidth: 8,
                          }}
                          className="h-full"
                        />
                      )}
                    </div>
                    {/* Status bar */}
                    <div className="shrink-0 flex items-center justify-between gap-4 border-t border-border/40 bg-[#111] px-4 py-1 text-[11px] text-muted-foreground/60 select-none">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn('font-medium shrink-0', activeFile ? langColor(activeFile.name) : '')}>
                          {activeInfo?.label ?? 'Text'}
                        </span>
                        {activeInfo?.runnable && (
                          <span className="flex items-center gap-1 shrink-0">
                            {activeInfo.engine === 'wandbox'
                              ? <><Globe className="h-2.5 w-2.5" /> Online (Wandbox)</>
                              : <><Cpu className="h-2.5 w-2.5" /> Offline</>}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span>UTF-8</span>
                        <span>Spaces: 2</span>
                        {activeFile?.content && <span>{activeFile.content.split('\n').length} lines</span>}
                      </div>
                    </div>
                  </div>

                  {/* Preview panel */}
                  {previewOpen && (
                    <div className={cn('shrink-0 border-l border-border/40 flex flex-col bg-white overflow-hidden', previewFullscreen ? 'fixed inset-0 z-40' : '')}
                      style={previewFullscreen ? {} : { width: '45%', minWidth: 300 }}>
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111] border-b border-border/40 shrink-0">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Monitor className="h-3 w-3 text-orange-400" /> Run in Web
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground px-2" onClick={refreshPreview}>
                            <RefreshCw className="h-3 w-3" /> Refresh
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => setPreviewFullscreen(f => !f)}>
                            {previewFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => { setPreviewOpen(false); setPreviewFullscreen(false); }}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <iframe key={previewSrcdoc} srcDoc={previewSrcdoc}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                        className="flex-1 w-full border-0" title="Run in Web" />
                    </div>
                  )}

                  {/* Terminal panel */}
                  {termOpen && !previewOpen && (
                    <div className="shrink-0 w-80 border-l border-border/40 flex flex-col bg-[#0a0a0a]" style={{ minWidth: 260, maxWidth: 420 }}>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-foreground">Terminal</span>
                          {activeInfo?.runnable && <span className="text-xs text-muted-foreground/50">· {activeInfo.label}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {runRecords.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => setRunRecords([])} title="Clear">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => setTermOpen(false)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs space-y-2">
                        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setStdinOpen(o => !o)}>
                          <ChevronDown className={cn('h-3 w-3 transition-transform', stdinOpen ? 'rotate-180' : '')} />
                          stdin {stdin.trim() && <span className="ml-1 rounded px-1 bg-primary/20 text-primary text-[10px]">set</span>}
                        </button>
                        {stdinOpen && (
                          <textarea value={stdin} onChange={e => setStdin(e.target.value)}
                            placeholder="Input values (one per line)…"
                            className="w-full resize-none h-14 bg-muted/10 border border-border/40 rounded text-foreground font-mono text-xs px-2 py-1.5 outline-none focus:border-primary placeholder:text-muted-foreground/30" />
                        )}
                        <Button className="w-full gap-2 h-8 text-xs" onClick={handleRun} disabled={running || !canRunCode}>
                          {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Running…</> : <><Play className="h-3.5 w-3.5" />Run {activeInfo?.label}</>}
                        </Button>
                        {!canRunCode && activeInfo && (
                          <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <AlertCircle className="h-6 w-6 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground/50">{activeInfo.label} cannot be executed.</p>
                            {hasHtml && (
                              <Button variant="ghost" size="sm" className="text-xs h-7 border border-border/60 text-orange-400 hover:bg-muted/30" onClick={handlePreview}>
                                <Monitor className="h-3.5 w-3.5 mr-1" /> Run in Web
                              </Button>
                            )}
                          </div>
                        )}
                        {running && <div className="flex items-center gap-2 text-muted-foreground py-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing…</div>}
                        {runRecords.map(r => <RunRecordView key={r.id} record={r} />)}
                        {runRecords.length === 0 && !running && canRunCode && (
                          <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <Terminal className="h-8 w-8 text-muted-foreground/15" />
                            <p className="text-xs text-muted-foreground/40">Output appears here.</p>
                            <p className="text-[11px] text-muted-foreground/25">Ctrl+Enter to run</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showNewFile && (
        <NewFileModal
          onAdd={(name, folderId) => addFile(name, folderId)}
          onClose={() => setShowNewFile(false)}
          folders={folders}
        />
      )}

      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowNewFolder(false)}>
          <div className="bg-[#1e1e1e] border border-border rounded-xl shadow-2xl p-5 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-yellow-400" /> New Folder
            </h3>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              placeholder="folder-name"
              onKeyDown={e => { if (e.key === 'Enter' && newFolderName.trim()) { addFolder(newFolderName.trim()); setNewFolderName(''); setShowNewFolder(false); } if (e.key === 'Escape') setShowNewFolder(false); }}
              className="w-full rounded-lg bg-muted/20 border border-border text-foreground text-sm px-3 py-2 outline-none focus:border-primary" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewFolder(false)} className="border border-border text-foreground hover:bg-muted/30 h-8">Cancel</Button>
              <Button size="sm" onClick={() => { if (newFolderName.trim()) { addFolder(newFolderName.trim()); setNewFolderName(''); setShowNewFolder(false); } }} disabled={!newFolderName.trim()} className="h-8 gap-1.5">
                <FolderPlus className="h-3.5 w-3.5" /> Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {showImport && user && (
        <ImportModal
          userId={user.id}
          onImportCloud={handleImportCloud}
          onClose={() => setShowImport(false)}
          fileInputRef={fileInputRef}
          onImportLocal={() => fileInputRef.current?.click()}
        />
      )}

      <input ref={fileInputRef} type="file" multiple accept="*/*" className="sr-only" onChange={handleImportFiles} />

      {saveModal && user && (
        <SaveToCloudModal
          file={saveModal}
          userId={user.id}
          onSaved={saved => setFiles(prev => prev.map(f => f.id === saved.id ? saved : f))}
          onClose={() => setSaveModal(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ── Explorer File Row ─────────────────────────────────────────────────────
function ExplorerFile({
  file, activeId, renamingId, renameVal, setActiveId, deleteFile,
  startRename, commitRename, setRenameVal, setRenamingId, indent,
}: {
  file: EditorFile; activeId: string; renamingId: string | null; renameVal: string;
  setActiveId: (id: string) => void; deleteFile: (id: string) => void;
  startRename: (f: EditorFile) => void; commitRename: (id: string) => void;
  setRenameVal: (v: string) => void; setRenamingId: (id: string | null) => void;
  indent: number;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 py-1.5 cursor-pointer transition-colors text-xs select-none',
        file.id === activeId
          ? 'bg-primary/10 text-foreground border-l-2 border-primary'
          : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground border-l-2 border-transparent',
      )}
      style={{ paddingLeft: indent }}
      onClick={() => setActiveId(file.id)}
    >
      <FileCode className={cn('h-3.5 w-3.5 shrink-0', langColor(file.name))} />
      {renamingId === file.id ? (
        <input autoFocus value={renameVal}
          onChange={e => setRenameVal(e.target.value)}
          onBlur={() => commitRename(file.id)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename(file.id);
            if (e.key === 'Escape') setRenamingId(null);
          }}
          className="flex-1 bg-transparent border-b border-primary text-xs text-foreground outline-none min-w-0"
          onClick={e => e.stopPropagation()} />
      ) : (
        <span className="flex-1 truncate" onDoubleClick={() => startRename(file)}>{file.name}</span>
      )}
      {file.dirty && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary/60" />}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 mr-1"
        onClick={e => e.stopPropagation()}>
        <button onClick={() => startRename(file)} title="Rename" className="text-muted-foreground hover:text-primary p-0.5">
          <Pencil className="h-2.5 w-2.5" />
        </button>
        <button onClick={() => deleteFile(file.id)} title="Delete" className="text-muted-foreground hover:text-destructive p-0.5">
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────
function ImportModal({ userId, onImportCloud, onClose, fileInputRef, onImportLocal }: {
  userId: string;
  onImportCloud: (f: CloudFile) => void;
  onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportLocal: () => void;
}) {
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    listFiles(userId, undefined, undefined, undefined).then(files => {
      setCloudFiles(files.filter(f => f.file_type === 'code' || f.file_type === 'documents' || ['js','ts','jsx','tsx','py','html','css','json','txt','md','c','cpp','go','rs'].includes(f.original_name?.split('.').pop()?.toLowerCase() ?? '')));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const filtered = search
    ? cloudFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : cloudFiles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-border rounded-xl shadow-2xl p-5 w-96 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 shrink-0">
          <Upload className="h-4 w-4 text-primary" /> Import Files
        </h3>

        <button
          onClick={() => { onImportLocal(); }}
          className="shrink-0 w-full flex items-center gap-3 rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors">
          <Download className="h-4 w-4 shrink-0" />
          Import from disk (local files)
        </button>

        <div className="shrink-0">
          <p className="text-xs text-muted-foreground mb-2">Or import from NexaCloud cloud:</p>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-lg bg-muted/20 border border-border text-foreground text-xs px-3 py-1.5 outline-none focus:border-primary" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading cloud files…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 py-4 text-center">No code files found in your cloud storage.</p>
          ) : filtered.map(f => (
            <button key={f.id} onClick={() => onImportCloud(f)}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/20 hover:text-foreground transition-colors">
              <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 truncate">{f.original_name || f.name}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="border border-border text-foreground hover:bg-muted/30 h-8">Close</Button>
        </div>
      </div>
    </div>
  );
}
