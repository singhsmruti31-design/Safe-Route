import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary — catches render-time JS errors in child components and
 * shows a friendly fallback UI instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyComponent />
 *   </ErrorBoundary>
 *
 * Optional props:
 *   fallback   — custom fallback node
 *   onError    — callback(error, errorInfo)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
          <h2 className="text-xl font-semibold text-text-dark mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6 max-w-sm">
            An unexpected error occurred in this section. You can try refreshing the page or
            going back to the previous screen.
          </p>
          {this.state.error && (
            <pre className="text-xs text-left bg-gray-100 border border-border rounded-lg p-3 mb-6 max-w-full overflow-x-auto whitespace-pre-wrap text-danger">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

