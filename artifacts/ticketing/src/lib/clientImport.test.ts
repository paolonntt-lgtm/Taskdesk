import { describe, expect, it } from 'vitest';
import {
  createDefaultHeaderlessMapping,
  mapHeaderlessRows,
  parseCsvText,
  parseTabularRows,
  validateImportRows,
} from './clientImport';

describe('client import parsing and preview validation', () => {
  it('parses gym CSV members without VAT and maps Italian semicolon-delimited headers', () => {
    const csv = [
      'Nome;Cognome;Codice Fiscale;Data di nascita;Indirizzo;Cellulare;Email;Numero tessera',
      'Ada;Lombardi;LMBDAX00A01H501Z;01/02/2000;Via Roma 1;3331234567;ada@example.com;GYM-42',
    ].join('\r\n');

    const parsed = parseTabularRows(parseCsvText(csv), true);
    expect(parsed.headerlessRows).toBeUndefined();
    const rows = validateImportRows(parsed.rows, new Set(), true);
    expect(rows[0]).toMatchObject({
      name: 'Ada Lombardi',
      firstName: 'Ada',
      lastName: 'Lombardi',
      taxCode: 'LMBDAX00A01H501Z',
      dateOfBirth: '2000-02-01',
      address: 'Via Roma 1',
      phone: '3331234567',
      email: 'ada@example.com',
      membershipNumber: 'GYM-42',
    });
    expect(rows[0].error).toBeUndefined();
  });

  it('previews gym XLSX-shaped rows and flags invalid dates or missing member names', () => {
    const parsed = parseTabularRows([
      ['First name', 'Last name', 'Tax code', 'Date of birth', 'Mobile', 'Membership number'],
      ['Ada', 'Lombardi', 'LMBDAX00A01H501Z', new Date(2000, 1, 1), '3331234567', 'GYM-42'],
      ['Luca', 'Rossi', '', '31/02/2000', '', ''],
    ], true);
    const rows = validateImportRows(parsed.rows, new Set(), true);
    expect(rows[0].dateOfBirth).toBe('2000-02-01');
    expect(rows[0].error).toBeUndefined();
    expect(rows[1].error).toBe('invalidDateOfBirth');
  });

  it('keeps company imports VAT-required and identifies duplicate VAT numbers', () => {
    const parsed = parseTabularRows([
      ['Denominazione', 'P.IVA/TAX ID', 'Codice Fiscale', 'Indirizzo'],
      ['Studio Alfa', 'IT12345', 'ALF123', 'Via Milano 8'],
      ['Studio Beta', '', '', 'Via Torino 4'],
      ['Studio Gamma', 'IT12345', '', 'Via Roma 2'],
    ], false);
    const rows = validateImportRows(parsed.rows, new Set(), false);
    expect(rows.map((row) => row.error)).toEqual([undefined, 'missingVat', 'duplicateVat']);
    expect(rows[0]).toMatchObject({ name: 'Studio Alfa', vatNumber: 'IT12345', address: 'Via Milano 8' });
  });

  it('maps headerless gym columns using member fields and parses quoted CSV cells', () => {
    const cells = parseCsvText('"Ada, Marie",Lombardi,CF123,2000-02-01,Via Roma,333123,G-10');
    const fields = createDefaultHeaderlessMapping(true);
    fields.firstName = 0;
    fields.lastName = 1;
    fields.taxCode = 2;
    fields.dateOfBirth = 3;
    fields.address = 4;
    fields.phone = 5;
    fields.membershipNumber = 6;

    const rows = validateImportRows(mapHeaderlessRows(cells, fields, true), new Set(), true);
    expect(rows[0]).toMatchObject({
      firstName: 'Ada, Marie',
      lastName: 'Lombardi',
      name: 'Ada, Marie Lombardi',
      membershipNumber: 'G-10',
    });
    expect(rows[0].error).toBeUndefined();
  });
});
