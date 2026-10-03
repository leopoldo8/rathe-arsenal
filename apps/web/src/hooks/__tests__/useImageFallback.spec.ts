import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageFallback } from '../useImageFallback';

describe('useImageFallback', () => {
  it('starts on the first source', () => {
    const { result } = renderHook(() => useImageFallback(['a', 'b']));
    expect(result.current.src).toBe('a');
    expect(result.current.exhausted).toBe(false);
  });

  it('advances one source per error and exhausts after the last', () => {
    const { result } = renderHook(() => useImageFallback(['a', 'b']));
    act(() => result.current.onError());
    expect(result.current.src).toBe('b');
    expect(result.current.exhausted).toBe(false);
    act(() => result.current.onError());
    expect(result.current.src).toBeNull();
    expect(result.current.exhausted).toBe(true);
  });

  it('is exhausted from the first render for an empty list', () => {
    const { result } = renderHook(() => useImageFallback([]));
    expect(result.current.src).toBeNull();
    expect(result.current.exhausted).toBe(true);
  });

  it('keeps its position when rerendered with a new array of the same urls', () => {
    const { result, rerender } = renderHook(
      ({ sources }) => useImageFallback(sources),
      { initialProps: { sources: ['a', 'b', 'c'] } },
    );
    act(() => result.current.onError());
    rerender({ sources: ['a', 'b', 'c'] });
    expect(result.current.src).toBe('b');
  });

  it('resets to the first source when the urls change', () => {
    const { result, rerender } = renderHook(
      ({ sources }) => useImageFallback(sources),
      { initialProps: { sources: ['a', 'b'] } },
    );
    act(() => result.current.onError());
    act(() => result.current.onError());
    expect(result.current.exhausted).toBe(true);
    rerender({ sources: ['x', 'y'] });
    expect(result.current.src).toBe('x');
    expect(result.current.exhausted).toBe(false);
  });

  it('counts errors from the first source after a reset', () => {
    const { result, rerender } = renderHook(
      ({ sources }) => useImageFallback(sources),
      { initialProps: { sources: ['a', 'b'] } },
    );
    act(() => result.current.onError());
    rerender({ sources: ['x', 'y'] });
    act(() => result.current.onError());
    expect(result.current.src).toBe('y');
  });
});
