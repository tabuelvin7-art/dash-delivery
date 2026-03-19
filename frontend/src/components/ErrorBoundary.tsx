import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
              >
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
