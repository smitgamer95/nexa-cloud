import React, { useState, useRef } from 'react';
import {
  Play, Loader2, Terminal, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertCircle, X, Trash2, Cpu, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { runCode, getLangInfo, type RunResult } from '@/services/codeRunner';

interface CodeRunnerProps {
  fileName: string;
  getCode: () => string;
  onClose: () => void;
}

type RunStatus = 'idle' | 'running' | 'success' | 'error';

interface RunRecord {
  id: number;
  status: RunStatus;
  stdout: string;
  stderr: string;
  exitCode: number;
  language: string;
  version: string;
  engine: 'iframe' | 'skulpt' | 'jscpp' | 'wandbox' | 'none';
  durationMs: number;
}

export function CodeRunner({ fileName, getCode, onClose }: CodeRunnerProps) {
  const [stdin, setStdin] = useState('');
  const [stdinOpen, setStdinOpen] = useState(false);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [records, setRecords] = useState<RunRecord[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const info = getLangInfo(fileName);

  const handleRun = async () => {
    if (status === 'running') return;
    const code = getCode();
    if (!code.trim()) return;

    setStatus('running');
    const start = Date.now();

    try {
      const result = await runCode(fileName, code, stdin);
      const ms = Date.now() - start;
      const newStatus: RunStatus = result.exitCode !== 0 ? 'error' : 'success';

      setStatus(newStatus);
      setRecords(prev => [{
        id: Date.now(),
        status: newStatus,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        language: result.language,
        version: result.version,
        engine: result.engine,
        durationMs: ms,
      }, ...prev.slice(0, 9)]);

      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setRecords(prev => [{
        id: Date.now(),
        status: 'error',
        stdout: '',
        stderr: msg,
        exitCode: 1,
        language: info.label,
        version: info.version,
        engine: 'wandbox',
        durationMs: Date.now() - start,
      }, ...prev.slice(0, 9)]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-border/40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Terminal</span>
          {info.runnable && (
            <span className="text-xs text-muted-foreground/60">· {info.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {records.length > 0 && (
            <Button variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => { setRecords([]); setStatus('idle'); }}
              title="Clear output">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Not runnable */}
      {!info.runnable && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{info.label} files cannot be executed.</p>
          <p className="text-xs text-muted-foreground/60">Supported: C, C++, Python, Go, Rust, Java, JS, and more.</p>
        </div>
      )}

      {info.runnable && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Controls */}
          <div className="shrink-0 px-3 py-2 border-b border-border/40 space-y-2">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setStdinOpen(o => !o)}>
              {stdinOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Standard input (stdin)
              {stdin.trim() && <span className="ml-1 rounded px-1 bg-primary/20 text-primary text-[10px]">set</span>}
            </button>
            {stdinOpen && (
              <Textarea
                value={stdin}
                onChange={e => setStdin(e.target.value)}
                placeholder="Enter input values here (one per line)…"
                className="resize-none h-16 bg-muted/30 border-border/40 text-foreground font-mono text-xs placeholder:text-muted-foreground/40"
              />
            )}
            {/* Engine badge */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 pb-0.5">
              <span className="flex items-center gap-1">
                {info.engine === 'iframe'
                  ? <><Cpu className="h-2.5 w-2.5" /> JS sandbox (offline)</>
                  : info.engine === 'skulpt'
                  ? <><Cpu className="h-2.5 w-2.5" /> Python/Skulpt (offline)</>
                  : info.engine === 'jscpp'
                  ? <><Cpu className="h-2.5 w-2.5" /> C/JSCPP (offline)</>
                  : <><Globe className="h-2.5 w-2.5" /> Wandbox (online)</>
                }
              </span>
            </div>
            <Button
              className="w-full gap-2 h-8 text-xs font-medium"
              onClick={handleRun}
              disabled={status === 'running'}>
              {status === 'running'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</>
                : <><Play className="h-3.5 w-3.5" /> Run Code</>}
            </Button>
          </div>

          {/* Output */}
          <div ref={outputRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 font-mono text-xs">
            {records.length === 0 && status !== 'running' && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                <Terminal className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-muted-foreground/50">Output will appear here after running.</p>
              </div>
            )}
            {status === 'running' && (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing {info.label}…</span>
              </div>
            )}
            {records.map((rec, idx) => (
              <RunRecord key={rec.id} record={rec} isLatest={idx === 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RunRecord({ record, isLatest }: { record: RunRecord; isLatest: boolean }) {
  const ok = record.status === 'success';
  const hasOutput = record.stdout.length > 0;
  const hasErr = record.stderr.length > 0;

  return (
    <div className={cn(
      'rounded border text-xs',
      isLatest ? 'border-border/50' : 'border-border/20 opacity-50',
    )}>
      <div className={cn(
        'flex items-center justify-between px-2 py-1 rounded-t',
        ok ? 'bg-green-950/40' : 'bg-red-950/40',
      )}>
        <div className="flex items-center gap-1.5">
          {ok
            ? <CheckCircle2 className="h-3 w-3 text-green-400" />
            : <XCircle className="h-3 w-3 text-red-400" />}
          <span className={ok ? 'text-green-300' : 'text-red-300'}>
            {ok ? 'Exit 0' : `Exit ${record.exitCode}`}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground/60">{record.durationMs}ms</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground/50 flex items-center gap-0.5">
            {record.engine === 'iframe'
              ? <><Cpu className="h-2.5 w-2.5" /> js-sandbox</>
              : record.engine === 'skulpt'
              ? <><Cpu className="h-2.5 w-2.5" /> skulpt</>
              : record.engine === 'jscpp'
              ? <><Cpu className="h-2.5 w-2.5" /> jscpp</>
              : <><Globe className="h-2.5 w-2.5" /> wandbox</>}
          </span>
        </div>
        <span className="text-muted-foreground/40">{record.language}</span>
      </div>

      {hasOutput && (
        <pre className={cn(
          'px-2 py-2 whitespace-pre-wrap break-words text-green-200/90 leading-5 max-h-64 overflow-y-auto',
          hasErr && 'border-b border-border/20',
        )}>
          {record.stdout}
        </pre>
      )}

      {hasErr && (
        <pre className="px-2 py-2 whitespace-pre-wrap break-words text-red-300/90 leading-5 max-h-64 overflow-y-auto">
          {record.stderr}
        </pre>
      )}

      {!hasOutput && !hasErr && (
        <p className="px-2 py-2 text-muted-foreground/40 italic">No output.</p>
      )}
    </div>
  );
}
