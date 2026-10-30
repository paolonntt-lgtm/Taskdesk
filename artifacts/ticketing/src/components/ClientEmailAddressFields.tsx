import { Add, DeleteOutline } from '@mui/icons-material';
import { Alert, Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import type { ClientEmailAddressAssociation } from '@workspace/api-client-react';

export function parseClientEmailAddresses(value: string | null | undefined): string[] {
  return value ? [...new Set(value.split(/[;,\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))] : [];
}

function emailAddressEntriesOverlap(left: string, right: string): boolean {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  const leftWildcard = /^\*@([^@]+)$/.exec(normalizedLeft);
  const rightWildcard = /^\*@([^@]+)$/.exec(normalizedRight);
  if (leftWildcard && rightWildcard) return leftWildcard[1] === rightWildcard[1];
  if (leftWildcard) return normalizedRight.endsWith(`@${leftWildcard[1]}`);
  if (rightWildcard) return normalizedLeft.endsWith(`@${rightWildcard[1]}`);
  return false;
}

export function getClientEmailAddressConflicts(
  addresses: string[],
  associations: ClientEmailAddressAssociation[],
  clientId?: number,
): ClientEmailAddressAssociation[] {
  return associations.filter((association) =>
    addresses.some((address) => emailAddressEntriesOverlap(address, association.address))
      && association.clientId !== clientId,
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
  sharedLabel: string;
  wildcardHint: string;
  wildcardExample: string;
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
  sharedLabel,
  wildcardHint,
  wildcardExample,
}: ClientEmailAddressFieldsProps) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2">{emailLabel}</Typography>
      {addresses.map((address, index) => {
        const normalized = address.trim().toLowerCase();
        const matches = normalized
          ? associations.filter((association) => emailAddressEntriesOverlap(association.address, normalized))
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
                type="text"
                inputProps={{ inputMode: 'email' }}
                label={`${emailLabel} ${index + 1}`}
                placeholder={wildcardExample}
                helperText={wildcardHint}
                value={address}
                onChange={(event) => onChange(addresses.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                data-testid={`input-client-email-${index}`}
              />
              <IconButton
                aria-label={removeLabel}
                onClick={() => onChange(addresses.filter((_, itemIndex) => itemIndex !== index))}
                size="small"
                data-testid={`button-remove-client-email-${index}`}
              >
                <DeleteOutline />
              </IconButton>
            </Stack>
            {conflicts.length > 0 ? (
              <Alert severity="info" sx={{ mt: 0.75 }}>
                {sharedLabel} {[...new Set(conflicts.map((item) => item.clientName))].join(', ')}
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
        data-testid="button-add-client-email"
      >
        {addLabel}
      </Button>
    </Stack>
  );
}
