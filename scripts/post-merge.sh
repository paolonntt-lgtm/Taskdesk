#!/bin/bash
set -e

pnpm install --frozen-lockfile

# Database schema changes must be reviewed and applied separately.
# A forced Drizzle push can apply unrelated destructive changes because
# the development database has documented schema drift.
