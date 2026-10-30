import { describe, expect, it } from 'vitest';
import { getEmailClientAssociationExplanationKey } from './emailClientAssociationDisplay';

describe('email client association explanation', () => {
  it('distinguishes an external forwarding sender from the original sender', () => {
    expect(getEmailClientAssociationExplanationKey({
      reason: 'profile_contact',
      source: 'external_sender',
      forwarded: true,
    })).toBe('emailClientAssociationForwardingContact');
    expect(getEmailClientAssociationExplanationKey({
      reason: 'original_sender',
      source: 'original_sender',
      forwarded: true,
    })).toBe('emailClientAssociationOriginalSender');
  });

  it('explains each recorded match method without using sender addresses', () => {
    const keys = [
      getEmailClientAssociationExplanationKey({ reason: 'profile_contact', forwarded: false }),
      getEmailClientAssociationExplanationKey({ reason: 'sender_rule' }),
      getEmailClientAssociationExplanationKey({ reason: 'domain_rule' }),
    ];

    expect(keys).toEqual([
      'emailClientAssociationProfileContact',
      'emailClientAssociationSenderRule',
      'emailClientAssociationDomainRule',
    ]);
    expect(keys.join(' ')).not.toMatch(/@|\.[a-z]{2,}/i);
  });

  it('labels no match, conflicts, and older tickets clearly', () => {
    expect(getEmailClientAssociationExplanationKey({
      reason: 'no_match',
      forwarded: true,
    })).toBe('emailClientAssociationNoMatchForwarded');
    expect(getEmailClientAssociationExplanationKey({
      reason: 'conflict',
      source: 'original_sender',
    })).toBe('emailClientAssociationConflictOriginal');
    expect(getEmailClientAssociationExplanationKey({
      hasCurrentConflict: true,
    })).toBe('emailClientAssociationConflictExternal');
    expect(getEmailClientAssociationExplanationKey({
      reason: 'no_match',
      hasCurrentConflict: true,
    })).toBe('emailClientAssociationConflictExternal');
    expect(getEmailClientAssociationExplanationKey({})).toBe('emailClientAssociationReasonUnavailable');
  });
});
