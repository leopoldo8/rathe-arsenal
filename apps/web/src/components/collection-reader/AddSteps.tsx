import React from 'react';
import { useTranslation } from 'react-i18next';
import { StepsRail } from '../ui/RailLayout';

export type TAddStep = 'choose' | 'read' | 'add';
const ORDER: readonly TAddStep[] = ['choose', 'read', 'add'];

/** The three steps of adding cards from a spreadsheet or a pasted list, the current one marked. */
export function AddSteps({ current, chooseKey }: { readonly current: TAddStep; readonly chooseKey: string }): React.ReactElement {
  const { t } = useTranslation();
  const steps = [{ label: t(chooseKey) }, { label: t('collectionReader.stepRead') }, { label: t('collectionReader.stepAdd') }];
  return <StepsRail steps={steps} current={ORDER.indexOf(current)} />;
}
