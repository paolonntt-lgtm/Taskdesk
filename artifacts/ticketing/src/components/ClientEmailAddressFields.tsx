import { Add, DeleteOutline } from '@mui/icons-material';
import { Alert, Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import type { ClientEmailAddressAssociation } from '@workspace/api-client-react';

export function parseClientEmailAddresses(value: string | null | undefined): string[] {
  return value ? [...new Set(value.split(/[;,\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))] : [];
}

export function getClientEmailAddressConflicts(
  addresses: string[],
  associations: ClientEmailAddressAssociation[],
  clientId?: number,
): ClientEmailAddressAssociation[] {
  const normalized = new Set(addresses.map((address) => address.trim().toLowerCase()).filter(Boolean));
  return associations.filter((association) =>
    normalized.has(association.address.toLowerCase()) && association.clientId !== clientId,
  );
}

interface ClientEmailAddressFieldsProps {
  addresses: string[];
  onChange: (addresses: string[]) => void;
  associations: ClientEmailAddressAssociation[];
  clientId?: number;
  emailLabel: string;
  addLabel: string;
  removeLabel: string;
  matchedLabel: string;
  profileSourceLabel: string;
  ruleSourceLabel: string;
  unmatchedLabel: string;
  conflictLabel: string;
}

export default function ClientEmailAddressFields({
  addresses,
  onChange,
  associations,
  clientId,
  emailLabel,
  addLabel,
  removeLabel,
  matchedLabel,
  profileSourceLabel,
  ruleSourceLabel,
  unmatchedLabel,
  conflictLabel,
}: ClientEmailAddressFieldsProps) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2">{emailLabel}</Typography>
      {addresses.map((address, index) => {
        const normalized = address.trim().toLowerCase();
        const matches = normalized
          ? associations.filter((association) => association.address.toLowerCase() === normalized)
          : [];
        const conflicts = matches.filter((association) => association.clientId !== clientId);
        const ownSources = new Set(matches
          .filter((association) => association.clientId === clientId)
          .flatMap((association) => association.sources));
        return (
          <Box key={index}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                type="email"
                label={`${emailLabel} ${index + 1}`}
                value={address}
                onChange={(event) => onChange(addresses.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
              />
              <IconButton
                aria-label={removeLabel}
                onClick={() => onChange(addresses.filter((_, itemIndex) => itemIndex !== index))}
                size="small"
              >
                <DeleteOutline />
              </IconButton>
            </Stack>
            {conflicts.length > 0 ? (
              <Alert severity="error" sx={{ mt: 0.75 }}>
                {conflictLabel} {conflicts.map((item) => item.clientName).join(', ')}
              </Alert>
            ) : normalized && ownSources.size > 0 ? (
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                <Chip size="small" color="success" label={matchedLabel} />
                {ownSources.has('profile') && <Chip size="small" variant="outlined" label={profileSourceLabel} />}
                {ownSources.has('sender_rule') && <Chip size="small" variant="outlined" label={ruleSourceLabel} />}
              </Stack>
            ) : normalized ? (
              <Chip size="small" sx={{ mt: 0.75 }} variant="outlined" label={unmatchedLabel} />
            ) : null}
          </Box>
        );
      })}
      <Button
        startIcon={<Add />}
        size="small"
        variant="outlined"
        onClick={() => onChange([...addresses, ''])}
        sx={{ alignSelf: 'flex-start' }}
      >
        {addLabel}
      </Button>
    </Stack>
  );
}
