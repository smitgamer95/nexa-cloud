// ── Code execution service ─────────────────────────────────────────────────
// OFFLINE engines (no API, no network):
//   • JavaScript / JSX   → built-in sandboxed iframe
//   • Python (.py)       → Skulpt (Python 3 runtime compiled to JS, CDN-cached)
//   • C / C++ (.c .cpp)  → JSCPP  (C++ interpreter written in JS, npm package)
//
// Online fallback (requires internet, uses free Wandbox API):
//   • TypeScript, Ruby, PHP, Java, Go, Rust, Kotlin, Bash, Swift, Lua, R
// ──────────────────────────────────────────────────────────────────────────

const WANDBOX_URL = 'https://wandbox.org/api/compile.json';

export interface RunResult {
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number;
  language: string;
  version: string;
  engine: 'iframe' | 'skulpt' | 'jscpp' | 'wandbox';
}

export interface LangInfo {
  engine: 'iframe' | 'skulpt' | 'jscpp' | 'wandbox' | 'none';
  wandboxCompiler: string;
  version: string;
  label: string;
  runnable: boolean;
}

const LANG_MAP: Record<string, LangInfo> = {
  js:    { engine: 'iframe',   wandboxCompiler: '', version: 'Browser',  label: 'JavaScript',  runnable: true },
  mjs:   { engine: 'iframe',   wandboxCompiler: '', version: 'Browser',  label: 'JavaScript',  runnable: true },
  cjs:   { engine: 'iframe',   wandboxCompiler: '', version: 'Browser',  label: 'JavaScript',  runnable: true },
  jsx:   { engine: 'iframe',   wandboxCompiler: '', version: 'Browser',  label: 'JavaScript',  runnable: true },
  py:    { engine: 'skulpt',   wandboxCompiler: '', version: 'Skulpt 1', label: 'Python 3',    runnable: true },
  c:     { engine: 'wandbox',  wandboxCompiler: 'gcc-head',         version: 'GCC',    label: 'C',           runnable: true },
  cpp:   { engine: 'wandbox',  wandboxCompiler: 'gcc-head',         version: 'GCC',    label: 'C++',         runnable: true },
  h:     { engine: 'none',     wandboxCompiler: '', version: '',         label: 'C Header',    runnable: false },
  hpp:   { engine: 'none',     wandboxCompiler: '', version: '',         label: 'C++ Header',  runnable: false },
  ts:    { engine: 'wandbox',  wandboxCompiler: 'typescript-5.3.3',  version: '5.3',    label: 'TypeScript', runnable: true },
  tsx:   { engine: 'wandbox',  wandboxCompiler: 'typescript-5.3.3',  version: '5.3',    label: 'TypeScript', runnable: true },
  rb:    { engine: 'wandbox',  wandboxCompiler: 'ruby-3.2.2',        version: '3.2',    label: 'Ruby',       runnable: true },
  php:   { engine: 'wandbox',  wandboxCompiler: 'php-8.3.0',         version: '8.3',    label: 'PHP',        runnable: true },
  cs:    { engine: 'wandbox',  wandboxCompiler: 'mono-6.12.0.90',    version: '6.12',   label: 'C# (Mono)',  runnable: true },
  java:  { engine: 'wandbox',  wandboxCompiler: 'openjdk-jdk-21+35', version: 'JDK 21', label: 'Java',       runnable: true },
  go:    { engine: 'wandbox',  wandboxCompiler: 'go-1.20.1',         version: '1.20',   label: 'Go',         runnable: true },
  rs:    { engine: 'wandbox',  wandboxCompiler: 'rust-1.75.0',       version: '1.75',   label: 'Rust',       runnable: true },
  kt:    { engine: 'wandbox',  wandboxCompiler: 'kotlin-1.9.22',     version: '1.9',    label: 'Kotlin',     runnable: true },
  sh:    { engine: 'wandbox',  wandboxCompiler: 'bash',              version: 'bash',   label: 'Bash',       runnable: true },
  bash:  { engine: 'wandbox',  wandboxCompiler: 'bash',              version: 'bash',   label: 'Bash',       runnable: true },
  lua:   { engine: 'wandbox',  wandboxCompiler: 'lua-5.4.6',         version: '5.4',    label: 'Lua',        runnable: true },
  r:     { engine: 'wandbox',  wandboxCompiler: 'r-4.2.2',           version: '4.2',    label: 'R',          runnable: true },
  swift: { engine: 'wandbox',  wandboxCompiler: 'swift-5.9.2',       version: '5.9',    label: 'Swift',      runnable: true },
  html: { engine: 'none', wandboxCompiler: '', version: '', label: 'HTML',     runnable: false },
  css:  { engine: 'none', wandboxCompiler: '', version: '', label: 'CSS',      runnable: false },
  json: { engine: 'none', wandboxCompiler: '', version: '', label: 'JSON',     runnable: false },
  md:   { engine: 'none', wandboxCompiler: '', version: '', label: 'Markdown', runnable: false },
  sql:  { engine: 'none', wandboxCompiler: '', version: '', label: 'SQL',      runnable: false },
  txt:  { engine: 'none', wandboxCompiler: '', version: '', label: 'Text',     runnable: false },
};

