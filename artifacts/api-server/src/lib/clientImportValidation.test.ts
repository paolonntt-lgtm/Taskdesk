import { describe, expect, it } from "vitest";
import { prepareClientImportRow } from "./clientImportValidation";

describe("client import row validation", () => {
  it("accepts gym member fields without VAT and prepares persisted member data", () => {
    const result = prepareClientImportRow({
      firstName: " Ada ",
      lastName: " Lombardi ",
      taxCode: " LMBDAX00A01H501Z ",
      dateOfBirth: "2000-02-01",
      membershipNumber: " GYM-42 ",
      address: " Via Roma 1 ",
      phone: "3331234567",
      email: "ada@example.com",
    }, true);

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ada Lombardi",
        firstName: "Ada",
        lastName: "Lombardi",
        vatNumber: null,
        taxCode: "LMBDAX00A01H501Z",
        dateOfBirth: "2000-02-01",
        membershipNumber: "GYM-42",
        address: "Via Roma 1",
        pec: null,
        contactPerson: null,
        email: "ada@example.com",
        phone: "3331234567",
        notes: null,
      },
    });
  });

  it("rejects malformed dates and incomplete gym names", () => {
    expect(prepareClientImportRow({
      firstName: "Ada",
      lastName: "Lombardi",
      dateOfBirth: "2000-02-30",
    }, true).ok).toBe(false);

    expect(prepareClientImportRow({
      firstName: "Ada",
      dateOfBirth: "2000-02-01",
    }, true)).toMatchObject({ ok: false, reason: "Missing required first and last name" });
  });

  it("keeps the company name and VAT requirements for non-gym organizations", () => {
    expect(prepareClientImportRow({ name: "Studio Alfa", vatNumber: "IT12345" }, false)).toMatchObject({
      ok: true,
      value: { name: "Studio Alfa", vatNumber: "IT12345" },
    });
    expect(prepareClientImportRow({ name: "Studio Alfa" }, false)).toMatchObject({
      ok: false,
      reason: "Missing required VAT Number",
    });
  });

  it("rejects oversized or incorrectly typed import fields", () => {
    expect(prepareClientImportRow({
      firstName: "A".repeat(151),
      lastName: "Member",
    }, true)).toMatchObject({ ok: false, reason: "Invalid row format" });
  });
});
