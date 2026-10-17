import React, { useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, MenuItem,
  DialogActions, Alert, InputAdornment, Tooltip, Snackbar, Chip,
  LinearProgress, Divider, Checkbox, FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, Search, OpenInNew, Upload, FileUpload } from '@mui/icons-material';
import { useListClients, useCreateClient, useUpdateClient, useDeleteClient, getGetClientQueryKey, getListClientsQueryKey } from '@workspace/api-client-react';
import type { Client, ClientInput } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { readSheet, type CellValue } from 'read-excel-file/browser';
import { invalidateTicketDataAfterClientRename } from '../lib/clientNameCache';

const emptyForm: ClientInput = {
  name: '',
  alias: null,
  email: null,
  phone: null,
  vatNumber: null,
  taxCode: null,
  address: null,
  pec: null,
  contactPerson: null,
  notes: null,
};

interface ParsedRow {
  rowIndex: number;
  name: string;
  vatNumber: string;
  taxCode: string;
  address: string;
  pec: string;
  contactPerson: string;
  email: string;
  phone: string;
  notes: string;
  error?: string;
}

type ImportFieldKey = 'name' | 'vatNumber' | 'taxCode' | 'address' | 'pec' | 'contactPerson' | 'email' | 'phone' | 'notes';
type HeaderlessMapping = Record<ImportFieldKey, number | null>;
type ImportCell = CellValue | null;
type ParsedXlsx = { rows: ParsedRow[]; headerlessRows?: ImportCell[][] };

const HEADERLESS_FIELDS = [
  { key: 'name', labelKey: 'name', required: true },
  { key: 'vatNumber', labelKey: 'vatNumber', required: true },
  { key: 'taxCode', labelKey: 'taxCode' },
  { key: 'address', labelKey: 'address' },
  { key: 'pec', labelKey: 'pec' },
  { key: 'contactPerson', labelKey: 'contactPerson' },
  { key: 'email', labelKey: 'email' },
  { key: 'phone', labelKey: 'phone' },
  { key: 'notes', labelKey: 'notes' },
] as const;

const KNOWN_XLSX_HEADERS = new Set([
  'Denominazione', 'Nome', 'name',
  'P.IVA/TAX ID', 'PartitaIVA', 'Partita IVA', 'vatNumber', 'PIVA',
  'Codice Fiscale', 'CodiceFiscale', 'taxCode', 'CF',
  'Indirizzo', 'address', 'Comune', 'CAP', 'Provincia',
  'Indirizzo PEC', 'PEC', 'pec', 'Referente', 'contactPerson',
  'Indirizzo e-mail', 'Email', 'email', 'Telefono', 'phone', 'Note', 'notes',
]);

function createDefaultHeaderlessMapping(): HeaderlessMapping {
  return {
    name: 0,
    vatNumber: 1,
    taxCode: null,
    address: null,
    pec: null,
    contactPerson: null,
    email: null,
    phone: null,
    notes: null,
  };
}

function mapHeaderlessRows(rows: ImportCell[][], mapping: HeaderlessMapping): ParsedRow[] {
  return rows
    .filter((row) => row.some((value) => String(value ?? '').trim() !== ''))
    .map((row, i) => {
      const value = (key: ImportFieldKey) => {
        const column = mapping[key];
        return column === null ? '' : String(row[column] ?? '').trim();
      };
      return {
        rowIndex: i + 1,
        name: value('name'),
        vatNumber: value('vatNumber'),
        taxCode: value('taxCode'),
        address: value('address'),
        pec: value('pec'),
        contactPerson: value('contactPerson'),
        email: value('email'),
        phone: value('phone'),
        notes: value('notes'),
      };
    });
}

