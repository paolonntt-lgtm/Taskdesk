import React from 'react';
import { Link } from 'wouter';
import { Typography, type TypographyProps } from '@mui/material';

interface UserLinkProps {
  userId: number | null | undefined;
  name: string | null | undefined;
  typographyProps?: TypographyProps;
}

export function UserLink({ userId, name, typographyProps }: UserLinkProps) {
  if (!userId || !name) return <span>{name ?? '—'}</span>;

  return (
    <Link href={`/users/${userId}`}>
      <Typography
        component="span"
        {...typographyProps}
        sx={{
          cursor: 'pointer',
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          ...typographyProps?.sx,
        }}
      >
        {name}
      </Typography>
    </Link>
  );
}
