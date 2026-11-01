import React from 'react';
import { useTranslation } from 'react-i18next';
import { StepsRail } from '../ui/RailLayout';

/** The two steps of adding a ready-made deck, the current one marked. */
export function ProductSteps({ current }: { readonly current: 'choose' | 'confirm' }): React.ReactElement {
  const { t } = useTranslation();
  return <StepsRail steps={[{ label: t('products.stepChoose') }, { label: t('products.stepConfirm') }]} current={current === 'choose' ? 0 : 1} />;
}
