import { describe, expect, it } from "vitest";
import { getClientEmailAddressConflicts, parseClientEmailAddresses } from "./ClientEmailAddressFields";

describe("client email address fields", () => {
  it("preserves a domain wildcard as one profile entry", () => {
    expect(parseClientEmailAddresses("info@example.it; *@IannettiSRL.it"))
      .toEqual(["info@example.it", "*@iannettisrl.it"]);
  });

  it("warns when a new wildcard overlaps another client's exact address", () => {
    expect(getClientEmailAddressConflicts(["*@iannettisrl.it"], [{
      address: "paolo@iannettisrl.it",
      clientId: 2,
      clientName: "Other Client",
      sources: ["profile"],
    }], 1)).toHaveLength(1);
  });
});
