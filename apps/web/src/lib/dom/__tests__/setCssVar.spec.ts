import { describe, it, expect, beforeEach } from 'vitest';
import { setCssVar } from '../setCssVar';

describe('setCssVar', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('sets a CSS custom property', () => {
    setCssVar(el, '--foo', '1.5');
    expect(el.style.getPropertyValue('--foo')).toBe('1.5');
  });

  it('converts a number value to string', () => {
    setCssVar(el, '--foo', 1.5);
    expect(el.style.getPropertyValue('--foo')).toBe('1.5');
  });

  it('overwrites an existing value', () => {
    el.style.setProperty('--foo', 'old');
    setCssVar(el, '--foo', 'new');
    expect(el.style.getPropertyValue('--foo')).toBe('new');
  });

  it('removes the property when value is null', () => {
    el.style.setProperty('--foo', '42');
    setCssVar(el, '--foo', null);
    expect(el.style.getPropertyValue('--foo')).toBe('');
  });

  it('is a no-op when element is null', () => {
    expect(() => setCssVar(null, '--foo', 'value')).not.toThrow();
  });

  it('preserves numeric zero — not falsy-coerced', () => {
    setCssVar(el, '--foo', 0);
    expect(el.style.getPropertyValue('--foo')).toBe('0');
  });
});
