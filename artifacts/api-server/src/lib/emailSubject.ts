const SUBJECT_PREFIXES = /^(re|fwd|fw|aw|sv|vs|r|rif|ant)[\s:]+/gi;
const REPLY_SUBJECT_PREFIX = /^(re|aw|sv|vs|r|rif|ant)[\s:]+/i;

/** Normalizes prefixes for matching a reply to an existing ticket. */
export function normaliseEmailSubject(subject: string): string {
  return subject.replace(SUBJECT_PREFIXES, "").trim().toLowerCase();
}

/** Forward prefixes identify a new forwarded message, not a reply by themselves. */
export function hasReplySubjectPrefix(subject: string): boolean {
  return REPLY_SUBJECT_PREFIX.test(subject.trim());
}