function excelColumnName(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

async function parseXlsx(file: File): Promise<ParsedXlsx> {
  try {
    const rawRows = await readSheet(file);
    if (rawRows.length === 0) return { rows: [] };
    const headers = rawRows[0].map((h: ImportCell) => String(h ?? '').trim());
    if (!headers.some((header) => KNOWN_XLSX_HEADERS.has(header))) {
      return { rows: [], headerlessRows: rawRows };
    }
    if (rawRows.length < 2) return { rows: [] };
    const getCol = (row: ImportCell[], ...names: string[]): string => {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx !== -1 && row[idx] != null) return String(row[idx]).trim();
      }
      return '';
    };
    const rows = rawRows.slice(1).map((row: ImportCell[], i: number) => {
      const street   = getCol(row, 'Indirizzo', 'address');
      const city     = getCol(row, 'Comune');
      const cap      = getCol(row, 'CAP');
      const prov     = getCol(row, 'Provincia');
      const cityLine = [cap, city, prov ? `(${prov})` : ''].filter(Boolean).join(' ');
      const address  = [street, cityLine].filter(Boolean).join(', ');
      return {
        rowIndex: i + 2,
        name:          getCol(row, 'Denominazione', 'Nome', 'name'),
        vatNumber:     getCol(row, 'P.IVA/TAX ID', 'PartitaIVA', 'Partita IVA', 'vatNumber', 'PIVA'),
        taxCode:       getCol(row, 'Codice Fiscale', 'CodiceFiscale', 'taxCode', 'CF'),
        address,
        pec:           getCol(row, 'Indirizzo PEC', 'PEC', 'pec'),
        contactPerson: getCol(row, 'Referente', 'contactPerson'),
        email:         getCol(row, 'Indirizzo e-mail', 'Email', 'email'),
        phone:         getCol(row, 'Telefono', 'phone'),
        notes:         getCol(row, 'Note', 'notes'),
      };
    });
    return { rows };
  } catch {
    throw new Error('parse_error');
  }
}

function parseXml(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');
        const parserError = doc.querySelector('parsererror');
        if (parserError) throw new Error('invalid xml');

        const items = Array.from(
          doc.querySelectorAll('cliente, client, row, item, Cliente, Client, Row, Item')
        );
        if (items.length === 0) throw new Error('no items');

        const get = (el: Element, ...tags: string[]) => {
          for (const tag of tags) {
            const node = el.querySelector(tag);
            if (node) return node.textContent?.trim() ?? '';
          }
          return '';
        };

        const rows: ParsedRow[] = items.map((el, i) => ({
          rowIndex: i + 1,
          name: get(el, 'Denominazione', 'Nome', 'Name', 'nome', 'name'),
          vatNumber: get(el, 'PartitaIVA', 'Partita_IVA', 'vatNumber', 'PIva', 'PIVA'),
          taxCode: get(el, 'CodiceFiscale', 'Codice_Fiscale', 'taxCode', 'CF'),
          address: get(el, 'Indirizzo', 'Address', 'indirizzo', 'address'),
          pec: get(el, 'IndirizzoP_EC', 'PEC', 'pec'),
          contactPerson: get(el, 'Referente', 'contactPerson', 'referente'),
          email: get(el, 'IndirizzoEmail', 'Email', 'email', 'Mail', 'mail'),
          phone: get(el, 'Telefono', 'Phone', 'telefono', 'phone', 'Tel'),
          notes: get(el, 'Note', 'notes', 'note'),
        }));
        resolve(rows);
      } catch {
        reject(new Error('parse_error'));
      }
    };
    reader.onerror = () => reject(new Error('read_error'));
    reader.readAsText(file);
  });
}

function validateRows(rows: ParsedRow[], existingVats: Set<string>): ParsedRow[] {
  const seenVats = new Set<string>();
  return rows.map((r) => {
    if (!r.name) return { ...r, error: 'missingName' };
    if (!r.vatNumber) return { ...r, error: 'missingVat' };
    const vatLower = r.vatNumber.toLowerCase();
    if (existingVats.has(vatLower) || seenVats.has(vatLower)) return { ...r, error: 'duplicateVat' };
    seenVats.add(vatLower);
    return r;
  });
}

