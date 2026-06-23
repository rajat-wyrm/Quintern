import { Component } from 'react';

// Top-level safety net. Without this, any uncaught render-time exception
// unmounts the entire React tree and the user sees a blank page. With it,
// the user sees a clear, actionable error and a one-click "try again" path
// (the Reset button clears query + reloads).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Surface to the console for the developer.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
    if (typeof window !== 'undefined') {
      
      try {
        window.localStorage.removeItem('user');
      } catch {}
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-rose-50 p-6"
      >
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-rose-200 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center text-2xl mb-4">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            The page hit an unexpected error and was paused to protect your
            session. Your data is safe.
          </p>
          {this.state.error?.message && (
            <pre className="mt-4 text-left text-xs bg-rose-50 text-rose-900 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg transition active:scale-95"
          >
            Reset and reload
          </button>
        </div>
      </div>
    );
  }
}
