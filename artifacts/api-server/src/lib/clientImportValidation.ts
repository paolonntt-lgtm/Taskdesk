import { z } from "zod";

const optionalText = (maxLength: number) => z.string().max(maxLength).optional().nullable();

export const ClientImportRowSchema = z.object({
  name: optionalText(255),
  firstName: optionalText(150),
  lastName: optionalText(150),
  vatNumber: optionalText(100),
  taxCode: optionalText(100),
  dateOfBirth: z.string().date().optional().nullable(),
  membershipNumber: optionalText(150),
  address: optionalText(1000),
  pec: optionalText(500),
  contactPerson: optionalText(255),
  email: optionalText(500),
  phone: optionalText(100),
  notes: optionalText(10_000),
});

export type PreparedClientImportRow = {
  name: string;
  firstName: string | null;
  lastName: string | null;
  vatNumber: string | null;
  taxCode: string | null;
  dateOfBirth: string | null;
  membershipNumber: string | null;
  address: string | null;
  pec: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type ClientImportRowValidation =
  | { ok: true; value: PreparedClientImportRow }
  | { ok: false; reason: string; name: string | null };

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function prepareClientImportRow(input: unknown, isGym: boolean): ClientImportRowValidation {
  const parsed = ClientImportRowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "Invalid row format", name: null };

  const row = parsed.data;
  const firstName = clean(row.firstName);
  const lastName = clean(row.lastName);
  const vatNumber = clean(row.vatNumber);
  const name = isGym
    ? [firstName, lastName].filter(Boolean).join(" ")
    : clean(row.name);

  if (isGym && (!firstName || !lastName)) {
    return { ok: false, reason: "Missing required first and last name", name };
  }
  if (!name) {
    return { ok: false, reason: "Missing required Name", name: null };
  }
  if (!isGym && !vatNumber) {
    return { ok: false, reason: "Missing required VAT Number", name };
  }

  return {
    ok: true,
    value: {
      name,
      firstName,
      lastName,
      vatNumber,
      taxCode: clean(row.taxCode),
      dateOfBirth: clean(row.dateOfBirth),
      membershipNumber: clean(row.membershipNumber),
      address: clean(row.address),
      pec: clean(row.pec),
      contactPerson: clean(row.contactPerson),
      email: clean(row.email),
      phone: clean(row.phone),
      notes: clean(row.notes),
    },
  };
}
