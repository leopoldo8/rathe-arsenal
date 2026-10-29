import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cardOf, groupOf, type IReaderItem } from './readerState';
import type { IReaderItems } from './useReaderItems';
import { ColorChoices, QuantityBlock, SearchBlock, SuggestionBlock } from './ReaderBlocks';

interface IReaderLineViewProps {
  readonly item: IReaderItem;
  readonly reader: IReaderItems;
  /** The report adds "Não sei" to the colors; the list screen draws the three colors only. */
  readonly showUnknown: boolean;
}

/** What a line asks for while it is not ready; the same answers on the list screen and in the report. */
export function ReaderLineBody({ item, reader, showUnknown }: IReaderLineViewProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [correcting, setCorrecting] = useState(false);
  const { line } = item;
  const group = groupOf(item);
  const card = cardOf(item);

  if (group === 'color' && line.options !== null) {
    return (
      <ColorChoices
        options={line.options}
        showUnknown={showUnknown}
        declined={item.declined}
        onPick={(option) => reader.pick(line.lineNumber, option)}
      />
    );
  }
  if (group === 'similar' && line.suggestion !== null && !correcting) {
    return (
      <SuggestionBlock
        suggestion={line.suggestion}
        onUse={() => reader.accept(line.lineNumber)}
        onCorrect={() => setCorrecting(true)}
      />
    );
  }
  if (group === 'quantity' && card !== null) {
    return (
      <QuantityBlock
        lineNumber={line.lineNumber}
        raw={line.quantityRaw}
        suggested={line.suggestedQuantity}
        onUse={(quantity) => reader.useQuantity(line.lineNumber, quantity)}
      />
    );
  }
  if (group === 'similar' || group === 'notFound') {
    return (
      <SearchBlock
        lineNumber={line.lineNumber}
        initialText={line.originalText}
        searching={reader.searchingLine === line.lineNumber}
        headline={group === 'notFound' ? t('collectionReader.notFound', { text: line.originalText }) : null}
        onSearch={(text) => reader.search(line.lineNumber, text)}
      />
    );
  }
  return null;
}
