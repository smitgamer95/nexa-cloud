import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="glass rounded-2xl border border-border/50 px-8 py-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <img
              src="https://i.postimg.cc/HnxcmmVK/Chat-GPT-Image-May-22-2026-01-39-42-PM.png"
              alt="NexaCloud"
              className="h-14 w-auto"
              draggable={false}
            />
            {title && (
              <div className="text-center">
                <h1 className="text-xl font-semibold text-foreground text-balance">{title}</h1>
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>
                )}
              </div>
            )}
          </div>
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} NexaCloud · Your Files. Your Privacy.
        </p>
      </div>
    </div>
  );
}
