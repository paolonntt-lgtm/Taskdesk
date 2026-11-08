import React, { useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, MenuItem,
  DialogActions, Alert, InputAdornment, Tooltip, Snackbar, Chip,
  LinearProgress, Divider, Checkbox, FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, Search, OpenInNew, Upload, FileUpload } from '@mui/icons-material';
import {
  useListClients,
  useListClientEmailAssociations,
  useListLegacyEmailRules,
  useReviewLegacyEmailRule,
  useDeleteLegacyEmailRule,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getGetClientQueryKey,
  getListClientsQueryKey,
  getListClientEmailAssociationsQueryKey,
  getListLegacyEmailRulesQueryKey,
} from '@workspace/api-client-react';
import type { Client, ClientInput, LegacyEmailRule } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { readSheet } from 'read-excel-file/browser';
import { invalidateTicketDataAfterClientRename } from '../lib/clientNameCache';
import ClientEmailAddressFields, { getClientEmailAddressConflicts, parseClientEmailAddresses } from '../components/ClientEmailAddressFields';
import {
  createDefaultHeaderlessMapping,
  getHeaderlessFields,
  mapHeaderlessRows,
  parseCsvText,
  parseTabularRows,
  validateImportRows,
  type HeaderlessMapping,
  type ImportCell,
  type ImportFieldKey,
  type ParsedRow,
} from '../lib/clientImport';

const emptyForm: ClientInput = {
  name: '',
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  membershipNumber: null,
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

function splitClientName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts.shift() ?? '', lastName: parts.join(' ') };
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

function parseXml(file: File, isGym: boolean): Promise<ParsedRow[]> {
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

        const rows: ParsedRow[] = items.map((el, i) => {
          const firstName = isGym ? get(el, 'Nome', 'FirstName', 'firstName', 'nome') : '';
          const lastName = isGym ? get(el, 'Cognome', 'LastName', 'lastName', 'cognome') : '';
          return {
            rowIndex: i + 1,
            name: isGym
              ? [firstName, lastName].filter(Boolean).join(' ')
              : get(el, 'Denominazione', 'Nome', 'Name', 'nome', 'name'),
            firstName,
            lastName,
            vatNumber: get(el, 'PartitaIVA', 'Partita_IVA', 'vatNumber', 'PIva', 'PIVA'),
            taxCode: get(el, 'CodiceFiscale', 'Codice_Fiscale', 'taxCode', 'CF'),
            dateOfBirth: get(el, 'DataDiNascita', 'Data_Nascita', 'dateOfBirth', 'birthDate'),
            membershipNumber: get(el, 'NumeroTessera', 'MembershipNumber', 'membershipNumber', 'tessera'),
            address: get(el, 'Indirizzo', 'Address', 'indirizzo', 'address'),
            pec: get(el, 'IndirizzoP_EC', 'PEC', 'pec'),
            contactPerson: get(el, 'Referente', 'contactPerson', 'referente'),
            email: get(el, 'IndirizzoEmail', 'Email', 'email', 'Mail', 'mail'),
            phone: get(el, 'Telefono', 'Phone', 'telefono', 'phone', 'Tel', 'Cellulare', 'Mobile'),
            notes: get(el, 'Note', 'notes', 'note'),
          };
        });
        resolve(rows);
      } catch {
        reject(new Error('parse_error'));
      }
    };
    reader.onerror = () => reject(new Error('read_error'));
    reader.readAsText(file);
  });
}

