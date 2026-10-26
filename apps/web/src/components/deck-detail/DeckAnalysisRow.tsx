import React from 'react';
import { useTranslation } from 'react-i18next';
import { pitchWord } from '../../lib/card-name';
import { GlossaryTerm } from '../glossary/GlossaryTerm';
import type { TGlossaryOwnData } from '../glossary/glossary-model';
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

const PITCH_SEGMENT_CLASS = {
  1: styles.pitchRed ?? '',
  2: styles.pitchYellow ?? '',
  3: styles.pitchBlue ?? '',
} as const;

function ownPitchCounts(slices: readonly IPitchSlice[]): TGlossaryOwnData {
  const countOf = (pitch: number): number => slices.find((slice) => slice.pitch === pitch)?.count ?? 0;
  return { kind: 'pitch', red: countOf(1), yellow: countOf(2), blue: countOf(3) };
}

function PitchCard({ slices }: { readonly slices: readonly IPitchSlice[] }): React.ReactElement {
  const { t } = useTranslation();
  const visible = slices.filter((slice) => slice.count > 0);
  return (
    <article className={styles.card} data-testid="analysis-pitch">
      <h2 className={styles.cardTitle}>
        <GlossaryTerm term="pitch" own={ownPitchCounts(slices)}>
          {t('deckDetail.pitchTitle')}
        </GlossaryTerm>
      </h2>
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
            {slices.map((slice, index) => (
              <li key={slice.pitch} className={styles.legendItem} data-testid={`pitch-legend-${slice.pitch}`}>
                {t('deckDetail.pitchLegendItem', {
                  label: pitchWord(slice.pitch, t) ?? '',
                  count: slice.count,
                })}
                {index < slices.length - 1 && (
                  <span className={styles.legendSeparator} aria-hidden="true">
                    {' · '}
                  </span>
                )}
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
      <h2 className={styles.cardTitle}>
        <GlossaryTerm term="costCurve">{t('deckDetail.costTitle')}</GlossaryTerm>
      </h2>
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