export function getLangInfo(fileName: string): LangInfo {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] ?? { engine: 'none', wandboxCompiler: '', version: '', label: ext.toUpperCase(), runnable: false };
}

export function isRunnable(fileName: string): boolean {
  return getLangInfo(fileName).runnable;
}

export function isCodeFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const ALWAYS_CODE = new Set(['html','htm','css','js','mjs','cjs','ts','tsx','jsx',
    'py','rb','php','go','rs','java','kt','c','cpp','h','hpp','cs',
    'sh','bash','zsh','fish','sql','graphql','gql','json','jsonc','xml',
    'yaml','yml','toml','ini','env','md','mdx','vue','svelte','lua','r','swift']);
  return ALWAYS_CODE.has(ext);
}

// ── ENGINE 1: JS iframe ───────────────────────────────────────────────────
function runJavaScriptBuiltin(code: string, stdin: string): Promise<RunResult> {
  return new Promise(resolve => {
    const logs: string[] = [];
    const errs: string[] = [];
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;';
    iframe.setAttribute('sandbox', 'allow-scripts');
    document.body.appendChild(iframe);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(timer); window.removeEventListener('message', onMsg);
      try { document.body.removeChild(iframe); } catch { /* ok */ }
      const out = logs.join('\n'); const err = errs.join('\n');
      resolve({ stdout: out, stderr: err, output: out || err, exitCode: errs.length > 0 ? 1 : 0, language: 'JavaScript', version: 'Browser built-in', engine: 'iframe' });
    };
    const timer = setTimeout(() => { errs.push('Execution timed out (5 s).'); finish(); }, 5000);
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== iframe.contentWindow) return;
      const d = ev.data;
      if (d?.type === 'log') logs.push(d.text);
      else if (d?.type === 'err') errs.push(d.text);
      else if (d?.type === 'done') finish();
    };
    window.addEventListener('message', onMsg);
    const stdinLines = JSON.stringify(stdin.split('\n'));
    const srcdoc = `<!doctype html><html><body><script>
(function(){
  var lines=${stdinLines},li=0;
  var fmt=function(a){return Array.prototype.slice.call(a).map(function(x){return typeof x==='object'?JSON.stringify(x):String(x);}).join(' ');};
  var post=function(t,s){parent.postMessage({type:t,text:s},'*');};
  console.log=console.info=console.warn=function(){post('log',fmt(arguments));};
  console.error=function(){post('err',fmt(arguments));};
  window.readline=window.prompt=function(){return lines[li++]||'';};
  window.onerror=function(m,s,l){post('err',m+(l?' (line '+l+')':''));post('done','');return true;};
  try{(new Function(${JSON.stringify(code)}))();post('done','');}
  catch(e){post('err',e.message||String(e));post('done','');}
})();
\x3c/script></body></html>`;
    iframe.srcdoc = srcdoc;
  });
}

