import React from 'react';
import { Cloud, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Cloud className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground break-words">{this.state.message || 'An unexpected error occurred.'}</p>
          </div>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Reload app
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
