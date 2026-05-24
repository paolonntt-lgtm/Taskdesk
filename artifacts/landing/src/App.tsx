import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import DPA from "@/pages/DPA";
import CookiePolicy from "@/pages/CookiePolicy";
import { LanguageProvider } from "@/i18n";

const queryClient = new QueryClient();

const LANG_STORAGE_KEY = "td_landing_lang";

function getPreferredLang(): "en" | "it" {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "en" || saved === "it") return saved;
  } catch {
    // ignore storage errors
  }
  const browserLang = (navigator.language ?? "").toLowerCase();
  return browserLang.startsWith("en") ? "en" : "it";
}

function LangRedirect({ suffix }: { suffix: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    const lang = getPreferredLang();
    navigate(`/${lang}${suffix}`, { replace: true });
  }, [suffix, navigate]);
  return null;
}

function PageRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/dpa" component={DPA} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/it" nest>
        <PageRoutes />
      </Route>
      <Route path="/en" nest>
        <PageRoutes />
      </Route>
      <Route path="/">
        <LangRedirect suffix="/" />
      </Route>
      <Route path="/privacy-policy">
        <LangRedirect suffix="/privacy-policy" />
      </Route>
      <Route path="/terms">
        <LangRedirect suffix="/terms" />
      </Route>
      <Route path="/dpa">
        <LangRedirect suffix="/dpa" />
      </Route>
      <Route path="/cookie-policy">
        <LangRedirect suffix="/cookie-policy" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <LanguageProvider>
            <Router />
          </LanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
