import { parseFabraryUrl } from '../parse-url';
import { EFabraryErrorCode, FabraryImportError } from '../errors';

describe('parseFabraryUrl', () => {
  it('should return the ULID from a valid Fabrary deck URL', () => {
    // Arrange — real Fabrary ULID from the prototype
    const url = 'https://fabrary.net/decks/01KNQ1FHZ77B3FHT33DJY3RDX3';

    // Act
    const result = parseFabraryUrl(url);

    // Assert
    expect(result).toBe('01KNQ1FHZ77B3FHT33DJY3RDX3');
  });

  it('should uppercase a lowercase ULID', () => {
    // Arrange
    const url = 'https://fabrary.net/decks/01knq1fhz77b3fht33djy3rdx3';

    // Act
    const result = parseFabraryUrl(url);

    // Assert
    expect(result).toBe('01KNQ1FHZ77B3FHT33DJY3RDX3');
  });

  it('should accept the www. subdomain host', () => {
    // Arrange — the frontend URL regex accepts www.fabrary.net, so the
    // backend parser must too, otherwise pasting a www URL silently fails.
    const url = 'https://www.fabrary.net/decks/01KNQ1FHZ77B3FHT33DJY3RDX3';

    // Act
    const result = parseFabraryUrl(url);

    // Assert
    expect(result).toBe('01KNQ1FHZ77B3FHT33DJY3RDX3');
  });

  it('should throw INVALID_URL for a non-fabrary host', () => {
    // Arrange
    const url = 'https://example.com/decks/01KNQ1FHZ77B3FHT33DJY3RDX3';

    // Act & Assert
    expect(() => parseFabraryUrl(url)).toThrow(FabraryImportError);
    try {
      parseFabraryUrl(url);
    } catch (error) {
      expect((error as FabraryImportError).code).toBe(EFabraryErrorCode.INVALID_URL);
    }
  });

  it('should throw INVALID_URL for a non-deck path', () => {
    // Arrange
    const url = 'https://fabrary.net/users/01KNQ1FHZ77B3FHT33DJY3RDX3';

    // Act & Assert
    expect(() => parseFabraryUrl(url)).toThrow(FabraryImportError);
    try {
      parseFabraryUrl(url);
    } catch (error) {
      expect((error as FabraryImportError).code).toBe(EFabraryErrorCode.INVALID_URL);
    }
  });

  it('should throw INVALID_ULID for an invalid ULID format', () => {
    // Arrange -- contains 'I', 'L', 'O' which are excluded in Crockford base32
    const url = 'https://fabrary.net/decks/INVALID_ULID_WITH_BAD_CHARS';

    // Act & Assert
    expect(() => parseFabraryUrl(url)).toThrow(FabraryImportError);
    try {
      parseFabraryUrl(url);
    } catch (error) {
      expect((error as FabraryImportError).code).toBe(EFabraryErrorCode.INVALID_ULID);
    }
  });

  it('should throw INVALID_ULID for a too-short ULID', () => {
    // Arrange
    const url = 'https://fabrary.net/decks/01HTXYZ';

    // Act & Assert
    expect(() => parseFabraryUrl(url)).toThrow(FabraryImportError);
    try {
      parseFabraryUrl(url);
    } catch (error) {
      expect((error as FabraryImportError).code).toBe(EFabraryErrorCode.INVALID_ULID);
    }
  });

  it('should throw INVALID_URL for a completely invalid URL', () => {
    // Arrange
    const url = 'not-a-url';

    // Act & Assert
    expect(() => parseFabraryUrl(url)).toThrow(FabraryImportError);
    try {
      parseFabraryUrl(url);
    } catch (error) {
      expect((error as FabraryImportError).code).toBe(EFabraryErrorCode.INVALID_URL);
    }
  });

  it('should throw INVALID_URL for a path with extra segments', () => {
    // Arrange
    const url = 'https://fabrary.net/decks/01KNQ1FHZ77B3FHT33DJY3RDX3/extra';

    // Act & Assert
    expect(() => parseFabraryUrl(url)).toThrow(FabraryImportError);
    try {
      parseFabraryUrl(url);
    } catch (error) {
      expect((error as FabraryImportError).code).toBe(EFabraryErrorCode.INVALID_URL);
    }
  });
});