export default function Clients() {
  const { t, lang } = useLanguage();
  const tc = t.clients;
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isGym = (user as any)?.profession === 'palestre';
  const importHeaderlessFields = getHeaderlessFields(isGym);
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
  const { data: emailAssociations = [] } = useListClientEmailAssociations();
  const legacyEmailRulesQuery = useListLegacyEmailRules({
    query: { queryKey: getListLegacyEmailRulesQueryKey(), enabled: isAdmin },
  });
  const reviewLegacyEmailRule = useReviewLegacyEmailRule();
  const deleteLegacyEmailRule = useDeleteLegacyEmailRule();

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [emailAddresses, setEmailAddresses] = useState<string[]>(['']);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const pecConflicts = getClientEmailAddressConflicts(
    parseClientEmailAddresses(form.pec).filter((address) => !address.startsWith('*@')),
    emailAssociations,
    editingClient?.id,
  );

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
  const [keepEmailAssociationByAddress, setKeepEmailAssociationByAddress] = useState<Record<string, number>>({});
  const [resolvingEmailAssociation, setResolvingEmailAssociation] = useState<string | null>(null);
  const [legacyRuleToDelete, setLegacyRuleToDelete] = useState<LegacyEmailRule | null>(null);
  const [legacyRuleAction, setLegacyRuleAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conflictingEmailGroups = (() => {
    const groups = new Map<string, typeof emailAssociations>();
    for (const association of emailAssociations) {
      const key = association.address.toLowerCase();
      const group = groups.get(key) ?? [];
      if (!group.some((item) => item.clientId === association.clientId)) {
        group.push(association);
      }
      groups.set(key, group);
    }
    return [...groups.values()]
      .filter((group) => group.length > 1)
      .sort((a, b) => a[0].address.localeCompare(b[0].address));
  })();

  const openCreate = useCallback(() => {
    setEditingClient(null);
    setForm(emptyForm);
    setEmailAddresses(['']);
    setFormError('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((client: Client) => {
    setEditingClient(client);
    const legacyName = splitClientName(client.name);
    setForm({
      name: client.name,
      firstName: client.firstName ?? legacyName.firstName,
      lastName: client.lastName ?? legacyName.lastName,
      dateOfBirth: client.dateOfBirth ?? null,
      membershipNumber: client.membershipNumber ?? null,
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
    setEmailAddresses(parseClientEmailAddresses(client.email));
    setFormError('');
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    const firstName = form.firstName?.trim() ?? '';
    const lastName = form.lastName?.trim() ?? '';
    if (isGym ? (!firstName || !lastName) : !form.name?.trim()) {
      setFormError(tc.errorRequired);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: isGym ? `${firstName} ${lastName}` : form.name.trim(),
        firstName: isGym ? firstName : (form.firstName?.trim() || null),
        lastName: isGym ? lastName : (form.lastName?.trim() || null),
        dateOfBirth: form.dateOfBirth || null,
        membershipNumber: form.membershipNumber?.trim() || null,
        alias: (form as any).alias?.trim() || null,
        email: emailAddresses.map((address) => address.trim()).filter(Boolean).join('; ') || null,
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
        await qc.invalidateQueries({ queryKey: getListClientEmailAssociationsQueryKey() });
        if (editingClient.name !== payload.name) {
          await invalidateTicketDataAfterClientRename(qc);
        }
      } else {
        await createClient.mutateAsync({ data: payload });
        await qc.invalidateQueries({ queryKey: getListClientEmailAssociationsQueryKey() });
      }
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setDialogOpen(false);
    } catch (err: any) {
      const conflicts = err?.data?.conflicts ?? err?.response?.data?.conflicts;
      const errorMessage = err?.data?.error ?? err?.response?.data?.error;
      if (Array.isArray(conflicts) && conflicts.length > 0) {
        setFormError(`${tc.emailAddressConflict} ${conflicts.map((item: any) => item.clientName).join(', ')}`);
      } else if (errorMessage === 'Duplicate VAT number' || err?.response?.status === 409 || err?.status === 409) {
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

  const handleResolveEmailAssociation = async (
    address: string,
    keepClientId: number,
    removeClientId: number,
  ) => {
    const actionKey = `${address.toLowerCase()}:${removeClientId}`;
    setResolvingEmailAssociation(actionKey);
    try {
      const response = await fetch('/api/clients/email-address-associations/resolve', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, keepClientId, removeClientId }),
      });
      if (!response.ok) throw new Error('resolve_failed');
      void qc.invalidateQueries({ queryKey: getListClientEmailAssociationsQueryKey() });
      void qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setSnackbar({ open: true, msg: tc.emailAssociationResolved, severity: 'success' });
    } catch {
      setSnackbar({ open: true, msg: tc.emailAssociationResolveError, severity: 'error' });
    } finally {
      setResolvingEmailAssociation(null);
    }
  };

  const handleKeepLegacyRule = async (rule: LegacyEmailRule) => {
    const actionKey = `${rule.ruleType}:${rule.id}`;
    setLegacyRuleAction(actionKey);
    try {
      await reviewLegacyEmailRule.mutateAsync({ ruleType: rule.ruleType, id: rule.id });
      await qc.invalidateQueries({ queryKey: getListLegacyEmailRulesQueryKey() });
      setSnackbar({ open: true, msg: tc.legacyEmailRuleKept, severity: 'success' });
    } catch {
      setSnackbar({ open: true, msg: tc.legacyEmailRuleActionError, severity: 'error' });
    } finally {
      setLegacyRuleAction(null);
    }
  };

  const handleRemoveLegacyRule = async () => {
    if (!legacyRuleToDelete) return;
    const rule = legacyRuleToDelete;
    const actionKey = `${rule.ruleType}:${rule.id}`;
    setLegacyRuleAction(actionKey);
    try {
      await deleteLegacyEmailRule.mutateAsync({ ruleType: rule.ruleType, id: rule.id });
      await qc.invalidateQueries({ queryKey: getListLegacyEmailRulesQueryKey() });
      setLegacyRuleToDelete(null);
      setSnackbar({ open: true, msg: tc.legacyEmailRuleRemoved, severity: 'success' });
    } catch {
      setSnackbar({ open: true, msg: tc.legacyEmailRuleActionError, severity: 'error' });
    } finally {
      setLegacyRuleAction(null);
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
      const extension = file.name.toLowerCase().split('.').pop();
      if (extension === 'xlsx' || (extension === 'csv' && isGym)) {
        const rawRows = extension === 'xlsx'
          ? await readSheet(file)
          : parseCsvText(await file.text());
        const parsed = parseTabularRows(rawRows as ImportCell[][], isGym);
        if (parsed.headerlessRows) {
          const columnCount = Math.max(0, ...parsed.headerlessRows.map((row) => row.length));
          const headerless = {
            rows: parsed.headerlessRows,
            columnCount,
            mapping: createDefaultHeaderlessMapping(isGym),
          };
          setHeaderlessImport(headerless);
          raw = mapHeaderlessRows(headerless.rows, headerless.mapping, isGym);
        } else {
          raw = parsed.rows;
        }
      } else if (extension === 'xml' && !isGym) {
        raw = await parseXml(file, isGym);
      } else {
        setImportParseError(tc.importErrorParse);
        return;
      }
      const existingVats = new Set(
        allClients.map((c) => ((c as any).vatNumber ?? '').toString().trim().toLowerCase()).filter(Boolean)
      );
      setImportRows(validateImportRows(raw, existingVats, isGym));
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
    setImportRows(validateImportRows(mapHeaderlessRows(next.rows, mapping, isGym), existingVats, isGym));
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
            firstName: isGym ? r.firstName : null,
            lastName: isGym ? r.lastName : null,
            vatNumber: r.vatNumber || null,
            taxCode: r.taxCode || null,
            dateOfBirth: isGym ? r.dateOfBirth || null : null,
            membershipNumber: isGym ? r.membershipNumber || null : null,
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
      qc.invalidateQueries({ queryKey: getListClientEmailAssociationsQueryKey() });
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

      {isAdmin && conflictingEmailGroups.length > 0 && (
        <Box
          component="section"
          aria-labelledby="conflicting-email-addresses-title"
          sx={{ border: 1, borderColor: 'warning.light', borderRadius: 1, p: 2, mb: 2, bgcolor: 'warning.50' }}
        >
          <Typography id="conflicting-email-addresses-title" variant="subtitle1" fontWeight={600}>
            {tc.conflictingEmailAddresses}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tc.conflictingEmailAddressesHelp}
          </Typography>
          <Box display="flex" flexDirection="column" gap={1.5}>
            {conflictingEmailGroups.map((group) => {
              const address = group[0].address;
              const addressKey = address.toLowerCase();
              const keepClientId = keepEmailAssociationByAddress[addressKey] ?? group[0].clientId;
              return (
                <Box
                  key={addressKey}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    {address}
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label={tc.keepEmailAssociationFor}
                    value={keepClientId}
                    onChange={(event) => setKeepEmailAssociationByAddress((current) => ({
                      ...current,
                      [addressKey]: Number(event.target.value),
                    }))}
                    sx={{ mb: 1 }}
                  >
                    {group.map((association) => (
                      <MenuItem key={association.clientId} value={association.clientId}>
                        {association.clientName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Box display="flex" flexDirection="column" gap={0.75}>
                    {group.map((association) => (
                      <Box
                        key={association.clientId}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                      >
                        <Typography variant="body2">
                          {association.clientName}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {association.sources.map((source) =>
                              source === 'profile' ? tc.emailFromProfile : tc.emailFromRule,
                            ).join(', ')}
                          </Typography>
                        </Typography>
                        {association.clientId !== keepClientId && (
                          <Button
                            size="small"
                            color="error"
                            disabled={resolvingEmailAssociation !== null}
                            onClick={() => void handleResolveEmailAssociation(address, keepClientId, association.clientId)}
                          >
                            {resolvingEmailAssociation === `${addressKey}:${association.clientId}`
                              ? tc.saving
                              : tc.removeEmailAssociation}
                          </Button>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {isAdmin && (
        <Box mb={3}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>{tc.legacyEmailRulesTitle}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {tc.legacyEmailRulesDescription}
          </Typography>
          {legacyEmailRulesQuery.isLoading ? (
            <LinearProgress />
          ) : legacyEmailRulesQuery.isError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void legacyEmailRulesQuery.refetch()}>
                  {tc.legacyEmailRulesRetry}
                </Button>
              }
            >
              {tc.legacyEmailRulesLoadError}
            </Alert>
          ) : legacyEmailRulesQuery.data?.length ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>{tc.legacyEmailRuleType}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{tc.legacyEmailRuleValue}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{tc.legacyEmailRuleClient}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{tc.legacyEmailRuleStatus}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">{tc.actions}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {legacyEmailRulesQuery.data.map((rule) => {
                    const actionKey = `${rule.ruleType}:${rule.id}`;
                    return (
                      <TableRow key={actionKey} hover>
                        <TableCell>
                          {rule.ruleType === 'sender' ? tc.legacyEmailSender : tc.legacyEmailDomain}
                        </TableCell>
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>{rule.value}</TableCell>
                        <TableCell>{rule.clientName ?? tc.legacyEmailUnknownClient}</TableCell>
                        <TableCell>
                          {rule.reviewedAt ? (
                            <Chip size="small" color="success" variant="outlined" label={tc.legacyEmailRuleKeptStatus} />
                          ) : (
                            <Chip size="small" color="warning" variant="outlined" label={tc.legacyEmailRulePendingStatus} />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box display="flex" justifyContent="flex-end" gap={0.5}>
                            {!rule.reviewedAt && (
                              <Button
                                size="small"
                                disabled={legacyRuleAction !== null}
                                onClick={() => void handleKeepLegacyRule(rule)}
                              >
                                {legacyRuleAction === actionKey ? tc.saving : tc.legacyEmailRuleKeep}
                              </Button>
                            )}
                            <Button
                              size="small"
                              color="error"
                              disabled={legacyRuleAction !== null}
                              onClick={() => setLegacyRuleToDelete(rule)}
                            >
                              {tc.legacyEmailRuleRemove}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">{tc.legacyEmailRulesEmpty}</Alert>
          )}
        </Box>
      )}

      <Box mb={2} display="flex" alignItems="center" gap={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder={isGym
            ? (lang === 'it' ? 'Cerca clienti o numero tessera...' : 'Search clients or membership number...')
            : tc.searchPlaceholder}
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
            {isGym ? (
              <>
                <TextField
                  label={lang === 'it' ? 'Nome' : 'First name'}
                  required
                  fullWidth
                  value={form.firstName ?? ''}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                />
                <TextField
                  label={lang === 'it' ? 'Cognome' : 'Last name'}
                  required
                  fullWidth
                  value={form.lastName ?? ''}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                />
                <TextField
                  label={lang === 'it' ? 'Data di nascita' : 'Date of birth'}
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={form.dateOfBirth ?? ''}
                  onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value || null }))}
                />
                <TextField
                  label={lang === 'it' ? 'Matricola' : 'Membership number'}
                  fullWidth
                  value={form.membershipNumber ?? ''}
                  onChange={e => setForm(f => ({ ...f, membershipNumber: e.target.value || null }))}
                />
              </>
            ) : (
              <TextField
                label={tc.name}
                required
                fullWidth
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            )}
            {!isGym && <TextField
              label={tc.alias}
              fullWidth
              value={(form as any).alias ?? ''}
              onChange={e => setForm(f => ({ ...f, alias: e.target.value || null } as any))}
              placeholder={tc.aliasPlaceholder}
              helperText={tc.aliasPlaceholder}
            />}
            {!isGym && <TextField
              label={tc.vatNumber}
              fullWidth
              value={(form as any).vatNumber ?? ''}
              onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value || null } as any))}
            />}
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
            {!isGym && <TextField
              label={tc.pec}
              fullWidth
              value={(form as any).pec ?? ''}
              onChange={e => setForm(f => ({ ...f, pec: e.target.value || null } as any))}
            />}
            {!isGym && pecConflicts.length > 0 && (
              <Alert severity="info">
                {tc.emailAddressConflict}{' '}
                {[...new Set(pecConflicts.map((item) => item.clientName))].join(', ')}
              </Alert>
            )}
            {!isGym && <TextField
              label={tc.contactPerson}
              fullWidth
              value={(form as any).contactPerson ?? ''}
              onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value || null } as any))}
            />}
              <ClientEmailAddressFields
                addresses={emailAddresses}
                onChange={setEmailAddresses}
                associations={emailAssociations}
                clientId={editingClient?.id}
                emailLabel={tc.email}
                addLabel={tc.addEmailAddress}
                removeLabel={tc.removeEmailAddress}
                matchedLabel={tc.matchedEmailAddress}
                profileSourceLabel={tc.emailFromProfile}
                ruleSourceLabel={tc.emailFromRule}
                unmatchedLabel={tc.emailNotMatched}
                sharedLabel={tc.emailAddressConflict}
              wildcardHint={tc.emailDomainWildcardHint}
              wildcardExample="*@azienda.it"
              />
            <TextField
              label={isGym ? (lang === 'it' ? 'Cellulare' : 'Mobile phone') : tc.phone}
              fullWidth
              value={form.phone ?? ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))}
            />
            {!isGym && <TextField
              label={tc.notes}
              fullWidth
              multiline
              rows={3}
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
            />}
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

      <Dialog
        open={legacyRuleToDelete !== null}
        onClose={() => legacyRuleAction === null && setLegacyRuleToDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{tc.legacyEmailRuleRemoveTitle}</DialogTitle>
        <DialogContent>
          <Typography>{tc.legacyEmailRuleRemovePrompt}</Typography>
          {legacyRuleToDelete && (
            <Typography variant="body2" fontWeight={600} sx={{ mt: 1, overflowWrap: 'anywhere' }}>
              {legacyRuleToDelete.value}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLegacyRuleToDelete(null)} disabled={legacyRuleAction !== null}>
            {tc.cancel}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleRemoveLegacyRule()}
            disabled={legacyRuleAction !== null}
          >
            {legacyRuleAction !== null ? tc.saving : tc.legacyEmailRuleRemove}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => { setImportOpen(false); setImportRows(null); setHeaderlessImport(null); setImportFileName(''); setImportParseError(''); }} maxWidth="md" fullWidth>
        <DialogTitle>{tc.importDialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {isGym ? tc.importGymDialogSubtitle : tc.importDialogSubtitle}
          </Typography>
          <Box mb={2} display="flex" flexDirection="column" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {isGym ? tc.importGymTemplateHint : tc.importTemplateHint}
            </Typography>
            {!isGym && <Typography variant="caption" color="text.secondary">{tc.importXmlHint}</Typography>}
          </Box>

          <input
            type="file"
            accept={isGym ? '.csv,.xlsx' : '.xlsx,.xml'}
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
            {importFileName ? tc.importChangeFile : isGym ? tc.importGymSelectFile : tc.importSelectFile}
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
                {importHeaderlessFields.map((field) => (
                  <TextField
                    key={field.key}
                    select
                    size="small"
                    label={`${tc[field.labelKey]}${field.required ? ' *' : ''}`}
                    value={headerlessImport.mapping[field.key] ?? ''}
                    onChange={(event) => handleHeaderlessMappingChange(field.key, event.target.value)}
                  >
                    <MenuItem value="">{tc.importSkipColumn}</MenuItem>
                    {Array.from({ length: headerlessImport.columnCount }, (_, columnIndex) => {
                      const usedByAnotherField = importHeaderlessFields.some(
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
                      {isGym ? (
                        <>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.firstName}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.lastName}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.name}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.vatNumber}</TableCell>
                        </>
                      )}
                      <TableCell sx={{ fontWeight: 600 }}>{tc.taxCode}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.address}</TableCell>
                      {isGym ? (
                        <>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.dateOfBirth}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.membershipNumber}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.pec}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{tc.contactPerson}</TableCell>
                        </>
                      )}
                      <TableCell sx={{ fontWeight: 600 }}>{tc.email}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tc.phone}</TableCell>
                      {!isGym && <TableCell sx={{ fontWeight: 600 }}>{tc.notes}</TableCell>}
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
                        {isGym ? (
                          <>
                            <TableCell>{row.firstName || '—'}</TableCell>
                            <TableCell>{row.lastName || '—'}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{row.name || '—'}</TableCell>
                            <TableCell>{row.vatNumber || '—'}</TableCell>
                          </>
                        )}
                        <TableCell>{row.taxCode || '—'}</TableCell>
                        <TableCell>{row.address || '—'}</TableCell>
                        {isGym ? (
                          <>
                            <TableCell>{row.dateOfBirth || '—'}</TableCell>
                            <TableCell>{row.membershipNumber || '—'}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{row.pec || '—'}</TableCell>
                            <TableCell>{row.contactPerson || '—'}</TableCell>
                          </>
                        )}
                        <TableCell>{row.email || '—'}</TableCell>
                        <TableCell>{row.phone || '—'}</TableCell>
                        {!isGym && <TableCell>{row.notes || '—'}</TableCell>}
                        <TableCell>
                          {row.error === 'missingName' && tc.importRowErrorMissingName}
                          {row.error === 'missingVat' && tc.importRowErrorMissingVat}
                          {row.error === 'duplicateVat' && tc.importRowErrorDuplicateVat}
                          {row.error === 'missingMemberName' && tc.importRowErrorMissingMemberName}
                          {row.error === 'invalidDateOfBirth' && tc.importRowErrorInvalidDateOfBirth}
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
