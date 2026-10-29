import { useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUploadCsvMutation,
  type IPartialOverlapUploadResponse,
  type IUploadCsvResponse,
  type TCsvUploadAction,
} from '../../api/csv-sources';
import { ApiError } from '../../lib/api-client';
import { useToast } from '../ui/Toast/useToast';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export interface INewVersionUpload {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Opens the file chooser. */
  readonly choose: () => void;
  readonly onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** The server's delta for the chosen file, while the window asks what to do with it. */
  readonly response: IPartialOverlapUploadResponse | null;
  readonly close: () => void;
  readonly onAction: (action: 'separate' | 'replace' | 'update' | 'cancel') => void;
}

/**
 * Sends a spreadsheet for one import ("Enviar nova versão"): the first request carries only that import's
 * id and gets back what would change; "Atualizar a existente" or "Substituir pela nova" sends the same file again.
 */
export function useNewVersionUpload(sourceId: string): INewVersionUpload {
  const { t } = useTranslation();
  const { show } = useToast();
  const upload = useUploadCsvMutation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<IPartialOverlapUploadResponse | null>(null);

  function reset(): void {
    setFile(null);
    setResponse(null);
    // The same file can be chosen again for the next try.
    if (inputRef.current) inputRef.current.value = '';
  }

  async function send(chosen: File, action?: TCsvUploadAction): Promise<void> {
    try {
      const result: IUploadCsvResponse = await upload.mutateAsync(
        action === undefined ? { file: chosen, targetSourceId: sourceId } : { file: chosen, action, targetSourceId: sourceId },
      );
      if (result.kind === 'partial-overlap') {
        setFile(chosen);
        setResponse(result);
        return;
      }
      reset();
      if (result.kind === 'updated' || result.kind === 'replaced') show({ kind: 'success', message: t('csvSources.uploadSuccessToast') });
    } catch (err) {
      reset();
      const message =
        err instanceof ApiError ? t('csvSources.uploadFailedWithError', { error: err.message }) : t('csvSources.uploadErrorDefault');
      show({ kind: 'error', message });
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (chosen.size > MAX_SIZE_BYTES) {
      show({ kind: 'error', message: t('csvSources.fileSizeError') });
      event.target.value = '';
      return;
    }
    void send(chosen);
  }

  function onAction(action: 'separate' | 'replace' | 'update' | 'cancel'): void {
    const chosen = file;
    setResponse(null);
    if (action === 'cancel' || chosen === null) {
      reset();
      return;
    }
    void send(chosen, action);
  }

  return { inputRef, choose: () => inputRef.current?.click(), onFileChange, response, close: reset, onAction };
}
