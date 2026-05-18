import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
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

const SLOTS: ReadonlyArray<{
  readonly value: TDeckSlot;
  readonly label: string;
  readonly Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}> = [
  { value: 'mainboard', label: 'Mainboard', Icon: MainboardIcon },
  { value: 'equipment', label: 'Equipment', Icon: EquipmentIcon },
  { value: 'weapon', label: 'Weapon', Icon: WeaponIcon },
  { value: 'hero', label: 'Hero', Icon: HeroIcon },
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
      aria-label="Deck slot"
    >
      {SLOTS.map(({ value: slotValue, label, Icon }) => (
        <ToggleGroup.Item
          key={slotValue}
          value={slotValue}
          aria-label={`${label} slot`}
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
      ))}
    </ToggleGroup.Root>
  );
}
