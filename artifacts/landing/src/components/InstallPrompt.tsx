import React, { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "taskdesk-install-dismissed";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      setTimeout(() => {
        setShowIOSHint(true);
        setVisible(true);
      }, 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: "0 16px 16px",
        animation: "slideUp 0.35s cubic-bezier(.16,1,.3,1) both",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          padding: "16px 16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          border: "1px solid rgba(37,99,235,0.12)",
        }}
      >
        <img
          src="/favicon.png"
          alt="TaskDesk"
          style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, objectFit: "contain", background: "linear-gradient(135deg,#eff6ff,#f5f3ff)", padding: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 3 }}>
            Aggiungi TaskDesk alla schermata Home
          </div>
          {showIOSHint ? (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45 }}>
              Tocca{" "}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#2563eb", fontWeight: 600 }}>
                <Share size={13} /> Condividi
              </span>
              {" "}poi{" "}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#2563eb", fontWeight: 600 }}>
                <Plus size={13} /> Aggiungi a schermata Home
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Accedi più velocemente ai tuoi ticket, anche offline.
            </div>
          )}
          {!showIOSHint && (
            <button
              onClick={install}
              style={{
                marginTop: 12,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Installa app →
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9ca3af",
            padding: 4,
            flexShrink: 0,
          }}
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
