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
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { LanguageProvider } from "@/i18n";
import ProfessionLanding from "@/pages/ProfessionLanding";
import { getProfessionPageProps } from "@/profession-routes";

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

function EnLegalRedirect({ suffix }: { suffix: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(`~/it${suffix}`, { replace: true });
  }, [suffix, navigate]);
  return null;
}

function ItPageRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/dpa" component={DPA} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      <Route path="/commercialista">
        <ProfessionLanding {...getProfessionPageProps("commercialisti")} />
      </Route>
      <Route path="/avvocato">
        <ProfessionLanding {...getProfessionPageProps("avvocati")} />
      </Route>
      <Route path="/consulente-del-lavoro">
        <ProfessionLanding {...getProfessionPageProps("consulenti-del-lavoro")} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function EnPageRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/accountant">
        <ProfessionLanding {...getProfessionPageProps("commercialisti")} />
      </Route>
      <Route path="/lawyer">
        <ProfessionLanding {...getProfessionPageProps("avvocati")} />
      </Route>
      <Route path="/employment-consultant">
        <ProfessionLanding {...getProfessionPageProps("consulenti-del-lavoro")} />
      </Route>
      <Route path="/privacy-policy">
        <EnLegalRedirect suffix="/privacy-policy" />
      </Route>
      <Route path="/terms">
        <EnLegalRedirect suffix="/terms" />
      </Route>
      <Route path="/dpa">
        <EnLegalRedirect suffix="/dpa" />
      </Route>
      <Route path="/cookie-policy">
        <EnLegalRedirect suffix="/cookie-policy" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/it" nest>
        <ItPageRoutes />
      </Route>
      <Route path="/en" nest>
        <EnPageRoutes />
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
            <CookieConsentBanner />
          </LanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
