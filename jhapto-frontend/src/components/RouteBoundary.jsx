import React, { Component } from 'react';

// Keep navigation usable if an on-demand screen cannot be downloaded.
export default class RouteBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Could not load screen', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container stack" role="alert">
        <p>Could not load this page. Check your connection and try again.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
