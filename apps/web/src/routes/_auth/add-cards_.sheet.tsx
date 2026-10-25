import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ImportReport } from '../../components/collection-reader/ImportReport';
import { takePendingImportFile } from '../../lib/pending-import-file';
import styles from '../../components/collection-reader/CollectionReader.module.css';

export const Route = createFileRoute('/_auth/add-cards_/sheet')({
  component: AddCardsSheetPage,
});

/** A spreadsheet is read the moment it is chosen; the report shows every line before anything is added. */
export function AddCardsSheetPage(): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(() => takePendingImportFile());

  if (file !== null) return <ImportReport file={file} onChooseAnother={() => setFile(null)} />;
  return (
    <div className={styles.page}>
      <Link to="/add-cards" className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('collectionReader.back')}
      </Link>
      <h1 className={styles.title}>{t('collectionReader.sheetTitle')}</h1>
      <div className={styles.dropZone}>
        <p className={styles.note}>{t('collectionReader.sheetHint')}</p>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv,text/plain"
          className={styles.fileInput}
          onChange={(event) => {
            const chosen = event.currentTarget.files?.[0];
            if (chosen) setFile(chosen);
            event.currentTarget.value = '';
          }}
        />
        <label htmlFor={inputId} className={styles.chooseLabel}>
          {t('collectionReader.sheetChoose')}
        </label>
      </div>
    </div>
  );
}
