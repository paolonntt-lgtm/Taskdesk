import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Last-resort safety net: if anything in the tree (including context
// providers) throws during render, show a recoverable screen instead of a
// blank white page. This sits outside LanguageProvider, so it cannot rely on
// useLanguage()/translations.ts — it intentionally uses a small hardcoded
// Italian/English message rather than the app's i18n system.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Unhandled error caught by ErrorBoundary:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 16,
            fontFamily: "Inter, system-ui, sans-serif",
            textAlign: "center",
            padding: 24,
            background: "#f5f7fa",
            color: "#1a1a1a",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>Qualcosa è andato storto</h2>
          <p style={{ margin: 0, color: "#5f6368", maxWidth: 420 }}>
            Si è verificato un errore imprevisto. Ricarica la pagina per continuare.
            <br />
            <span style={{ fontSize: 13 }}>
              Something went wrong. Please reload the page to continue.
            </span>
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 28px",
              borderRadius: 8,
              border: "none",
              background: "#0f62fe",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ricarica pagina / Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
