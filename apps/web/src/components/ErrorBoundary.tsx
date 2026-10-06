import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application error boundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center bg-slate-950 text-slate-100">
            <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
            <p className="max-w-md text-sm text-slate-400">
              An unexpected error occurred. Refresh the page or return to the dashboard.
            </p>
            <button
              type="button"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              onClick={() => window.location.assign('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
