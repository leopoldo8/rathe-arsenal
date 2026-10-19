import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LIST_NAME_MAX, useCreateListMutation, type TListKind } from '../../api/lists';
import { useDecksQuery } from '../../api/decks';
import { Button } from '../ui/Button/Button';
import { defaultListName, makeTranslate } from './listsModel';
import dialog from './ListDialog.module.css';
import styles from './NewListDialog.module.css';

type TStart = 'deck' | 'scratch';

interface INewListDialogProps {
  readonly open: boolean;
  readonly initialKind: TListKind;
  readonly onOpenChange: (open: boolean) => void;
}

export function NewListDialog({ open, initialKind, onOpenChange }: INewListDialogProps): React.ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={dialog.overlay} />
        <Dialog.Content className={dialog.panel} aria-describedby={undefined} data-testid="new-list-dialog">
          <NewListForm initialKind={initialKind} onClose={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface IRadioProps {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly title: string;
  readonly hint: string;
  readonly onSelect: () => void;
}

function RadioCard({ name, value, checked, title, hint, onSelect }: IRadioProps): React.ReactElement {
  return (
    <label className={styles.radio} data-checked={checked}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
      <span>
        <span className={styles.radioTitle}>{title}</span>
        <span className={styles.radioHint}>{hint}</span>
      </span>
    </label>
  );
}

function NewListForm({ initialKind, onClose }: { readonly initialKind: TListKind; readonly onClose: () => void }): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const decksQuery = useDecksQuery();
  const create = useCreateListMutation();
  const decks = decksQuery.data?.trackedDecks ?? [];
  const [kind, setKind] = useState<TListKind>(initialKind);
  const [start, setStart] = useState<TStart>('scratch');
  const [deckId, setDeckId] = useState<number | null>(null);
  const [typedName, setTypedName] = useState<string | null>(null);

  const effectiveDeckId = start === 'deck' ? (deckId ?? decks[0]?.id ?? null) : null;
  const deck = decks.find((candidate) => candidate.id === effectiveDeckId) ?? null;
  const name = typedName ?? defaultListName(kind, deck?.name ?? null, makeTranslate(t));
  const canSubmit = name.trim().length > 0 && (start === 'scratch' || effectiveDeckId !== null) && !create.isPending;

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      { kind, name: name.trim(), ...(effectiveDeckId !== null ? { fromDeckId: effectiveDeckId } : {}) },
      {
        onSuccess: (list) => {
          onClose();
          void navigate({ to: '/lists/$listId', params: { listId: String(list.id) } });
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <div className={dialog.header}>
        <Dialog.Title className={dialog.title}>{t('lists.create.title')}</Dialog.Title>
        <Dialog.Close className={dialog.iconBtn} aria-label={t('lists.create.close')}>
          <span aria-hidden="true">&#10005;</span>
        </Dialog.Close>
      </div>
      <div className={dialog.body}>
        <fieldset className={styles.fieldset}>
          <legend className={dialog.label}>{t('lists.create.kindLabel')}</legend>
          <div className={styles.radios}>
            <RadioCard name="kind" value="want" checked={kind === 'want'} title={t('lists.kind.want')} hint={t('lists.create.wantHint')} onSelect={() => setKind('want')} />
            <RadioCard name="kind" value="sell" checked={kind === 'sell'} title={t('lists.kind.sell')} hint={t('lists.create.sellHint')} onSelect={() => setKind('sell')} />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={dialog.label}>{t('lists.create.startLabel')}</legend>
          <div className={styles.radioStack}>
            <RadioCard
              name="start"
              value="deck"
              checked={start === 'deck'}
              title={t('lists.create.fromDeck')}
              hint={t(kind === 'want' ? 'lists.create.fromDeckWantHint' : 'lists.create.fromDeckSellHint')}
              onSelect={() => setStart('deck')}
            />
            <RadioCard name="start" value="scratch" checked={start === 'scratch'} title={t('lists.create.fromScratch')} hint={t('lists.create.fromScratchHint')} onSelect={() => setStart('scratch')} />
          </div>
        </fieldset>

        {start === 'deck' && (
          <div>
            <label className={dialog.label} htmlFor="new-list-deck">{t('lists.create.deckLabel')}</label>
            {decks.length === 0 ? (
              <p className={dialog.status}>{t('lists.create.noDecks')}</p>
            ) : (
              <select
                id="new-list-deck"
                className={dialog.select}
                value={effectiveDeckId ?? ''}
                onChange={(event) => {
                  setDeckId(Number(event.currentTarget.value));
                  setTypedName(null);
                }}
              >
                {decks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.cardCounts === null
                      ? t('lists.create.deckOptionPlain', { name: candidate.name })
                      : t('lists.create.deckOption', {
                          name: candidate.name,
                          missing: candidate.cardCounts.missing,
                          total: candidate.cardCounts.total,
                        })}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label className={dialog.label} htmlFor="new-list-name">{t('lists.create.nameLabel')}</label>
          <input
            id="new-list-name"
            className={dialog.field}
            type="text"
            maxLength={LIST_NAME_MAX}
            value={name}
            placeholder={t('lists.create.namePlaceholder')}
            onChange={(event) => setTypedName(event.currentTarget.value)}
          />
        </div>
        {create.isError && (
          <p className={dialog.error} role="alert">{t('lists.create.failed')}</p>
        )}
      </div>
      <div className={dialog.footer}>
        <Button variant="secondary" onClick={onClose}>{t('lists.create.cancel')}</Button>
        <Button type="submit" disabled={!canSubmit} loading={create.isPending}>{t('lists.create.submit')}</Button>
      </div>
    </form>
  );
}
