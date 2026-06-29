import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useTranslation } from 'react-i18next';
import styles from './LanguageToggle.module.css';

type TLocale = 'pt-BR' | 'en-US';

/**
 * Visible labels are short language codes; the full autonym is the aria-label.
 * Autonyms are intentionally NOT translated — each language is named in itself
 * (the conventional pattern for language switchers), so they do not change with
 * the active locale.
 */
const OPTIONS: { value: TLocale; short: string; autonym: string }[] = [
  { value: 'pt-BR', short: 'PT', autonym: 'Português' },
  { value: 'en-US', short: 'EN', autonym: 'English' },
];

function activeLocale(lng: string | undefined): TLocale {
  return lng?.startsWith('en') ? 'en-US' : 'pt-BR';
}

/**
 * LanguageToggle — two-button toggle group (PT / EN) mirroring ThemeToggle.
 *
 * On change it calls `i18n.changeLanguage(next)`; the browser-language-detector
 * caches the choice to localStorage and the bootstrap's `languageChanged`
 * listener updates `<html lang>`. There is no server persistence — language is
 * a client-only preference (owner decision; see AD-002).
 */
export function LanguageToggle(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const current = activeLocale(i18n.language);

  function handleChange(value: string): void {
    if (value !== 'pt-BR' && value !== 'en-US') return;
    void i18n.changeLanguage(value);
  }

  return (
    <ToggleGroup.Root
      type="single"
      value={current}
      onValueChange={handleChange}
      aria-label={t('settings.languageToggleAria')}
      className={styles.root}
    >
      {OPTIONS.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          aria-label={opt.autonym}
          className={styles.item}
          data-testid={`language-toggle-${opt.value}`}
        >
          {opt.short}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
