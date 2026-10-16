export function canUseBillingDuringExpiredTrial(path: string, role: string): boolean {
  if (role !== 'admin') return false;
  const pathname = path.split('?')[0];
  return pathname.startsWith('/api/stripe/') || pathname.startsWith('/stripe/');
}
