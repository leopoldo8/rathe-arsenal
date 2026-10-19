import { ParseInt32IdPipe } from '../parse-int32-id.pipe';

describe('ParseInt32IdPipe', () => {
  const pipe = new ParseInt32IdPipe();

  it('parses an id inside the int4 range', () => {
    expect(pipe.transform('42')).toBe(42);
    expect(pipe.transform('2147483647')).toBe(2147483647);
  });

  it('rejects a non-integer with 400', () => {
    expect(() => pipe.transform('abc')).toThrow('Id must be an integer');
    expect(() => pipe.transform('1.5')).toThrow('Id must be an integer');
  });

  it('answers CARD_LIST_NOT_FOUND for zero and for ids past the int4 range', () => {
    expect(() => pipe.transform('0')).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'CARD_LIST_NOT_FOUND' }) }));
    expect(() => pipe.transform('2147483648')).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'CARD_LIST_NOT_FOUND' }) }),
    );
  });
});
