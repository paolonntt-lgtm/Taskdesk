import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useLanguage } from "@/i18n";
import { ANDROID_PLAY_STORE_URL, isAndroidPhone } from "@/lib/android-app";

const DISMISSED_KEY = "taskdesk-android-app-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AndroidAppPrompt({
  storeUrl = ANDROID_PLAY_STORE_URL,
}: {
  storeUrl?: string;
}) {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!storeUrl || !isAndroidPhone() || isStandalone() || wasDismissed()) return;
    const timer = window.setTimeout(() => setVisible(true), 3000);
    return () => window.clearTimeout(timer);
  }, [storeUrl]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Keep the prompt dismissible when browser storage is unavailable.
    }
  };

  if (!visible) return null;

  const copy = lang === "it"
    ? {
        title: "TaskDesk per Android",
        body: "Gestisci le tue pratiche anche dal telefono.",
        install: "Scarica dal Play Store",
        close: "Chiudi invito a scaricare l’app",
      }
    : {
        title: "TaskDesk for Android",
        body: "Manage your work from your phone.",
        install: "Get it on Google Play",
        close: "Dismiss app download invitation",
      };

  return (
    <aside
      aria-label={copy.title}
      data-testid="android-app-prompt"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_8px_40px_rgba(15,23,42,0.2)]">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Smartphone aria-hidden="true" className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900">{copy.title}</p>
          <p className="mt-0.5 text-sm leading-5 text-gray-600">{copy.body}</p>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-download-android-app"
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {copy.install}
          </a>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={copy.close}
          data-testid="button-dismiss-android-app-prompt"
          className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
