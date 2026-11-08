import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    const msg = error.message || '';
    if (
      msg.includes('Load failed') || 
      msg.includes('Failed to fetch') || 
      msg.includes('dynamically imported module') ||
      msg.includes('is not valid JSON') ||
      msg.includes('Unexpected token')
    ) {
      if (!sessionStorage.getItem('reloaded_chunk_error')) {
        sessionStorage.setItem('reloaded_chunk_error', 'true');
        window.location.reload();
      }
    }
    return { hasError: true, error };
  }

  public componentDidMount() {
    // If the component mounts successfully without error, clear the reload flag
    // so future chunk errors will correctly trigger a reload.
    sessionStorage.removeItem('reloaded_chunk_error');
    console.log('ErrorBoundary mounted');
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-4 flex-col text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Something went wrong</h2>
          <pre className="bg-slate-900 p-4 rounded-lg overflow-auto max-w-full text-left text-sm whitespace-pre-wrap font-mono text-red-200">
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => {
              localStorage.clear(); 
              window.location.reload();
            }}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-bold"
          >
            Clear Data & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
