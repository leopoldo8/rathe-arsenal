import React from 'react';
import { useTranslation } from 'react-i18next';
import { VarFill } from './VarFill';
import {
  buildCostBars,
  buildPitchSlices,
  type ICostBar,
  type IPitchSlice,
} from './deckAnalysisModel';
import type { IDeckListItem } from './deckListModel';
import styles from './DeckAnalysisRow.module.css';

interface IDeckAnalysisRowProps {
  readonly items: readonly IDeckListItem[];
}

const PITCH_LABEL_KEY = {
  1: 'deckDetail.pitchRed',
  2: 'deckDetail.pitchYellow',
  3: 'deckDetail.pitchBlue',
} as const;

const PITCH_SEGMENT_CLASS = {
  1: styles.pitchRed ?? '',
  2: styles.pitchYellow ?? '',
  3: styles.pitchBlue ?? '',
} as const;

function PitchCard({ slices }: { readonly slices: readonly IPitchSlice[] }): React.ReactElement {
  const { t } = useTranslation();
  const visible = slices.filter((slice) => slice.count > 0);
  return (
    <article className={styles.card} data-testid="analysis-pitch">
      <h2 className={styles.cardTitle}>{t('deckDetail.pitchTitle')}</h2>
      {visible.length === 0 ? (
        <p className={styles.empty}>{t('deckDetail.pitchEmpty')}</p>
      ) : (
        <>
          <div className={styles.stack} role="presentation">
            {visible.map((slice) => (
              <VarFill
                key={slice.pitch}
                className={`${styles.segment} ${PITCH_SEGMENT_CLASS[slice.pitch]}`}
                cssVar="--ra-grow"
                value={slice.count}
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {slices.map((slice) => (
              <li key={slice.pitch} className={styles.legendItem} data-testid={`pitch-legend-${slice.pitch}`}>
                <span className={`${styles.dot} ${PITCH_SEGMENT_CLASS[slice.pitch]}`} aria-hidden="true" />
                {t('deckDetail.pitchLegendItem', {
                  label: t(PITCH_LABEL_KEY[slice.pitch]),
                  count: slice.count,
                })}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function CostCard({ bars }: { readonly bars: readonly ICostBar[] }): React.ReactElement {
  const { t } = useTranslation();
  const peak = Math.max(1, ...bars.map((bar) => bar.count));
  return (
    <article className={styles.card} data-testid="analysis-cost">
      <h2 className={styles.cardTitle}>{t('deckDetail.costTitle')}</h2>
      <ul className={styles.curve}>
        {bars.map((bar) => {
          const label = bar.id === '4plus' ? t('deckDetail.costFourPlus') : bar.id;
          return (
            <li
              key={bar.id}
              className={styles.curveColumn}
              aria-label={t('deckDetail.costBarAria', { cost: label, count: bar.count })}
              data-testid={`cost-bar-${bar.id}`}
            >
              <span className={styles.curveValue}>{bar.count}</span>
              <div className={styles.curveTrack}>
                <VarFill
                  className={styles.curveFill ?? ''}
                  cssVar="--ra-fill"
                  value={`${Math.round((bar.count / peak) * 100)}%`}
                />
              </div>
              <span className={styles.curveLabel}>{label}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function DeckAnalysisRow({ items }: IDeckAnalysisRowProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section className={styles.row} aria-label={t('deckDetail.analysisAria')} data-testid="deck-analysis-row">
      <PitchCard slices={buildPitchSlices(items)} />
      <CostCard bars={buildCostBars(items)} />
    </section>
  );
}