// ── ENGINE 2: Python via Skulpt (offline after first CDN load) ────────────
let skulptLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load Skulpt from CDN. Check your internet connection.`));
    document.head.appendChild(s);
  });
}

async function ensureSkulpt(): Promise<void> {
  if (skulptLoaded || typeof (window as Window & { Sk?: unknown }).Sk !== 'undefined') { skulptLoaded = true; return; }
  await loadScript('https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js');
  skulptLoaded = true;
}

interface SkulptStatic {
  configure: (opts: { output?: (t: string) => void; read?: (n: string) => string; inputfun?: () => string; execLimit?: number }) => void;
  misceval: { asyncToPromise: (f: () => unknown) => Promise<unknown> };
  importMainWithBody: (name: string, dump: boolean, body: string, canSuspend: boolean) => unknown;
  builtinFiles?: { files: Record<string, string> };
}
declare global { interface Window { Sk?: SkulptStatic } }

async function runPythonSkulpt(code: string, stdin: string): Promise<RunResult> {
  await ensureSkulpt();
  return new Promise(resolve => {
    const Sk = window.Sk!;
    const outLines: string[] = [];
    const stdinQ = stdin.split('\n');
    let si = 0;
    Sk.configure({
      output: (t: string) => outLines.push(t),
      read: (name: string) => {
        if (Sk.builtinFiles?.files[name] !== undefined) return Sk.builtinFiles.files[name];
        throw new Error(`File not found: '${name}'`);
      },
      inputfun: () => stdinQ[si++] ?? '',
      execLimit: 5000,
    });
    Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true)).then(
      () => { const o = outLines.join(''); resolve({ stdout: o, stderr: '', output: o, exitCode: 0, language: 'Python 3', version: 'Skulpt 1.2 (offline)', engine: 'skulpt' }); },
      (err: unknown) => {
        const m = err instanceof Error ? err.message : String(err);
        resolve({ stdout: '', stderr: m, output: m, exitCode: 1, language: 'Python 3', version: 'Skulpt 1.2 (offline)', engine: 'skulpt' });
      }
    );
  });
}

// ── ENGINE 3: C/C++ via JSCPP (offline npm package with safe dynamic import) ─
interface JSCPPStdio { write: (s: string) => void }
interface JSCPPModule { run: (code: string, input: string, config: { stdio: JSCPPStdio }) => number }

async function loadJSCPP(): Promise<JSCPPModule | null> {
  try {
    // Dynamic import — bundled by Vite from the local JSCPP npm package
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import('JSCPP') as { default?: JSCPPModule } & JSCPPModule;
    return (mod.default ?? mod) as JSCPPModule;
  } catch {
    return null;
  }
}

async function runCJSCPP(code: string, stdin: string): Promise<RunResult> {
  const JSCPP = await loadJSCPP();
  if (!JSCPP) {
    // Fallback: JSCPP unavailable — try Wandbox
    const fallbackInfo: LangInfo = { engine: 'wandbox', wandboxCompiler: 'gcc-head', version: 'GCC', label: 'C/C++', runnable: true };
    return runWithWandbox(code, stdin, fallbackInfo);
  }
  const outLines: string[] = [];
  try {
    const exitCode: number = JSCPP.run(code, stdin, {
      stdio: { write: (s: string) => { outLines.push(s); } },
    });
    const out = outLines.join('');
    return { stdout: out, stderr: '', output: out, exitCode: exitCode ?? 0, language: 'C/C++', version: 'JSCPP (offline)', engine: 'jscpp' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { stdout: '', stderr: msg, output: msg, exitCode: 1, language: 'C/C++', version: 'JSCPP (offline)', engine: 'jscpp' };
  }
}

// ── ENGINE 4: Wandbox (online fallback) ───────────────────────────────────
async function runWithWandbox(code: string, stdin: string, info: LangInfo): Promise<RunResult> {
  const res = await fetch(WANDBOX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ compiler: info.wandboxCompiler, code, stdin: stdin || '' }),
  });
  if (!res.ok) throw new Error(`Compiler service returned ${res.status}. Try again in a moment.`);
  const data = await res.json();
  const stdout = (data.program_output ?? '').trimEnd();
  const compErr = (data.compiler_error ?? '').trimEnd();
  const progErr = (data.program_error ?? '').trimEnd();
  const stderr = [compErr, progErr].filter(Boolean).join('\n');
  const exitCode = data.status !== undefined ? Number(data.status) : (stderr ? 1 : 0);
  return { stdout, stderr, output: stdout || stderr, exitCode, language: info.label, version: info.version, engine: 'wandbox' };
}

// ── Public API ────────────────────────────────────────────────────────────
export async function runCode(fileName: string, sourceCode: string, stdin = ''): Promise<RunResult> {
  const info = getLangInfo(fileName);
  if (!info.runnable) throw new Error(`${info.label} files cannot be executed.`);
  switch (info.engine) {
    case 'iframe':  return runJavaScriptBuiltin(sourceCode, stdin);
    case 'skulpt':  return runPythonSkulpt(sourceCode, stdin);
    case 'jscpp':   return runCJSCPP(sourceCode, stdin);
    case 'wandbox': return runWithWandbox(sourceCode, stdin, info);
    default:        throw new Error(`No engine available for ${info.label}.`);
  }
}
