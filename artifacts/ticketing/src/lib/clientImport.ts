export type ImportFieldKey =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'vatNumber'
  | 'taxCode'
  | 'dateOfBirth'
  | 'membershipNumber'
  | 'address'
  | 'pec'
  | 'contactPerson'
  | 'email'
  | 'phone'
  | 'notes';

export interface ParsedRow {
  rowIndex: number;
  name: string;
  firstName: string;
  lastName: string;
  vatNumber: string;
  taxCode: string;
  dateOfBirth: string;
  membershipNumber: string;
  address: string;
  pec: string;
  contactPerson: string;
  email: string;
  phone: string;
  notes: string;
  error?: 'missingName' | 'missingVat' | 'duplicateVat' | 'missingMemberName' | 'invalidDateOfBirth';
}

export type ImportCell = unknown;
export type HeaderlessMapping = Record<ImportFieldKey, number | null>;
export type HeaderlessField = { key: ImportFieldKey; labelKey: ImportFieldKey; required?: boolean };
export type ParsedTabularRows = { rows: ParsedRow[]; headerlessRows?: ImportCell[][] };

const COMPANY_HEADER_FIELDS: HeaderlessField[] = [
  { key: 'name', labelKey: 'name', required: true },
  { key: 'vatNumber', labelKey: 'vatNumber', required: true },
  { key: 'taxCode', labelKey: 'taxCode' },
  { key: 'address', labelKey: 'address' },
  { key: 'pec', labelKey: 'pec' },
  { key: 'contactPerson', labelKey: 'contactPerson' },
  { key: 'email', labelKey: 'email' },
  { key: 'phone', labelKey: 'phone' },
  { key: 'notes', labelKey: 'notes' },
];

const GYM_HEADER_FIELDS: HeaderlessField[] = [
  { key: 'firstName', labelKey: 'firstName', required: true },
  { key: 'lastName', labelKey: 'lastName', required: true },
  { key: 'taxCode', labelKey: 'taxCode' },
  { key: 'dateOfBirth', labelKey: 'dateOfBirth' },
  { key: 'address', labelKey: 'address' },
  { key: 'phone', labelKey: 'phone' },
  { key: 'email', labelKey: 'email' },
  { key: 'membershipNumber', labelKey: 'membershipNumber' },
];

const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  name: ['denominazione', 'name', 'ragionesociale', 'nome'],
  firstName: ['nome', 'firstname', 'first', 'givenname', 'nomeproprio'],
  lastName: ['cognome', 'lastname', 'surname', 'familyname'],
  vatNumber: ['pivataxid', 'partitaiva', 'vatnumber', 'piva', 'vat'],
  taxCode: ['codicefiscale', 'taxcode', 'cf', 'fiscalcode'],
  dateOfBirth: ['datadinascita', 'dateofbirth', 'birthdate', 'dob'],
  membershipNumber: ['numerotessera', 'numeromembership', 'membershipnumber', 'membernumber', 'tessera'],
  address: ['indirizzo', 'address', 'indirizzocompleto'],
  pec: ['indirizzopec', 'pec'],
  contactPerson: ['referente', 'contactperson'],
  email: ['indirizzoemail', 'email', 'mail'],
  phone: ['telefono', 'phone', 'cellulare', 'mobile', 'cell'],
  notes: ['note', 'notes'],
};

function normalizedHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cellText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function formatDateCell(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const text = cellText(value);
  const match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return text;
}

function aliasesFor(field: ImportFieldKey, isGym: boolean): string[] {
  if (field === 'name' && isGym) return ['denominazione', 'name', 'ragionesociale'];
  if (field === 'firstName' && !isGym) return [];
  return HEADER_ALIASES[field];
}

function recognizedHeader(header: unknown, isGym: boolean): boolean {
  const normalized = normalizedHeader(header);
  return (Object.keys(HEADER_ALIASES) as ImportFieldKey[])
    .some((field) => aliasesFor(field, isGym).some((alias) => normalizedHeader(alias) === normalized));
}

export function getHeaderlessFields(isGym: boolean): HeaderlessField[] {
  return isGym ? GYM_HEADER_FIELDS : COMPANY_HEADER_FIELDS;
}

export function createDefaultHeaderlessMapping(isGym: boolean): HeaderlessMapping {
  const mapping = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as ImportFieldKey[]).map((key) => [key, null]),
  ) as HeaderlessMapping;
  getHeaderlessFields(isGym).forEach((field, index) => {
    mapping[field.key] = index < 2 ? index : null;
  });
  return mapping;
}

