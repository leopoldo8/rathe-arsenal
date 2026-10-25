import { useCallback, useState } from 'react';
import type { IReadLine, TColorOption, useReadImportMutation } from '../../api/collection-imports';
import {
  acceptSuggestion,
  pickColor,
  replaceLine,
  setQuantity,
  toItems,
  undoSettled,
  type IReaderItem,
} from './readerState';

export interface IReaderItems {
  readonly items: readonly IReaderItem[];
  readonly searchingLine: number | null;
  readonly load: (lines: readonly IReadLine[]) => void;
  readonly accept: (lineNumber: number) => void;
  readonly undo: (lineNumber: number) => void;
  readonly pick: (lineNumber: number, option: TColorOption) => void;
  readonly useQuantity: (lineNumber: number, quantity: number) => void;
  /** Reads the corrected text of one line and puts the answer in that line's place. */
  readonly search: (lineNumber: number, text: string) => void;
}

/** The answers a player gives line by line, shared by the pasted-list and the spreadsheet screens. */
export function useReaderItems(read: ReturnType<typeof useReadImportMutation>): IReaderItems {
  const [items, setItems] = useState<readonly IReaderItem[]>([]);
  const [searchingLine, setSearchingLine] = useState<number | null>(null);

  const load = useCallback((lines: readonly IReadLine[]) => setItems(toItems(lines)), []);
  const accept = useCallback((lineNumber: number) => setItems((current) => acceptSuggestion(current, lineNumber)), []);
  const undo = useCallback((lineNumber: number) => setItems((current) => undoSettled(current, lineNumber)), []);
  const pick = useCallback(
    (lineNumber: number, option: TColorOption) => setItems((current) => pickColor(current, lineNumber, option)),
    [],
  );
  const useQuantity = useCallback(
    (lineNumber: number, quantity: number) => setItems((current) => setQuantity(current, lineNumber, quantity)),
    [],
  );
  const search = useCallback(
    (lineNumber: number, text: string) => {
      setSearchingLine(lineNumber);
      read.mutate(
        { text },
        {
          onSuccess: (response) => {
            const [line] = response.lines;
            if (line !== undefined) setItems((current) => replaceLine(current, lineNumber, line));
          },
          onSettled: () => setSearchingLine(null),
        },
      );
    },
    [read],
  );

  return { items, searchingLine, load, accept, undo, pick, useQuantity, search };
}
