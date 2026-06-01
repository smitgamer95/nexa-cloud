import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Code2, Archive, Zap, Lock,
  Upload, FolderOpen, Play, ArrowRight, CheckCircle2,
  Globe, Cpu, HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const LOGO_URL = 'https://i.postimg.cc/HnxcmmVK/Chat-GPT-Image-May-22-2026-01-39-42-PM.png';

const FEATURES = [
  { icon: Shield,    label: 'End-to-End Encrypted',  desc: 'Your files are encrypted at rest and in transit. No one but you has access.' },
  { icon: Code2,     label: 'Built-in Compiler',      desc: 'Monaco-powered VS Code editor. Run Python, C/C++, JS, Go, Rust and more.' },
  { icon: Play,      label: 'Run in Web',              desc: 'Preview your HTML + CSS + JS projects live, right inside the app — no new tab.' },
  { icon: Archive,   label: 'ZIP Tools',               desc: 'Download whole folders as ZIP archives. Preview ZIP contents without extracting.' },
  { icon: FolderOpen,label: 'Smart File Manager',      desc: 'Nested folders, drag-drop upload, bulk select, move, copy, and trash management.' },
  { icon: Globe,     label: 'Share Links',             desc: 'Generate shareable links with custom expiry. Anyone with the link can view or download.' },
  { icon: Upload,    label: 'Easy Uploads',            desc: 'Drag and drop files or use the upload button. Auto-categorised by type.' },
  { icon: Cpu,       label: 'No Install Needed',       desc: 'Everything runs in your browser. No plugins, no desktop app, no setup.' },
];

const STEPS = [
  { step: '01', title: 'Create an account', desc: 'Sign up free in under 30 seconds.' },
  { step: '02', title: 'Upload your files',  desc: 'Drag & drop or browse to upload any file type.' },
  { step: '03', title: 'Access anywhere',    desc: 'Your files are synced and available on every device.' },
];

// ── Intersection observer hook for scroll animations
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHeroVisible(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="NexaCloud" className="h-7 w-7 rounded-lg object-cover shrink-0" draggable={false} />
            <span className="text-base font-bold tracking-tight text-foreground">NexaCloud</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Get started free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28 overflow-hidden">
        {/* Animated bg glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
          <div className="h-96 w-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'float 6s ease-in-out infinite' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6"
          style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(32px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            style={{ animation: 'scale-in 0.5s ease 0.2s both' }}>
            <Zap className="h-3 w-3" /> Free private cloud storage
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl text-balance">
            Your Files.{' '}
            <span className="text-primary" style={{ animation: 'fade-in-up 0.6s ease 0.3s both', display: 'inline-block' }}>
              Your Privacy.
            </span>
          </h1>

          <p className="max-w-2xl text-base text-muted-foreground md:text-lg text-pretty"
            style={{ animation: 'fade-in-up 0.6s ease 0.45s both' }}>
            NexaCloud is a secure private cloud storage platform with a built-in code editor,
            browser compiler, HTML live preview, and ZIP tools — all in one place.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row"
            style={{ animation: 'fade-in-up 0.6s ease 0.6s both' }}>
            <Button size="lg" className="gap-2 px-8" asChild>
              <Link to="/register">Start for free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="ghost" className="border border-border gap-2 px-8" asChild>
              <Link to="/login"><Lock className="h-4 w-4" /> Sign in</Link>
            </Button>
          </div>

          {/* Stats bar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border/50 bg-card px-5 py-3 text-sm text-muted-foreground"
            style={{ animation: 'fade-in-up 0.6s ease 0.75s both' }}>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">5 GB free storage</span>
            </div>
            <span className="text-border hidden sm:block">·</span>
            <span className="text-xs">256-bit encryption</span>
            <span className="text-border hidden sm:block">·</span>
            <span className="text-xs">No ads · No tracking</span>
          </div>
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6">
        <RevealSection className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl text-balance">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-2 text-muted-foreground text-pretty">Built for developers, creators, and privacy-first people.</p>
        </RevealSection>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <RevealSection key={f.label} delay={i * 60}>
              <div className="h-full rounded-2xl border border-border/60 bg-card p-5 space-y-3 hover:border-primary/40 hover:bg-card/80 transition-all duration-300 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-foreground text-sm text-balance">{f.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed text-pretty">{f.desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 bg-muted/20 py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <RevealSection className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl text-balance">Get started in minutes</h2>
            <p className="mt-2 text-muted-foreground text-pretty">No installs, no plugins — just open NexaCloud and start working.</p>
          </RevealSection>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <RevealSection key={s.step} delay={i * 100}>
                <div className="flex flex-col items-center gap-3 text-center p-6 rounded-2xl border border-border/50 bg-card h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-lg font-bold shrink-0">
                    {s.step}
                  </div>
                  <p className="font-semibold text-foreground text-balance">{s.title}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{s.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust badges ──────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <RevealSection>
          <div className="mx-auto max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield,   label: 'E2E Encrypted' },
              { icon: Globe,    label: 'Access Anywhere' },
              { icon: Lock,     label: 'No Tracking' },
              { icon: CheckCircle2, label: 'Always Free' },
            ].map(b => (
              <div key={b.label} className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card p-4 text-center">
                <b.icon className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium text-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 bg-primary/5 py-16">
        <RevealSection>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 text-center">
            <img src={LOGO_URL} alt="NexaCloud" className="h-14 w-14 rounded-2xl object-cover"
              style={{ animation: 'float 4s ease-in-out infinite' }} draggable={false} />
            <h2 className="text-2xl font-bold text-foreground md:text-3xl text-balance">
              Ready to take control of your files?
            </h2>
            <p className="text-muted-foreground text-pretty text-lg font-medium">
              Your Files. Your Privacy.
            </p>
            <p className="text-muted-foreground text-pretty">
              Join NexaCloud today — completely free, forever.
            </p>
            <Button size="lg" className="gap-2 px-10" asChild>
              <Link to="/register">Get started free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </RevealSection>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-6 px-4">
        <p className="text-center text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} NexaCloud · Your Files. Your Privacy.
        </p>
      </footer>
    </div>
  );
}