export function mapHeaderlessRows(
  rows: ImportCell[][],
  mapping: HeaderlessMapping,
  isGym: boolean,
): ParsedRow[] {
  return rows
    .filter((row) => row.some((value) => cellText(value) !== ''))
    .map((row, index) => {
      const value = (key: ImportFieldKey) => {
        const column = mapping[key];
        if (column == null) return '';
        const cell = row[column];
        return key === 'dateOfBirth' ? formatDateCell(cell) : cellText(cell);
      };
      const firstName = value('firstName');
      const lastName = value('lastName');
      return {
        rowIndex: index + 1,
        name: isGym ? [firstName, lastName].filter(Boolean).join(' ') : value('name'),
        firstName,
        lastName,
        vatNumber: value('vatNumber'),
        taxCode: value('taxCode'),
        dateOfBirth: value('dateOfBirth'),
        membershipNumber: value('membershipNumber'),
        address: value('address'),
        pec: value('pec'),
        contactPerson: value('contactPerson'),
        email: value('email'),
        phone: value('phone'),
        notes: value('notes'),
      };
    });
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const delimiter = detectCsvDelimiter(text);

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('Unclosed quoted CSV value');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ''));
}

function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"' && text[index + 1] === '"' && quoted) {
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && (character === '\n' || character === '\r')) {
      break;
    } else if (!quoted && character in counts) {
      counts[character as keyof typeof counts]++;
    }
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

export function parseTabularRows(rawRows: ImportCell[][], isGym: boolean): ParsedTabularRows {
  if (rawRows.length === 0) return { rows: [] };
  const headers = rawRows[0].map((header) => cellText(header));
  if (!headers.some((header) => recognizedHeader(header, isGym))) {
    return { rows: [], headerlessRows: rawRows };
  }
  if (rawRows.length < 2) return { rows: [] };

  const findColumn = (field: ImportFieldKey): number => {
    const aliases = aliasesFor(field, isGym).map(normalizedHeader);
    return headers.findIndex((header) => aliases.includes(normalizedHeader(header)));
  };
  const get = (row: ImportCell[], field: ImportFieldKey): string => {
    const column = findColumn(field);
    if (column === -1) return '';
    return field === 'dateOfBirth' ? formatDateCell(row[column]) : cellText(row[column]);
  };

  const rows = rawRows.slice(1).map((row, index) => {
    const street = get(row, 'address');
    const city = getByHeader(row, headers, ['comune']);
    const cap = getByHeader(row, headers, ['cap', 'postalcode', 'zipcode']);
    const province = getByHeader(row, headers, ['provincia', 'province']);
    const address = [street, [cap, city, province ? `(${province})` : ''].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    const firstName = get(row, 'firstName');
    const lastName = get(row, 'lastName');
    return {
      rowIndex: index + 2,
      name: isGym ? [firstName, lastName].filter(Boolean).join(' ') : get(row, 'name'),
      firstName,
      lastName,
      vatNumber: get(row, 'vatNumber'),
      taxCode: get(row, 'taxCode'),
      dateOfBirth: get(row, 'dateOfBirth'),
      membershipNumber: get(row, 'membershipNumber'),
      address,
      pec: get(row, 'pec'),
      contactPerson: get(row, 'contactPerson'),
      email: get(row, 'email'),
      phone: get(row, 'phone'),
      notes: get(row, 'notes'),
    };
  });
  return { rows };
}

function getByHeader(row: ImportCell[], headers: string[], aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizedHeader);
  const column = headers.findIndex((header) => normalizedAliases.includes(normalizedHeader(header)));
  return column === -1 ? '' : cellText(row[column]);
}

export function validateImportRows(
  rows: ParsedRow[],
  existingVats: Set<string>,
  isGym: boolean,
): ParsedRow[] {
  const seenVats = new Set<string>();
  return rows.map((row) => {
    if (isGym) {
      if (!row.firstName.trim() || !row.lastName.trim()) return { ...row, error: 'missingMemberName' };
      if (row.dateOfBirth && !isValidIsoDate(row.dateOfBirth)) return { ...row, error: 'invalidDateOfBirth' };
      return { ...row, name: `${row.firstName.trim()} ${row.lastName.trim()}` };
    }
    if (!row.name.trim()) return { ...row, error: 'missingName' };
    if (!row.vatNumber.trim()) return { ...row, error: 'missingVat' };
    const vatLower = row.vatNumber.trim().toLowerCase();
    if (existingVats.has(vatLower) || seenVats.has(vatLower)) return { ...row, error: 'duplicateVat' };
    seenVats.add(vatLower);
    return row;
  });
}

function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}
