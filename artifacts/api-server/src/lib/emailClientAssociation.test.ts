import { describe, expect, it } from "vitest";
import { domainForSender, resolveEmailClientAssociation, type EmailClientCandidate } from "./emailClientAssociation";

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
  });

  it("honors an exact sender rule on later tickets", () => {
    expect(resolve("andrea@unknown.example", [{ organizationId: 7, senderEmail: "andrea@unknown.example", clientId: 2 }]).clientId).toBe(2);
  });

  it("gives an exact client contact match priority over a conflicting domain rule", () => {
    expect(resolve("billing@caffeaurora.it", [], [
      { organizationId: 7, domain: "caffeaurora.it", clientId: 2 },
    ])).toEqual({ clientId: 1, suggestedClientId: null });
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

  it("suggests a unique business-name match without assigning it", () => {
    expect(resolve("andrea@caffeaurora.it")).toEqual({ clientId: null, suggestedClientId: 1 });
  });

  it("uses a confirmed custom-domain rule on future emails", () => {
    expect(resolve("another@caffeaurora.it", [], [{ organizationId: 7, domain: "caffeaurora.it", clientId: 1 }]))
      .toEqual({ clientId: 1, suggestedClientId: null });
  });

  it("does not carry a confirmed domain rule across a different top-level domain", () => {
    expect(resolve("another@caffeaurora.com", [], [{ organizationId: 7, domain: "caffeaurora.it", clientId: 1 }]))
      .toEqual({ clientId: null, suggestedClientId: 1 });
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
      .toEqual({ clientId: null, suggestedClientId: null });
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
      .toEqual({ clientId: null, suggestedClientId: null });
  });

  it("does not apply conflicting confirmed domain rules", () => {
    expect(resolve("andrea@caffeaurora.it", [], [
      { organizationId: 7, domain: "caffeaurora.it", clientId: 1 },
      { organizationId: 7, domain: "caffeaurora.it", clientId: 2 },
    ])).toEqual({ clientId: null, suggestedClientId: null });
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
});
