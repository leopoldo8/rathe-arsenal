import React, { useEffect, useId, useRef, useState } from 'react';
import {
  useAddCardMutation,
  useDecrementCardMutation,
} from '../../api/collection';
import type { ILibraryCard, ILibraryCardContribution } from '../../api/library';
import styles from './LibraryCardStepper.module.css';

interface ILibraryCardStepperProps {
  readonly card: ILibraryCard;
  /** Hard cap on `+` clicks. Set high so the manual source can grow. */
  readonly maxQuantity?: number;
}

/**
 * Hover-revealed `+` / `−` stepper anchored to a library cell.
 *
 * `+` adds 1 to the manual source via `useAddCardMutation`. `−` subtracts
 * from the source the user picks. When only one source contributes to
 * the card, `−` decrements it directly; with two or more contributors
 * we open a small popover so the user disambiguates between, say, "Manual
 * entries (×2)" and "Fabrary: Kayo Brute Bash (×1)".
 *
 * The buttons stay reachable by keyboard (`focus-within` on the cell
 * keeps them visible) and are large enough on touch devices that hover
 * isn't a hard requirement — the cell CSS exposes them on `:focus-within`
 * and below the `hover: hover` media query.
 */
export function LibraryCardStepper({
  card,
  maxQuantity = 20,
}: ILibraryCardStepperProps): React.ReactElement {
  const addMutation = useAddCardMutation();
  const decrementMutation = useDecrementCardMutation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const removableContributions = card.contributions.filter((c) => c.quantity > 0);
  const canDecrement = removableContributions.length > 0;
  const canAdd = card.ownedQuantity < maxQuantity;
  const isPending = addMutation.isPending || decrementMutation.isPending;

  // Close the popover on outside click / Escape so the picker behaves
  // like the lightbox dismiss.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onPointerDown = (e: PointerEvent): void => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  function handleAdd(): void {
    if (!canAdd || isPending) return;
    addMutation.mutate({ cardIdentifier: card.cardIdentifier, quantity: 1 });
  }

  function handleDecrementClick(): void {
    if (!canDecrement || isPending) return;
    if (removableContributions.length === 1) {
      const only = removableContributions[0]!;
      decrementMutation.mutate({
        cardIdentifier: card.cardIdentifier,
        sourceId: only.sourceId,
        quantity: 1,
      });
      return;
    }
    setPickerOpen((v) => !v);
  }

  function handlePickContribution(contribution: ILibraryCardContribution): void {
    setPickerOpen(false);
    decrementMutation.mutate({
      cardIdentifier: card.cardIdentifier,
      sourceId: contribution.sourceId,
      quantity: 1,
    });
  }

  return (
    <div
      className={styles.stepper}
      ref={containerRef}
      data-rathe-stepper
      data-picker-open={pickerOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        className={styles.btn}
        onClick={(e) => {
          e.stopPropagation();
          handleDecrementClick();
        }}
        disabled={!canDecrement || isPending}
        aria-label={`Remove one ${card.name}`}
        aria-haspopup={
          removableContributions.length > 1 ? 'menu' : undefined
        }
        aria-expanded={
          removableContributions.length > 1 ? pickerOpen : undefined
        }
        aria-controls={
          removableContributions.length > 1 ? popoverId : undefined
        }
      >
        −
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={(e) => {
          e.stopPropagation();
          handleAdd();
        }}
        disabled={!canAdd || isPending}
        aria-label={`Add one ${card.name}`}
      >
        +
      </button>

      {pickerOpen && (
        <div
          id={popoverId}
          role="menu"
          className={styles.picker}
          aria-label={`Remove 1× from which source? (${card.name})`}
        >
          <p className={styles.pickerHeading}>
            <span aria-hidden="true">◆</span> Remove 1× from
          </p>
          <ul className={styles.pickerList}>
            {removableContributions.map((contribution) => (
              <li key={contribution.sourceId}>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.pickerRow}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickContribution(contribution);
                  }}
                >
                  <span className={styles.pickerLabel}>
                    {contribution.sourceLabel}
                  </span>
                  <span className={styles.pickerCount} aria-hidden="true">
                    ×{contribution.quantity}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
