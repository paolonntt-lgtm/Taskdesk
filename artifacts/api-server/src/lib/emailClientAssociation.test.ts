import { describe, expect, it } from "vitest";
import {
  chooseForwardedEmailAssociation,
  domainForSender,
  emailAddressPatternMatches,
  emailAddressPatternsOverlap,
  normalizeClientEmailAddress,
  resolveEmailClientAssociation,
  type EmailClientCandidate,
} from "./emailClientAssociation";

const clients = [
  { id: 1, organizationId: 7, name: "Caffè Aurora SRL", alias: "Caffe Aurora", email: "billing@caffeaurora.it", pec: "caffeaurora@pec.it" },
  { id: 2, organizationId: 7, name: "Nord Est Studio", alias: null, email: "info@nordest.it", pec: null },
];

const resolve = (senderEmail: string, senderRules: any[] = [], domainRules: any[] = [], clientRows: EmailClientCandidate[] = clients, organizationId = 7) =>
  resolveEmailClientAssociation({ organizationId, senderEmail, clients: clientRows, senderRules, domainRules });

describe("email client association", () => {
  it("matches an exact client email or PEC", () => {
    expect(resolve("BILLING@CAFFEAURORA.IT").clientId).toBe(1);
    expect(resolve("caffeaurora@pec.it").clientId).toBe(1);
    expect(resolve("billing@caffeaurora.it").matchType).toBe("profile_contact");
  });

  it("matches all senders at an explicitly saved client email domain", () => {
    const clientWithDomain = [{ ...clients[0], email: "*@iannettisrl.it" }];
    expect(resolve("paolo@iannettisrl.it", [], [], clientWithDomain).clientId).toBe(1);
    expect(resolve("contabile@altro.it", [], [], clientWithDomain).clientId).toBeNull();
    expect(resolve("paolo@sub.iannettisrl.it", [], [], clientWithDomain).clientId).toBeNull();
  });

  it("does not treat a wildcard stored in the PEC field as a profile email rule", () => {
    const clientWithWildcardPec = [{ ...clients[0], email: null, pec: "*@iannettisrl.it" }];
    expect(resolve("paolo@iannettisrl.it", [], [], clientWithWildcardPec).clientId).toBeNull();
  });

  it("normalizes and validates explicit domain patterns", () => {
    expect(normalizeClientEmailAddress(" *@IANNETTISRl.it ")).toBe("*@iannettisrl.it");
    expect(normalizeClientEmailAddress("*@not a domain")).toBe("");
    expect(normalizeClientEmailAddress("paolo@iannettisrl.it")).toBe("paolo@iannettisrl.it");
    expect(emailAddressPatternMatches("*@iannettisrl.it", "Paolo@IANNETTISRl.it")).toBe(true);
  });

  it("detects conflicts between a domain pattern and exact addresses", () => {
    expect(emailAddressPatternsOverlap("*@iannettisrl.it", "paolo@iannettisrl.it")).toBe(true);
    expect(emailAddressPatternsOverlap("*@iannettisrl.it", "*@iannettisrl.it")).toBe(true);
    expect(emailAddressPatternsOverlap("*@iannettisrl.it", "paolo@other.it")).toBe(false);
  });

  it("honors an exact sender rule on later tickets", () => {
    const result = resolve("andrea@unknown.example", [{ organizationId: 7, senderEmail: "andrea@unknown.example", clientId: 2 }]);
    expect(result.clientId).toBe(2);
    expect(result.matchType).toBe("sender_rule");
  });

  it("gives an exact client contact match priority over a conflicting domain rule", () => {
    expect(resolve("billing@caffeaurora.it", [], [
      { organizationId: 7, domain: "caffeaurora.it", clientId: 2 },
    ])).toEqual({ clientId: 1, suggestedClientId: null, matchType: "profile_contact" });
  });

  it("does not match or suggest clients when client management is disabled", () => {
    expect(resolveEmailClientAssociation({
      organizationId: 7,
      senderEmail: "billing@caffeaurora.it",
      clientsEnabled: false,
      clients,
      senderRules: [{ organizationId: 7, senderEmail: "billing@caffeaurora.it", clientId: 1 }],
      domainRules: [{ organizationId: 7, domain: "caffeaurora.it", clientId: 1 }],
    })).toEqual({ clientId: null, suggestedClientId: null });
  });

  it("does not associate or suggest a client from a matching business domain", () => {
    expect(resolve("andrea@caffeaurora.it")).toEqual({ clientId: null, suggestedClientId: null });
  });

  it("uses a confirmed custom-domain rule on future emails", () => {
    expect(resolve("another@caffeaurora.it", [], [{ organizationId: 7, domain: "caffeaurora.it", clientId: 1 }]))
      .toEqual({ clientId: 1, suggestedClientId: null, matchType: "domain_rule" });
  });

  it("does not carry a confirmed domain rule or infer a match across a different top-level domain", () => {
    expect(resolve("another@caffeaurora.com", [], [{ organizationId: 7, domain: "caffeaurora.it", clientId: 1 }]))
      .toEqual({ clientId: null, suggestedClientId: null });
  });

  it("does not infer a match from a similar client alias", () => {
    const aliasClient = [{ ...clients[0], name: "Different Company", alias: "Caffè Aurora" }];
    expect(resolve("andrea@caffeaurora.it", [], [], aliasClient))
      .toEqual({ clientId: null, suggestedClientId: null });
  });

  it.each([
    "person@gmail.com",
    "person@outlook.com",
    "person@pec.it",
    "person@support.gmail.com",
    "person@yahoo.co.uk",
    "person@proton.me",
    "person@zoho.com",
    "person@mail.com",
    "person@pec.aruba.it",
  ])(
    "does not infer a client from a shared provider domain (%s)",
    (sender) => expect(resolve(sender)).toEqual({ clientId: null, suggestedClientId: null }),
  );

  it("does not propose when the normalized name matches multiple clients", () => {
    const ambiguous = [...clients, { id: 3, organizationId: 7, name: "Caffe Aurora S.p.A.", alias: null }];
    expect(resolve("andrea@caffeaurora.it", [], [], ambiguous).suggestedClientId).toBeNull();
  });

  it("does not auto-assign conflicting contact and learned rules", () => {
    expect(resolve("billing@caffeaurora.it", [{ organizationId: 7, senderEmail: "billing@caffeaurora.it", clientId: 2 }]))
      .toEqual({
        clientId: null,
        suggestedClientId: null,
        clientAssociationIssue: "conflicting_exact_matches",
      });
  });

  it("does not auto-assign when multiple clients claim the same email", () => {
    const duplicateContact = [...clients, {
      id: 3,
      organizationId: 7,
      name: "Other Company",
      alias: null,
      email: "billing@caffeaurora.it",
    }];
    expect(resolve("billing@caffeaurora.it", [], [], duplicateContact))
      .toEqual({
        clientId: null,
        suggestedClientId: null,
        clientAssociationIssue: "conflicting_exact_matches",
      });
  });

  it("does not apply conflicting confirmed domain rules", () => {
    expect(resolve("andrea@caffeaurora.it", [], [
      { organizationId: 7, domain: "caffeaurora.it", clientId: 1 },
      { organizationId: 7, domain: "caffeaurora.it", clientId: 2 },
    ])).toEqual({
      clientId: null,
      suggestedClientId: null,
      clientAssociationIssue: "conflicting_domain_rules",
    });
  });

  it("does not apply rules or clients from another organization", () => {
    const otherOrgClient = { ...clients[1], organizationId: 8 };
    expect(resolve(
      "andrea@nordest.it",
      [{ organizationId: 8, senderEmail: "andrea@nordest.it", clientId: 2 }],
      [{ organizationId: 8, domain: "nordest.it", clientId: 2 }],
      [otherOrgClient],
    ))
      .toEqual({ clientId: null, suggestedClientId: null });
  });

  it("ignores rules whose client was deleted", () => {
    expect(resolve("andrea@unknown.example", [{ organizationId: 7, senderEmail: "andrea@unknown.example", clientId: 99 }]))
      .toEqual({ clientId: null, suggestedClientId: null });
  });

  it("does not match provider addresses and handles common two-part public suffixes", () => {
    expect(domainForSender("person@gmail.com")).toBeNull();
    expect(domainForSender("person@support.caffeaurora.co.uk")).toBe("caffeaurora.co.uk");
  });

  it("uses the explicit original-sender match only when the outer sender is unmatched", () => {
    expect(chooseForwardedEmailAssociation(
      { clientId: null, suggestedClientId: null },
      { clientId: 2, suggestedClientId: null },
    )).toEqual({ clientId: 2, suggestedClientId: null });
  });

  it("keeps the outer sender's explicit match ahead of the original sender", () => {
    expect(chooseForwardedEmailAssociation(
      { clientId: 1, suggestedClientId: null },
      { clientId: 2, suggestedClientId: null },
    )).toEqual({ clientId: 1, suggestedClientId: null });
  });

  it("does not turn an original-sender suggestion into an association", () => {
    expect(chooseForwardedEmailAssociation(
      { clientId: null, suggestedClientId: null },
      { clientId: null, suggestedClientId: 1 },
    )).toEqual({ clientId: null, suggestedClientId: null });
  });

  it("leaves a forwarded ticket unassociated when neither sender has an explicit match", () => {
    const outerSender = resolve("forwarder@external.example");
    const originalSender = resolve("andrea@caffeaurora.it");
    expect(chooseForwardedEmailAssociation(outerSender, originalSender))
      .toEqual({ clientId: null, suggestedClientId: null });
  });

  it("does not use the original sender to bypass an outer-sender conflict", () => {
    expect(chooseForwardedEmailAssociation(
      { clientId: null, suggestedClientId: null, clientAssociationIssue: "conflicting_exact_matches" },
      { clientId: 2, suggestedClientId: null },
    )).toEqual({
      clientId: null,
      suggestedClientId: null,
      clientAssociationIssue: "conflicting_exact_matches",
    });
  });
});
