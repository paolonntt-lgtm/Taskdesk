#!/bin/bash
set -e
pnpm install --frozen-lockfile
yes no | pnpm --filter db push || pnpm --filter db push --force
