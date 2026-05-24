/**
 * FormatDropdown — 4-option format selector for deck Edit mode.
 *
 * Uses `@radix-ui/react-select` (already installed by U8). Emits the
 * format string from the 4 supported formats. Does NOT import the engine.
 */
import React from 'react';
import * as Select from '@radix-ui/react-select';
import styles from './FormatDropdown.module.css';

// ---------------------------------------------------------------------------
// Supported formats
// ---------------------------------------------------------------------------

export const SUPPORTED_FORMATS = [
  { value: 'Classic Constructed', label: 'Classic Constructed' },
  { value: 'Blitz', label: 'Blitz' },
  { value: 'Living Legend', label: 'Living Legend' },
  { value: 'Silver Age', label: 'Silver Age' },
] as const;

export type TSupportedFormat = (typeof SUPPORTED_FORMATS)[number]['value'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IFormatDropdownProps {
  /** Currently selected format string. */
  readonly value: string;
  /** Called when the user selects a new format. */
  readonly onChange: (format: string) => void;
  /** Label text shown above the dropdown. */
  readonly label?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FormatDropdown — 4-option Radix Select for deck format selection in Edit mode.
 */
export function FormatDropdown({
  value,
  onChange,
  label = 'Format',
}: IFormatDropdownProps): React.ReactElement {
  return (
    <div className={styles.root} data-testid="format-dropdown">
      <label className={styles.label} htmlFor="format-dropdown-trigger">
        {label}
      </label>
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          id="format-dropdown-trigger"
          className={styles.trigger}
          aria-label={`Format: ${value}`}
          data-testid="format-dropdown-trigger"
        >
          <Select.Value placeholder="Select format" />
          <Select.Icon className={styles.icon} aria-hidden="true">
            &#x25BC;
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={styles.content}
            position="popper"
            sideOffset={4}
            data-testid="format-dropdown-content"
          >
            <Select.Viewport className={styles.viewport}>
              {SUPPORTED_FORMATS.map((fmt) => (
                <Select.Item
                  key={fmt.value}
                  value={fmt.value}
                  className={styles.item}
                  data-testid={`format-option-${fmt.value}`}
                >
                  <Select.ItemText>{fmt.label}</Select.ItemText>
                  <Select.ItemIndicator className={styles.itemIndicator}>
                    <span aria-hidden="true">&#x2713;</span>
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
