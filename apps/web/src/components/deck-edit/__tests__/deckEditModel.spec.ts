import { describe, it, expect } from 'vitest';
import {
  NOTES_MAX_LENGTH,
  NAME_MAX_LENGTH,
  buildPatchBody,
  countChanges,
  isNameValid,
  resolveDeckTags,
  type IDeckEditFields,
} from '../deckEditModel';

const BASE: IDeckEditFields = {
  name: 'Rhinar Aggro',
  format: 'Classic Constructed',
  status: 'building',
  notes: '',
};

describe('buildPatchBody', () => {
  it('is empty when nothing changed', () => {
    expect(buildPatchBody(BASE, { ...BASE })).toEqual({});
  });

  it('sends only the name when only the name changed, trimmed', () => {
    expect(buildPatchBody(BASE, { ...BASE, name: '  Rhinar Control  ' })).toEqual({
      name: 'Rhinar Control',
    });
  });

  it('sends only the format when only the format changed', () => {
    expect(buildPatchBody(BASE, { ...BASE, format: 'Blitz' })).toEqual({ format: 'Blitz' });
  });

  it.each(['idea', 'building', 'ready', 'active', 'retired'] as const)(
    'sends status %s when it differs from the saved one',
    (status) => {
      const initial = { ...BASE, status: status === 'idea' ? 'active' : 'idea' } as const;
      expect(buildPatchBody(initial, { ...initial, status })).toEqual({ status });
    },
  );

  it('sends the notes text when it changed', () => {
    expect(buildPatchBody(BASE, { ...BASE, notes: 'Liga sexta' })).toEqual({ notes: 'Liga sexta' });
  });

  it('sends null when saved notes are cleared', () => {
    expect(buildPatchBody({ ...BASE, notes: 'Liga sexta' }, { ...BASE, notes: '' })).toEqual({
      notes: null,
    });
  });

  it('sends null when notes become whitespace only', () => {
    expect(buildPatchBody({ ...BASE, notes: 'x' }, { ...BASE, notes: '  \n ' })).toEqual({
      notes: null,
    });
  });

  it('does not send notes when empty notes are replaced by whitespace', () => {
    expect(buildPatchBody(BASE, { ...BASE, notes: '   ' })).toEqual({});
  });

  it('sends every changed field together', () => {
    expect(
      buildPatchBody(BASE, { name: 'New', format: 'Blitz', status: 'active', notes: 'n' }),
    ).toEqual({ name: 'New', format: 'Blitz', status: 'active', notes: 'n' });
  });
});

describe('countChanges', () => {
  it('counts zero for identical fields', () => {
    expect(countChanges(BASE, { ...BASE })).toBe(0);
  });

  it('counts one per changed field', () => {
    expect(countChanges(BASE, { ...BASE, name: 'A' })).toBe(1);
    expect(countChanges(BASE, { ...BASE, name: 'A', notes: 'n' })).toBe(2);
    expect(countChanges(BASE, { name: 'A', format: 'Blitz', status: 'idea', notes: 'n' })).toBe(4);
  });

  it('ignores whitespace-only differences in the name and notes', () => {
    expect(countChanges(BASE, { ...BASE, name: 'Rhinar Aggro  ', notes: '  ' })).toBe(0);
  });
});

describe('isNameValid', () => {
  it('rejects empty and whitespace names', () => {
    expect(isNameValid('')).toBe(false);
    expect(isNameValid('   ')).toBe(false);
  });

  it('accepts a name at the 120 character cap and rejects one over it', () => {
    expect(isNameValid('a'.repeat(NAME_MAX_LENGTH))).toBe(true);
    expect(isNameValid('a'.repeat(NAME_MAX_LENGTH + 1))).toBe(false);
  });

  it('pins the caps to the API limits', () => {
    expect(NAME_MAX_LENGTH).toBe(120);
    expect(NOTES_MAX_LENGTH).toBe(2000);
  });
});

describe('resolveDeckTags', () => {
  const ALL = [
    { id: 7, name: 'liga local', createdAt: '' },
    { id: 9, name: 'torneio', createdAt: '' },
  ];

  it('maps deck tag names to the real tag ids, keeping the deck order', () => {
    expect(resolveDeckTags(['torneio', 'liga local'], ALL).map((t) => t.id)).toEqual([9, 7]);
  });

  it('drops names the tag list does not know yet', () => {
    expect(resolveDeckTags(['liga local', 'desconhecida'], ALL).map((t) => t.id)).toEqual([7]);
  });

  it('returns nothing while the tag list is empty', () => {
    expect(resolveDeckTags(['liga local'], [])).toEqual([]);
  });
});
