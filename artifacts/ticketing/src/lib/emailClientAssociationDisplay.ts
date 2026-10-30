export type EmailClientAssociationExplanationKey =
  | 'emailClientAssociationProfileContact'
  | 'emailClientAssociationForwardingContact'
  | 'emailClientAssociationOriginalSender'
  | 'emailClientAssociationSenderRule'
  | 'emailClientAssociationDomainRule'
  | 'emailClientAssociationNoMatch'
  | 'emailClientAssociationNoMatchForwarded'
  | 'emailClientAssociationConflictExternal'
  | 'emailClientAssociationConflictOriginal'
  | 'emailClientAssociationReasonUnavailable';

export function getEmailClientAssociationExplanationKey(input: {
  reason?: string | null;
  source?: string | null;
  forwarded?: boolean | null;
  hasCurrentConflict?: boolean;
}): EmailClientAssociationExplanationKey {
  const { reason, source, forwarded, hasCurrentConflict } = input;
  if (reason === 'profile_contact') {
    if (source === 'original_sender') return 'emailClientAssociationOriginalSender';
    return forwarded
      ? 'emailClientAssociationForwardingContact'
      : 'emailClientAssociationProfileContact';
  }
  if (reason === 'original_sender') return 'emailClientAssociationOriginalSender';
  if (reason === 'sender_rule') return 'emailClientAssociationSenderRule';
  if (reason === 'domain_rule') return 'emailClientAssociationDomainRule';
  if (reason === 'no_match') {
    return forwarded
      ? 'emailClientAssociationNoMatchForwarded'
      : 'emailClientAssociationNoMatch';
  }
  if (reason === 'conflict' || hasCurrentConflict) {
    return source === 'original_sender'
      ? 'emailClientAssociationConflictOriginal'
      : 'emailClientAssociationConflictExternal';
  }
  return 'emailClientAssociationReasonUnavailable';
}
