import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Cloud, AlertTriangle } from 'lucide-react';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/login/otp',
  '/login/password',
  '/register/otp',
  '/register/password',
  '/forgot-password/otp',
  '/forgot-password/new',
  '/share',
];

const LOGO_URL = 'https://i.postimg.cc/HnxcmmVK/Chat-GPT-Image-May-22-2026-01-39-42-PM.png';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const missingEnv =
    !import.meta.env.VITE_SUPABASE_URL ||
    !import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Use exact match for '/' to avoid matching every route (all paths start with '/')
  const isPublic = PUBLIC_ROUTES.some(r =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0a0a0a]">
        <img src={LOGO_URL} alt="NexaCloud"
          className="h-14 w-14 rounded-2xl object-cover shadow-lg"
          draggable={false} />
        <p className="text-sm font-semibold text-white tracking-tight">NexaCloud</p>

        {missingEnv ? (
          /* Missing .env — show setup instructions instead of spinning forever */
          <div className="mt-2 max-w-sm rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-yellow-400 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Missing environment variables
            </div>
            <p className="text-xs text-yellow-300/70 leading-relaxed">
              Create a <code className="bg-yellow-400/10 px-1 rounded font-mono">.env</code> file in the
              project root with:
            </p>
            <pre className="text-left text-[11px] text-yellow-200/80 bg-black/30 rounded-lg px-3 py-2 font-mono overflow-x-auto">
{`VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key`}
            </pre>
            <p className="text-xs text-yellow-300/50">
              See <code className="font-mono">.env.example</code> in the ZIP for values.
            </p>
          </div>
        ) : (
          <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-[shimmer_1s_ease-in-out_infinite] rounded-full bg-primary"
              style={{ backgroundImage: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)', backgroundSize: '200% 100%' }} />
          </div>
        )}
      </div>
    );
  }

  if (!user && !isPublic) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && isPublic) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
