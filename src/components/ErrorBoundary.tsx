import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-zinc-900 rounded-lg p-8 border border-zinc-800">
            <h1 className="text-3xl font-bold text-red-500 mb-4">
              ⚠️ Application Error
            </h1>
            <p className="text-zinc-300 mb-4">
              Something went wrong while loading the application.
            </p>
            
            {this.state.error && (
              <div className="bg-black rounded p-4 mb-4 overflow-x-auto">
                <p className="text-red-400 font-mono text-sm">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="space-y-2 text-sm text-zinc-400">
              <p className="font-semibold text-white">Common issues:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Missing environment variables in Vercel</li>
                <li>Incorrect Appwrite configuration</li>
                <li>Network connectivity issues</li>
              </ul>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors w-full"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
