import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import {
  NO_VERSION,
  useCardVersionOptionsQuery,
  useMoveCopiesMutation,
  type ICardVersionPrinting,
  type ICopiesByVersion,
  type ICopyVersion,
  type TCondition,
  type TEdition,
  type TFinish,
} from '../../api/collection-versions';
import type { ILibraryCard } from '../../api/library';
import { cardName } from '../../lib/card-name';
import {
  CONDITION_OPTIONS,
  EDITION_OPTIONS,
  FINISH_OPTIONS,
  describeVersion,
  editionLabel,
  finishLabel,
  isUnversioned,
  versionKey,
} from './copy-version-labels';
import styles from './CopyVersions.module.css';

/** Printings shown before "+ N versões"; the screen draws three. */
const VISIBLE_PRINTINGS = 3;

interface ICardVersionsSheetProps {
  readonly card: Pick<ILibraryCard, 'cardIdentifier' | 'name' | 'pitch' | 'imageUrl' | 'ownedQuantity' | 'contributions'>;
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Sums the copies of a card by version across every import that holds them; copies with no version come first. */
function groupCopies(contributions: ILibraryCard['contributions']): ICopiesByVersion[] {
  const groups = new Map<string, ICopiesByVersion>();
  for (const entry of contributions) {
    if (entry.quantity <= 0) continue;
    const version: ICopyVersion = {
      printingCode: entry.printingCode ?? '',
      edition: (entry.edition ?? '') as ICopyVersion['edition'],
      finish: (entry.finish ?? '') as ICopyVersion['finish'],
      condition: (entry.condition ?? '') as ICopyVersion['condition'],
    };
    const key = versionKey(version);
    const known = groups.get(key);
    groups.set(key, { ...version, quantity: (known?.quantity ?? 0) + entry.quantity });
  }
  return [...groups.values()].sort((a, b) => Number(isUnversioned(b)) - Number(isUnversioned(a)));
}

export function CardVersionsSheet({ card, open, onClose }: ICardVersionsSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(card.name, card.pitch, t);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.sheet}
          aria-describedby={undefined}
          aria-label={t('copyVersions.sheetAriaLabel', { name })}
        >
          <span className={styles.handle} aria-hidden="true" />
          <SheetBody card={card} name={name} onClose={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ISheetBodyProps {
  readonly card: ICardVersionsSheetProps['card'];
  readonly name: string;
  readonly onClose: () => void;
}

function SheetBody({ card, name, onClose }: ISheetBodyProps): React.ReactElement {
  const { t } = useTranslation();
  const optionsQuery = useCardVersionOptionsQuery(card.cardIdentifier);
  const printings = useMemo(() => optionsQuery.data?.printings ?? [], [optionsQuery.data]);
  const groups = useMemo(() => groupCopies(card.contributions), [card.contributions]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const setNameOf = (code: string): string | null => printings.find((p) => p.printingCode === code)?.setName ?? null;
  // "Mudar versão" acts on the copies with no version; when every copy has one, on the first group.
  const from = groups[0] ?? { ...NO_VERSION, quantity: 0 };

  return (
    <>
      <div className={styles.cardHead}>
        {card.imageUrl && <img className={styles.cardThumb} src={card.imageUrl.small} alt="" />}
        <div>
          <Dialog.Title className={styles.cardName}>{name}</Dialog.Title>
          <p className={styles.subtitle}>{t('copyVersions.copiesCount', { count: card.ownedQuantity })}</p>
        </div>
      </div>
      <ul className={styles.groups}>
        {groups.map((group) => (
          <li key={versionKey(group)} className={styles.muted}>
            {isUnversioned(group)
              ? t('copyVersions.groupUnknown', { count: group.quantity })
              : t('copyVersions.groupVersion', { count: group.quantity, version: describeVersion(group, t, setNameOf) })}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.secondary} onClick={() => setPickerOpen(true)}>
        {t('copyVersions.changeVersion')}
      </button>
      {pickerOpen && (
        <VersionPicker
          cardIdentifier={card.cardIdentifier}
          from={from}
          printings={printings}
          loading={optionsQuery.isLoading}
          failed={optionsQuery.isError}
          onSaved={onClose}
        />
      )}
    </>
  );
}

interface IVersionPickerProps {
  readonly cardIdentifier: string;
  readonly from: ICopiesByVersion;
  readonly printings: readonly ICardVersionPrinting[];
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onSaved: () => void;
}

function toggled<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
}

function VersionPicker({ cardIdentifier, from, printings, loading, failed, onSaved }: IVersionPickerProps): React.ReactElement {
  const { t } = useTranslation();
  const moveMutation = useMoveCopiesMutation();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [printingCode, setPrintingCode] = useState<string | null>(null);
  const [edition, setEdition] = useState<TEdition | null>(null);
  const [finish, setFinish] = useState<TFinish | null>(null);
  const [condition, setCondition] = useState<TCondition | null>(null);
  const [scope, setScope] = useState<'all' | 'one' | null>(null);

  const selected = printings.find((printing) => printing.printingCode === printingCode) ?? null;
  const pool = selected ? [selected] : printings;
  const editions = EDITION_OPTIONS.filter((option) => pool.some((printing) => printing.editions.includes(option)));
  const finishes = FINISH_OPTIONS.filter((option) => pool.some((printing) => printing.finishes.includes(option)));

  const needle = search.trim().toLowerCase();
  const matching = needle
    ? printings.filter((printing) => `${printing.setName ?? ''} ${printing.printingCode}`.toLowerCase().includes(needle))
    : printings;
  const visible = needle || showAll ? matching : matching.slice(0, VISIBLE_PRINTINGS);
  const hidden = matching.length - visible.length;

  function pickPrinting(code: string): void {
    const next = toggled(printingCode, code);
    const nextPrinting = printings.find((printing) => printing.printingCode === next);
    setPrintingCode(next);
    // What the new printing does not have cannot stay picked.
    if (nextPrinting && edition && !nextPrinting.editions.includes(edition)) setEdition(null);
    if (nextPrinting && finish && !nextPrinting.finishes.includes(finish)) setFinish(null);
  }

  const canSave = (printingCode || edition || finish || condition) && scope !== null && !moveMutation.isPending;

  function save(): void {
    if (!canSave) return;
    moveMutation.mutate(
      {
        cardIdentifier,
        from: { printingCode: from.printingCode, edition: from.edition, finish: from.finish, condition: from.condition },
        to: { printingCode: printingCode ?? '', edition: edition ?? '', finish: finish ?? '', condition: condition ?? '' },
        quantity: scope === 'one' ? 1 : from.quantity,
      },
      { onSuccess: onSaved },
    );
  }

  return (
    <section className={styles.picker} aria-labelledby="copy-versions-picker-title">
      <h3 className={styles.pickerTitle} id="copy-versions-picker-title">
        {t('copyVersions.pickerTitle')}
      </h3>
      <div className={styles.field}>
        <p className={styles.groupLabel}>{t('copyVersions.versionLabel')}</p>
        <input
          type="search"
          className={styles.search}
          value={search}
          placeholder={t('copyVersions.versionSearch')}
          aria-label={t('copyVersions.versionSearch')}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <p className={styles.explain}>{t('copyVersions.optionsLoading')}</p>}
        {failed && (
          <p className={styles.error} role="alert">
            {t('copyVersions.optionsError')}
          </p>
        )}
        <ul className={styles.printings}>
          {visible.map((printing) => (
            <li key={printing.printingCode}>
              <button
                type="button"
                className={styles.printing}
                aria-pressed={printing.printingCode === printingCode}
                onClick={() => pickPrinting(printing.printingCode)}
              >
                {printing.imageUrl ? (
                  <img className={styles.printingThumb} src={printing.imageUrl.small} alt="" />
                ) : (
                  <span className={styles.printingThumb} aria-hidden="true" />
                )}
                <span>
                  <span className={styles.printingSet}>{printing.setName ?? printing.printingCode}</span>
                  <span className={styles.printingCode}>{printing.printingCode}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {needle && matching.length === 0 && <p className={styles.explain}>{t('copyVersions.noVersionMatches')}</p>}
        {hidden > 0 && (
          <button type="button" className={styles.more} onClick={() => setShowAll(true)}>
            {t('copyVersions.moreVersions', { count: hidden })}
          </button>
        )}
        <p className={styles.explain}>{t('copyVersions.versionExplain')}</p>
      </div>
      {editions.length > 0 && (
        <ChipGroup
          label={t('copyVersions.editionLabel')}
          explain={t('copyVersions.editionExplain')}
          options={editions.map((option) => ({ value: option, text: editionLabel(option, t) }))}
          value={edition}
          onPick={(value) => setEdition(toggled(edition, value))}
        />
      )}
      {finishes.length > 0 && (
        <ChipGroup
          label={t('copyVersions.foilLabel')}
          explain={t('copyVersions.foilExplain')}
          options={finishes.map((option) => ({ value: option, text: finishLabel(option, t) }))}
          value={finish}
          onPick={(value) => setFinish(toggled(finish, value))}
        />
      )}
      <ChipGroup
        label={t('copyVersions.conditionLabel')}
        explain={t('copyVersions.conditionExplain')}
        options={CONDITION_OPTIONS.map((option) => ({ value: option, text: option }))}
        value={condition}
        onPick={(value) => setCondition(toggled(condition, value))}
      />
      <ChipGroup
        label={t('copyVersions.appliesTo')}
        options={[
          ...(from.quantity > 1 ? [{ value: 'all' as const, text: t('copyVersions.appliesAll', { count: from.quantity }) }] : []),
          { value: 'one' as const, text: t('copyVersions.appliesOne') },
        ]}
        value={scope}
        onPick={(value) => setScope(toggled(scope, value))}
      />
      {moveMutation.isError && (
        <p className={styles.error} role="alert">
          {t('copyVersions.saveError')}
        </p>
      )}
      <button type="button" className={styles.primary} disabled={!canSave} onClick={save}>
        {moveMutation.isPending ? t('copyVersions.saving') : t('copyVersions.save')}
      </button>
    </section>
  );
}

interface IChipGroupProps<T extends string> {
  readonly label: string;
  readonly explain?: string;
  readonly options: readonly { readonly value: T; readonly text: string }[];
  readonly value: T | null;
  readonly onPick: (value: T) => void;
}

function ChipGroup<T extends string>({ label, explain, options, value, onPick }: IChipGroupProps<T>): React.ReactElement {
  return (
    <div className={styles.field}>
      <p className={styles.groupLabel}>{label}</p>
      <ul className={styles.chips}>
        {options.map((option) => (
          <li key={option.value}>
            <button type="button" className={styles.chip} aria-pressed={value === option.value} onClick={() => onPick(option.value)}>
              {option.text}
            </button>
          </li>
        ))}
      </ul>
      {explain && <p className={styles.explain}>{explain}</p>}
    </div>
  );
}
