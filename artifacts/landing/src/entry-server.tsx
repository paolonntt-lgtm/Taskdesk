import { renderToString } from "react-dom/server";
import { Router as WouterRouter, Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "./i18n";
import Landing from "./pages/Landing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DPA from "./pages/DPA";
import CookiePolicy from "./pages/CookiePolicy";
import NotFound from "./pages/not-found";
import ProfessionLanding from "./pages/ProfessionLanding";
import { PROFESSION_IDS, PROFESSION_SLUGS, getProfessionPageProps } from "./profession-routes";

export { PROFESSION_IDS, PROFESSION_SLUGS } from "./profession-routes";

function makeStaticHook(url: string) {
  return (): [string, (path: string) => void] => [url, () => {}];
}

function ItPageRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/dpa" component={DPA} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      {PROFESSION_IDS.map((profession) => (
        <Route key={profession} path={`/${PROFESSION_SLUGS.it[profession]}`}>
          <ProfessionLanding {...getProfessionPageProps(profession)} />
        </Route>
      ))}
    </Switch>
  );
}

function EnPageRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      {PROFESSION_IDS.map((profession) => (
        <Route key={profession} path={`/${PROFESSION_SLUGS.en[profession]}`}>
          <ProfessionLanding {...getProfessionPageProps(profession)} />
        </Route>
      ))}
    </Switch>
  );
}

export function render(url: string): { html: string; helmet: unknown } {
  const helmetContext: Record<string, unknown> = {};

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <QueryClientProvider client={new QueryClient()}>
        <WouterRouter hook={makeStaticHook(url)}>
          <LanguageProvider>
            <Switch>
              <Route path="/it" nest>
                <ItPageRoutes />
              </Route>
              <Route path="/en" nest>
                <EnPageRoutes />
              </Route>
              <Route path="/404">
                <NotFound />
              </Route>
            </Switch>
          </LanguageProvider>
        </WouterRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );

  return { html, helmet: (helmetContext as any).helmet ?? null };
}