export default function Clients() {
  const { t, lang } = useLanguage();
  const tc = t.clients;
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userGroupPermissions: string[] = ((user as any)?.groupPermissions as string[] | undefined) ?? [];
  const canViewWorkedHours = isAdmin || userGroupPermissions.includes('view_worked_hours');

  const [search, setSearch] = useState('');
  const { data: organizationSettings } = useQuery<{ clientsEnabled?: boolean; workedTimeEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('organization settings unavailable');
      return response.json();
    },
    staleTime: 5 * 60_000,
  });
  const canFilterByUnbilledWorkedTime = canViewWorkedHours
    && organizationSettings != null
    && organizationSettings.clientsEnabled !== false
    && organizationSettings.workedTimeEnabled !== false;
  const [unbilledOnly, setUnbilledOnly] = useState(false);
  const isFilteringUnbilled = canFilterByUnbilledWorkedTime && unbilledOnly;
  const clientsQuery = useListClients({
    search: search || undefined,
    ...(isFilteringUnbilled ? { hasUnbilledWorkedTime: true } : {}),
  });
  const clients = clientsQuery.data ?? [];
  const isLoading = clientsQuery.isLoading;
  const { data: allClients = [] } = useListClients({});

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedRow[] | null>(null);
  const [headerlessImport, setHeaderlessImport] = useState<{
    rows: ImportCell[][];
    columnCount: number;
    mapping: HeaderlessMapping;
  } | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importParseError, setImportParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = useCallback(() => {
    setEditingClient(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      alias: (client as any).alias ?? null,
      email: client.email ?? null,
      phone: client.phone ?? null,
      vatNumber: (client as any).vatNumber ?? null,
      taxCode: (client as any).taxCode ?? null,
      address: (client as any).address ?? null,
      pec: (client as any).pec ?? null,
      contactPerson: (client as any).contactPerson ?? null,
      notes: client.notes ?? null,
    });
    setFormError('');
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    if (!form.name?.trim()) { setFormError(tc.errorRequired); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        alias: (form as any).alias?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        vatNumber: (form as any).vatNumber?.trim() || null,
        taxCode: (form as any).taxCode?.trim() || null,
        address: (form as any).address?.trim() || null,
        pec: (form as any).pec?.trim() || null,
        contactPerson: (form as any).contactPerson?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (editingClient) {
        await updateClient.mutateAsync({ id: editingClient.id, data: payload });
        await qc.invalidateQueries({ queryKey: getGetClientQueryKey(editingClient.id) });
        if (editingClient.name !== payload.name) {
          await invalidateTicketDataAfterClientRename(qc);
        }
      } else {
        await createClient.mutateAsync({ data: payload });
      }
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setDialogOpen(false);
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.status === 409) {
        setFormError(tc.errorDuplicateVat);
      } else {
        setFormError(tc.errorSaving);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteError('');
    try {
      await deleteClient.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setConfirmDeleteId(null);
    } catch {
      setDeleteError(tc.errorDeleting);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportParseError('');
    setImportRows(null);
    setHeaderlessImport(null);
    setImportFileName(file.name);

    try {
      let raw: ParsedRow[];
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const parsed = await parseXlsx(file);
        if (parsed.headerlessRows) {
          const columnCount = Math.max(0, ...parsed.headerlessRows.map((row) => row.length));
          const headerless = {
            rows: parsed.headerlessRows,
            columnCount,
            mapping: createDefaultHeaderlessMapping(),
          };
          setHeaderlessImport(headerless);
          raw = mapHeaderlessRows(headerless.rows, headerless.mapping);
        } else {
          raw = parsed.rows;
        }
      } else if (file.name.toLowerCase().endsWith('.xml')) {
        raw = await parseXml(file);
      } else {
        setImportParseError(tc.importErrorParse);
        return;
      }
      const existingVats = new Set(
        allClients.map((c) => ((c as any).vatNumber ?? '').toString().trim().toLowerCase()).filter(Boolean)
      );
      setImportRows(validateRows(raw, existingVats));
    } catch {
      setImportParseError(tc.importErrorParse);
    }
    e.target.value = '';
  };

  const handleHeaderlessMappingChange = (field: ImportFieldKey, value: string) => {
    if (!headerlessImport) return;
    const mapping = { ...headerlessImport.mapping, [field]: value === '' ? null : Number(value) };
    const next = { ...headerlessImport, mapping };
    setHeaderlessImport(next);
    const existingVats = new Set(
      allClients.map((c) => ((c as any).vatNumber ?? '').toString().trim().toLowerCase()).filter(Boolean)
    );
    setImportRows(validateRows(mapHeaderlessRows(next.rows, mapping), existingVats));
  };

  const handleImportConfirm = async () => {
    if (!importRows) return;
    const validRows = importRows.filter((r) => !r.error);
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch('/api/clients/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            name: r.name,
            vatNumber: r.vatNumber || null,
            taxCode: r.taxCode || null,
            address: r.address || null,
            pec: r.pec || null,
            contactPerson: r.contactPerson || null,
            email: r.email || null,
            phone: r.phone || null,
            notes: r.notes || null,
          })),
        }),
      });

      if (!res.ok) throw new Error('server');
      const result = await res.json();
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setImportOpen(false);
      setImportRows(null);
      setHeaderlessImport(null);
      setImportFileName('');
      setSnackbar({ open: true, msg: tc.importSuccessMsg(result.imported, result.skipped + errorCount + duplicateCount), severity: 'success' });
    } catch {
      setSnackbar({ open: true, msg: tc.importErrorServer, severity: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const validCount = importRows?.filter((r) => !r.error).length ?? 0;
  const errorCount = importRows?.filter((r) => r.error && r.error !== 'duplicateVat').length ?? 0;
  const duplicateCount = importRows?.filter((r) => r.error === 'duplicateVat').length ?? 0;

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">{tc.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {clients.length} {tc.subtitle}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {isAdmin && (
            <Button variant="outlined" startIcon={<Upload />} onClick={() => setImportOpen(true)}>
              {tc.importClients}
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            {tc.addClient}
          </Button>
        </Box>
      </Box>

      <Box mb={2} display="flex" alignItems="center" gap={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder={tc.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 260 }}
        />
        {canFilterByUnbilledWorkedTime && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={unbilledOnly}
                onChange={(event) => setUnbilledOnly(event.target.checked)}
              />
            }
            label={tc.filterClientsWithUnbilledWorkedTime}
            sx={{ '& .MuiFormControlLabel-label': { fontSize: 13 } }}
          />
        )}
      </Box>

      {clientsQuery.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => clientsQuery.refetch()}>
              {lang === 'it' ? 'Riprova' : 'Try again'}
            </Button>
          }
        >
          {lang === 'it'
            ? 'Impossibile aggiornare l’elenco clienti. I dati visualizzati potrebbero non essere aggiornati.'
            : 'Could not refresh the customer list. The displayed data may be out of date.'}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colName}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colVat}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colEmail}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colPhone}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">{tc.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && !clientsQuery.isError && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {isFilteringUnbilled ? tc.noClientsWithUnbilledWorkedTime : tc.noClients}
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id} hover>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => setLocation(`/clients/${client.id}`)}
                  >
                    {client.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{(client as any).vatNumber ?? '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{client.email ?? '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{client.phone ?? '—'}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={tc.detailTitle}>
                    <IconButton size="small" onClick={() => setLocation(`/clients/${client.id}`)}>
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={tc.editClient}>
                    <IconButton size="small" onClick={() => openEdit(client)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={tc.deleteClient}>
                    <IconButton size="small" color="error" onClick={() => setConfirmDeleteId(client.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingClient ? tc.editClient : tc.createClient}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label={tc.name}
              required
              fullWidth
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label={tc.alias}
              fullWidth
              value={(form as any).alias ?? ''}
              onChange={e => setForm(f => ({ ...f, alias: e.target.value || null } as any))}
              placeholder={tc.aliasPlaceholder}
              helperText={tc.aliasPlaceholder}
            />
            <TextField
              label={tc.vatNumber}
              fullWidth
              value={(form as any).vatNumber ?? ''}
              onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value || null } as any))}
            />
            <TextField
              label={tc.taxCode}
              fullWidth
              value={(form as any).taxCode ?? ''}
              onChange={e => setForm(f => ({ ...f, taxCode: e.target.value || null } as any))}
            />
            <TextField
              label={tc.address}
              fullWidth
              value={(form as any).address ?? ''}
              onChange={e => setForm(f => ({ ...f, address: e.target.value || null } as any))}
            />
            <TextField
              label={tc.pec}
              fullWidth
              value={(form as any).pec ?? ''}
              onChange={e => setForm(f => ({ ...f, pec: e.target.value || null } as any))}
            />
            <TextField
              label={tc.contactPerson}
              fullWidth
              value={(form as any).contactPerson ?? ''}
              onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value || null } as any))}
            />
            <TextField
              label={tc.email}
              fullWidth
              type="email"
              value={form.email ?? ''}
              onChange={e => setForm(f => ({ ...f, email: e.target.value || null }))}
            />
            <TextField
              label={tc.phone}
              fullWidth
              value={form.phone ?? ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))}
            />
            <TextField
              label={tc.notes}
              fullWidth
              multiline
              rows={3}
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{tc.cancel}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? tc.saving : tc.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{tc.deleteClient}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}
          <Typography>{tc.deleteClientConfirm}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDeleteId(null)}>{tc.cancel}</Button>
          <Button variant="contained" color="error" onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}>
            {tc.deleteClient}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => { setImportOpen(false); setImportRows(null); setHeaderlessImport(null); setImportFileName(''); setImportParseError(''); }} maxWidth="md" fullWidth>
        <DialogTitle>{tc.importDialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {tc.importDialogSubtitle}
          </Typography>
          <Box mb={2} display="flex" flexDirection="column" gap={1}>
            <Typography variant="caption" color="text.secondary">{tc.importTemplateHint}</Typography>
            <Typography variant="caption" color="text.secondary">{tc.importXmlHint}</Typography>
          </Box>

          <input
            type="file"
            accept=".xlsx,.xml"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="outlined"
            startIcon={<FileUpload />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ mb: 2 }}
          >
            {importFileName ? tc.importChangeFile : tc.importSelectFile}
          </Button>
          {importFileName && (
            <Typography variant="body2" color="text.secondary" mb={1}>
              {importFileName}
            </Typography>
          )}

          {importParseError && <Alert severity="error" sx={{ mb: 2 }}>{importParseError}</Alert>}

          {headerlessImport && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" mb={1}>{tc.importNoHeaders}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 1.5 }}>
                {HEADERLESS_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    select
                    size="small"
                    label={`${tc[field.labelKey]}${'required' in field && field.required ? ' *' : ''}`}
                    value={headerlessImport.mapping[field.key] ?? ''}
                    onChange={(event) => handleHeaderlessMappingChange(field.key, event.target.value)}
                  >
                    <MenuItem value="">{tc.importSkipColumn}</MenuItem>
                    {Array.from({ length: headerlessImport.columnCount }, (_, columnIndex) => {
                      const usedByAnotherField = HEADERLESS_FIELDS.some(
                        (otherField) => otherField.key !== field.key
                          && headerlessImport.mapping[otherField.key] === columnIndex
                      );
                      return (
                        <MenuItem
                          key={columnIndex}
                          value={columnIndex}
                          disabled={usedByAnotherField}
                        >
                          {tc.importColumn} {excelColumnName(columnIndex)}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                ))}
              </Box>
            </Alert>
          )}

          {importRows && importRows.length > 0 && (
            <>
              <Box display="flex" alignItems="center" gap={2} mb={1} flexWrap="wrap">
                <Typography variant="subtitle2" fontWeight={600}>{tc.importPreviewTitle}</Typography>
                <Chip label={tc.importPreviewCount(importRows.length)} size="small" color="primary" variant="outlined" />
                {errorCount > 0 && (
                  <Chip label={tc.importErrorCount(errorCount)} size="small" color="error" variant="outlined" />
                )}
                {duplicateCount > 0 && (
                  <Chip label={tc.importDuplicateCount(duplicateCount)} size="small" color="warning" variant="outlined" />
                )}
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600, minWidth: 40 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.name}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.vatNumber}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.taxCode}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.address}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.pec}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.contactPerson}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.email}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.phone}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.notes}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.importColError}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importRows.map((row) => (
                      <TableRow
                        key={row.rowIndex}
                        sx={
                          row.error === 'duplicateVat'
                            ? { bgcolor: 'warning.50', '& td': { color: 'warning.dark' } }
                            : row.error
                            ? { bgcolor: 'error.50', '& td': { color: 'error.main' } }
                            : undefined
                        }
                      >
                        <TableCell>{row.rowIndex}</TableCell>
                        <TableCell>{row.name || '—'}</TableCell>
                        <TableCell>{row.vatNumber || '—'}</TableCell>
                        <TableCell>{row.taxCode || '—'}</TableCell>
                        <TableCell>{row.address || '—'}</TableCell>
                        <TableCell>{row.pec || '—'}</TableCell>
                        <TableCell>{row.contactPerson || '—'}</TableCell>
                        <TableCell>{row.email || '—'}</TableCell>
                        <TableCell>{row.phone || '—'}</TableCell>
                        <TableCell>{row.notes || '—'}</TableCell>
                        <TableCell>
                          {row.error === 'missingName' && tc.importRowErrorMissingName}
                          {row.error === 'missingVat' && tc.importRowErrorMissingVat}
                          {row.error === 'duplicateVat' && tc.importRowErrorDuplicateVat}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {importing && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setImportOpen(false); setImportRows(null); setHeaderlessImport(null); setImportFileName(''); setImportParseError(''); }}>
            {tc.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleImportConfirm}
            disabled={!importRows || validCount === 0 || importing}
          >
            {importing ? tc.importImporting : `${tc.importConfirm}${validCount > 0 ? ` (${validCount})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
