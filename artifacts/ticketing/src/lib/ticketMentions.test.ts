import { describe, expect, it } from 'vitest';
import { resolveMentionUser } from './ticketMentions';

describe('resolveMentionUser', () => {
  const users = [
    { id: 12, name: 'Alex Rossi' },
    { id: 13, name: 'Jordan Lee' },
  ];

  it('resolves a unique name despite casing and extra whitespace', () => {
    expect(resolveMentionUser('  alex   rossi ', users)).toEqual(users[0]);
  });

  it('does not resolve a missing or blank name', () => {
    expect(resolveMentionUser('Unknown Person', users)).toBeUndefined();
    expect(resolveMentionUser('   ', users)).toBeUndefined();
  });

  it('does not resolve a name shared by multiple collaborators', () => {
    expect(resolveMentionUser('Alex Rossi', [
      ...users,
      { id: 14, name: 'alex rossi' },
    ])).toBeUndefined();
  });
});
