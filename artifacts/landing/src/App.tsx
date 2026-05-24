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

function NavigateTo({ href }: { href: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(href, { replace: true });
  }, [href, navigate]);
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
        <NavigateTo href="/it/" />
      </Route>
      <Route path="/privacy-policy">
        <NavigateTo href="/it/privacy-policy" />
      </Route>
      <Route path="/terms">
        <NavigateTo href="/it/terms" />
      </Route>
      <Route path="/dpa">
        <NavigateTo href="/it/dpa" />
      </Route>
      <Route path="/cookie-policy">
        <NavigateTo href="/it/cookie-policy" />
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
