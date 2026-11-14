import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IScanSession } from './scan-session';
import { CardName, CardThumb } from './CardFace';
import styles from './CardScanner.module.css';

export type TNotice =
  | { readonly id: number; readonly kind: 'scanned'; readonly rowKey: string; readonly code: string }
  | { readonly id: number; readonly kind: 'removed' }
  | { readonly id: number; readonly kind: 'tray-full' };

export type TNoticeInput = TNotice extends infer TEach ? (TEach extends TNotice ? Omit<TEach, 'id'> : never) : never;

interface IScanNoticeProps {
  readonly notice: TNotice | null;
  readonly session: IScanSession;
  readonly onWrong: (rowKey: string, code: string) => void;
  readonly onSearch: () => void;
}

export function ScanNotice({ notice, session, onWrong, onSearch }: IScanNoticeProps): React.ReactElement {
  return (
    <div className={styles.noticeRegion} aria-live="polite">
      {notice && <NoticeBody notice={notice} session={session} onWrong={onWrong} onSearch={onSearch} />}
    </div>
  );
}

function NoticeBody({
  notice,
  session,
  onWrong,
  onSearch,
}: IScanNoticeProps & { readonly notice: TNotice }): React.ReactElement | null {
  const { t } = useTranslation();

  if (notice.kind === 'tray-full') {
    return (
      <div className={styles.notice} data-testid="scan-notice">
        <p className={styles.noticeText}>{t('scanner.trayFull')}</p>
      </div>
    );
  }

  if (notice.kind === 'removed') {
    return (
      <div className={styles.notice} data-testid="scan-notice">
        <p className={styles.noticeText}>{t('scanner.noticeRemoved')}</p>
        <button type="button" className={styles.noticeButton} onClick={onSearch}>
          {t('scanner.noticeSearch')}
        </button>
      </div>
    );
  }

  const row = session.rows.find((candidate) => candidate.key === notice.rowKey);
  if (!row) return null;
  const names = row.candidates.map((card) => card.name).join(' / ');
  return (
    <div className={styles.notice} data-testid="scan-notice">
      <CardThumb card={row.picked ?? row.candidates[0]!} />
      <div className={styles.noticeText}>
        {row.picked ? <CardName card={row.picked} /> : <span className={styles.cardName}>{names}</span>}
        <span className={styles.noticeCount}>{t('scanner.noticeInTray', { count: row.quantity })}</span>
      </div>
      <button
        type="button"
        className={styles.noticeButton}
        onClick={() => onWrong(row.key, notice.code)}
        aria-label={t('scanner.noticeWrongAria', { name: names })}
      >
        {t('scanner.noticeWrong')}
      </button>
    </div>
  );
}
