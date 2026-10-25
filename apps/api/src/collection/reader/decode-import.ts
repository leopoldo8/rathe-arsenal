import { BadRequestException } from '@nestjs/common';

export function unreadableImport(message: string): BadRequestException {
  return new BadRequestException({ code: 'IMPORT_UNREADABLE', message });
}

/** Text of a pasted body, refused when it is empty. */
export function checkedImportText(text: string): string {
  const trimmed = text.replace(/^﻿/, '');
  if (trimmed.trim() === '') throw unreadableImport('The import has no text to read');
  return trimmed;
}

/**
 * A file's text: UTF-8 when it is valid UTF-8, Latin-1 otherwise (spreadsheets saved by Excel in Brazil).
 * A file with NUL bytes is binary, not text.
 */
export function decodeImportBuffer(buffer: Buffer): string {
  if (buffer.length === 0) throw unreadableImport('The file is empty');
  if (buffer.includes(0)) throw unreadableImport('The file is not text');
  try {
    return checkedImportText(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    return checkedImportText(buffer.toString('latin1'));
  }
}
