export const EXPIRING_SOON_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;

export type ConnectionDisplayStatus = 'Active' | 'Expired' | 'Expiring Soon' | 'Revoked';

type ExpiringRecord = {
  revokedAt: Date | null;
  expiresAt: Date;
};

export function isConnectionExpired(record: ExpiringRecord, now: number) {
  return !record.revokedAt && record.expiresAt.getTime() <= now;
}

export function isConnectionExpiringSoon(record: ExpiringRecord, now: number) {
  if (record.revokedAt) return false;

  const msRemaining = record.expiresAt.getTime() - now;
  return msRemaining > 0 && msRemaining <= EXPIRING_SOON_WINDOW_MS;
}

export function getConnectionDisplayStatus(
  record: ExpiringRecord,
  now: number,
): ConnectionDisplayStatus {
  if (record.revokedAt) return 'Revoked';
  if (isConnectionExpired(record, now)) return 'Expired';
  if (isConnectionExpiringSoon(record, now)) return 'Expiring Soon';
  return 'Active';
}

export function formatConnectionTimeRemaining(msRemaining: number) {
  if (msRemaining <= 0) return 'Expired';

  const totalMinutes = Math.floor(msRemaining / (60 * 1000));
  if (totalMinutes < 1) return '<1m';

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}
