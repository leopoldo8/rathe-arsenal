import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useTranslation } from 'react-i18next';
import MainboardIcon from '../../assets/icons/slot-mainboard.svg?react';
import EquipmentIcon from '../../assets/icons/slot-equipment.svg?react';
import WeaponIcon from '../../assets/icons/slot-weapon.svg?react';
import HeroIcon from '../../assets/icons/slot-hero.svg?react';
import styles from './SlotPicker.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four slots a card can occupy in a deck composition. */
export type TDeckSlot = 'mainboard' | 'equipment' | 'weapon' | 'hero';

type TSlotEntry = {
  readonly value: TDeckSlot;
  readonly labelKey: 'slotMainboard' | 'slotEquipment' | 'slotWeapon' | 'slotHero';
  readonly Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

const SLOTS: ReadonlyArray<TSlotEntry> = [
  { value: 'mainboard', labelKey: 'slotMainboard', Icon: MainboardIcon },
  { value: 'equipment', labelKey: 'slotEquipment', Icon: EquipmentIcon },
  { value: 'weapon', labelKey: 'slotWeapon', Icon: WeaponIcon },
  { value: 'hero', labelKey: 'slotHero', Icon: HeroIcon },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ISlotPickerProps {
  /** Currently selected slot. */
  readonly value: TDeckSlot;
  /** Called when the user selects a different slot. */
  readonly onChange: (slot: TDeckSlot) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SlotPicker — 4-option segmented control for selecting a deck slot
 * (mainboard / equipment / weapon / hero). Built on Radix ToggleGroup
 * (type="single") with a guaranteed selection (no deselect).
 *
 * Each option renders the slot icon + visible text label + `aria-label`
 * per R50 ("{Slot} slot").
 *
 * Default selection: "mainboard". The caller manages the value via
 * `value` + `onChange` (controlled).
 */
export function SlotPicker({ value, onChange }: ISlotPickerProps): React.ReactElement {
  const { t } = useTranslation();

  function handleValueChange(next: string): void {
    // Radix fires an empty string when the user clicks the active item
    // (would deselect). Guard so slot selection is always defined.
    if (next && next !== '') {
      onChange(next as TDeckSlot);
    }
  }

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={handleValueChange}
      className={styles.root}
      aria-label={t('decks.deckSlotGroupAria')}
    >
      {SLOTS.map(({ value: slotValue, labelKey, Icon }) => {
        const label = t(`decks.${labelKey}`);
        return (
          <ToggleGroup.Item
            key={slotValue}
            value={slotValue}
            aria-label={t('decks.slotAria', { label })}
            className={styles.item}
            data-active={value === slotValue ? 'true' : 'false'}
          >
            <Icon
              width={16}
              height={16}
              aria-hidden="true"
              className={styles.icon}
            />
            <span className={styles.label}>{label}</span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
