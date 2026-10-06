import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useCollectorCodesQuery } from '../../api/collector-codes';
import { useAddCardsBatchMutation, type IAddCardsBatchResponse } from '../../api/collection';
import type { ISearchCardResult } from '../../api/catalog';
import { useNavigationAwayGuard } from '../../hooks/useNavigationAwayGuard';
import { DEFAULT_LIBRARY_SEARCH } from '../../routes/_auth/-library.helpers';
import { DiscardChangesConfirm } from '../deck-detail/DiscardChangesConfirm';
import { buildCollectorCodeIndex, resolveCollectorCode, type IScannedCard } from './collector-code';
import type { IOcrEngine } from './ocr-engine';
import { OCR_VARIANTS } from './ocr-variants';
import { preferredZoom, type ICameraControl, type ICameraState } from './camera-control';
import type { IGrayImage } from './ocr-image';
import { CameraError, useScannerDeps, type TCameraFailure } from './scanner-deps';
import { createScanLoop, type IScanLoop } from './scan-loop';
import {
  addSearchedCard,
  applyRecognition,
  EMPTY_SESSION,
  hasUnpickedRow,
  pickFace,
  removeRow,
  setRowQuantity,
  totalQuantity,
  undoScan,
  type IScanSession,
  type IScanStep,
} from './scan-session';
import { CameraUnavailable } from './CameraUnavailable';
import { NameSearchSheet } from './NameSearchSheet';
import { ReviewSheet } from './ReviewSheet';
import { ScanNotice, type TNotice, type TNoticeInput } from './ScanNotice';
import { ScannerBar } from './ScannerBar';
import { ScannerDebugPanel } from './ScannerDebugPanel';
import { ScannerTopBar } from './ScannerTopBar';
import styles from './CardScanner.module.css';

type TCameraState = 'starting' | 'ready' | TCameraFailure;
type TEngineState = 'loading' | 'ready' | 'error';

export const NOTICE_MS = 4000;
export const REMOVED_NOTICE_MS = 5000;

interface ICommitSummary {
  readonly count: number;
  readonly cappedNames: readonly string[];
}

interface IBlockedNavigation {
  readonly proceed: () => void;
  readonly stay: () => void;
}

export function CardScanner(): React.ReactElement {
  const { t } = useTranslation();
  const deps = useScannerDeps();
  const codesQuery = useCollectorCodesQuery();
  const index = useMemo(
    () => (codesQuery.data ? buildCollectorCodeIndex(codesQuery.data) : null),
    [codesQuery.data],
  );
  const batchMutation = useAddCardsBatchMutation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<IOcrEngine | null>(null);
  const loopRef = useRef<IScanLoop | null>(null);
  const sessionRef = useRef<IScanSession>(EMPTY_SESSION);
  const noticeIdRef = useRef(0);

  const [camera, setCamera] = useState<TCameraState>('starting');
  const [engine, setEngine] = useState<TEngineState>('loading');
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [session, setSession] = useState<IScanSession>(EMPTY_SESSION);
  const [notice, setNotice] = useState<TNotice | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [summary, setSummary] = useState<ICommitSummary | null>(null);
  const [blocked, setBlocked] = useState<IBlockedNavigation | null>(null);
  const [cameraControl, setCameraControl] = useState<ICameraControl | null>(null);
  const [cameraState, setCameraState] = useState<ICameraState>({ torchOn: false, zoom: null });
  const debug = useMemo(() => new URLSearchParams(window.location.search).has('debug'), []);
  const [debugCamera, setDebugCamera] = useState<Record<string, unknown> | null>(null);
  const [debugCrop, setDebugCrop] = useState<IGrayImage | null>(null);
  const [debugTexts, setDebugTexts] = useState<Readonly<Record<string, string>>>({});

  const updateSession = useCallback((next: IScanSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const showNotice = useCallback((next: TNoticeInput) => {
    noticeIdRef.current += 1;
    setNotice({ ...next, id: noticeIdRef.current });
  }, []);

  const applyStep = useCallback(
    (step: IScanStep) => {
      updateSession(step.session);
      if (step.outcome.kind === 'added') {
        showNotice({ kind: 'scanned', rowKey: step.outcome.rowKey, code: step.outcome.code });
      } else if (step.outcome.kind === 'tray-full') {
        showNotice({ kind: 'tray-full' });
      }
    },
    [showNotice, updateSession],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    deps
      .openCamera()
      .then((opened) => {
        stream = opened;
        if (cancelled || !videoRef.current) return;
        deps.attachStream(videoRef.current, opened);
        setCamera('ready');
        void deps
          .setUpCamera(videoRef.current, opened)
          .then((setup) => {
            stream = setup.stream;
            if (cancelled) {
              setup.stream.getTracks().forEach((track) => track.stop());
              return;
            }
            setCameraControl(setup.control);
            if (setup.control) {
              setCameraState(setup.control.initialState);
              setDebugCamera(setup.control.describe());
            }
          })
          .catch(() => undefined);
      })
      .catch((error: unknown) => {
        if (!cancelled) setCamera(error instanceof CameraError ? error.failure : 'error');
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [deps]);

  useEffect(() => {
    let cancelled = false;
    setEngine('loading');
    deps
      .loadEngine()
      .then((loaded) => {
        if (cancelled) {
          void loaded.terminate();
          return;
        }
        engineRef.current = loaded;
        setEngine('ready');
      })
      .catch(() => {
        if (!cancelled) setEngine('error');
      });
    return () => {
      cancelled = true;
      void engineRef.current?.terminate();
      engineRef.current = null;
    };
  }, [deps, engineAttempt]);

  useEffect(() => {
    if (camera !== 'ready' || engine !== 'ready' || index === null) return undefined;
    const loop = createScanLoop({
      variants: OCR_VARIANTS,
      captureFrame: () =>
        videoRef.current && stageRef.current ? deps.captureCard(videoRef.current, stageRef.current) : null,
      recognize: (card, variant) => {
        if (debug && variant.id === OCR_VARIANTS[0]!.id) setDebugCrop(variant.prepare(card));
        return engineRef.current!.recognize(card, variant);
      },
      onText: (variant, text) => {
        if (debug) setDebugTexts((texts) => ({ ...texts, [variant.id]: text }));
        applyStep(applyRecognition(sessionRef.current, variant.id, resolveCollectorCode(text, index)));
      },
      onError: () => setEngine('error'),
    });
    loopRef.current = loop;
    const cancelTicks = deps.scheduleTicks(loop.tick);
    return () => {
      cancelTicks();
      loopRef.current = null;
    };
  }, [applyStep, camera, debug, deps, engine, index]);

  useEffect(() => {
    loopRef.current?.setPaused(searchOpen || reviewOpen);
  }, [searchOpen, reviewOpen, engine, camera, index]);

  useEffect(() => {
    if (notice === null) return undefined;
    const timeout = window.setTimeout(
      () => setNotice((current) => (current?.id === notice.id ? null : current)),
      notice.kind === 'removed' ? REMOVED_NOTICE_MS : NOTICE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useNavigationAwayGuard({
    isDirty: session.rows.length > 0,
    isEditMode: true,
    onBlock: (proceed, stay) => setBlocked({ proceed, stay }),
  });

  function changeCameraState(next: ICameraState): void {
    if (!cameraControl) return;
    const previous = cameraState;
    setCameraState(next);
    cameraControl
      .apply(next)
      .then(() => setDebugCamera(cameraControl.describe()))
      .catch(() => setCameraState(previous));
  }

  const zoomRange = cameraControl?.features.zoom ?? null;
  const zoomedIn = preferredZoom(zoomRange);
  const zoomToggle =
    zoomRange && zoomedIn !== null && zoomedIn > zoomRange.min
      ? {
          zoom: cameraState.zoom ?? zoomRange.min,
          onToggle: () =>
            changeCameraState({ ...cameraState, zoom: cameraState.zoom === zoomedIn ? zoomRange.min : zoomedIn }),
        }
      : null;

  function handleWrong(rowKey: string, code: string): void {
    updateSession(undoScan(sessionRef.current, rowKey, code));
    showNotice({ kind: 'removed' });
  }

  function handleSearchPick(result: ISearchCardResult): void {
    const scanned: IScannedCard = {
      cardIdentifier: result.cardIdentifier,
      name: result.name,
      pitch: result.pitch,
      imageSmall: result.imageUrl?.small ?? null,
    };
    setSearchOpen(false);
    const step = addSearchedCard(sessionRef.current, scanned);
    updateSession(step.session);
    if (step.outcome.kind === 'tray-full') showNotice({ kind: 'tray-full' });
  }

  function handleConfirm(): void {
    const committed = sessionRef.current;
    const items = committed.rows.map((row) => ({ cardIdentifier: row.picked!.cardIdentifier, quantity: row.quantity }));
    batchMutation.mutate(items, {
      onSuccess: (response: IAddCardsBatchResponse) => {
        const names = new Map(committed.rows.map((row) => [row.picked!.cardIdentifier, row.picked!.name]));
        setSummary({
          count: totalQuantity(committed),
          cappedNames: response.results.filter((r) => r.capped).map((r) => names.get(r.cardIdentifier) ?? r.cardIdentifier),
        });
        updateSession(EMPTY_SESSION);
        setNotice(null);
        setReviewOpen(false);
      },
    });
  }

  if (camera === 'denied' || camera === 'no-camera') {
    return (
      <div className={styles.scanner}>
        <ScannerTopBar torch={null} zoom={null} />
        <CameraUnavailable failure={camera} />
      </div>
    );
  }

  const isLoading = engine === 'loading' || codesQuery.isPending;
  const hasError = engine === 'error' || codesQuery.isError || camera === 'error';
  const canConfirm = session.rows.length > 0 && !hasUnpickedRow(session) && !batchMutation.isPending;

  function handleRetry(): void {
    if (codesQuery.isError) void codesQuery.refetch();
    setEngineAttempt((attempt) => attempt + 1);
  }

  return (
    <div className={styles.scanner}>
      <ScannerTopBar
        torch={
          cameraControl?.features.torch
            ? { on: cameraState.torchOn, onToggle: () => changeCameraState({ ...cameraState, torchOn: !cameraState.torchOn }) }
            : null
        }
        zoom={zoomToggle}
      />

      <div ref={stageRef} className={styles.stage}>
        <video ref={videoRef} className={styles.video} muted playsInline aria-hidden="true" />
        <div className={styles.guide} data-testid="card-guide">
          <span className={styles.codeLine} />
        </div>
        <p className={styles.hint}>{t('scanner.hint')}</p>
        {isLoading && !hasError && (
          <p className={styles.status} role="status">
            {t('scanner.loadingEngine')}
          </p>
        )}
        {hasError && (
          <div className={styles.status} role="alert">
            <p>{t('scanner.engineError')}</p>
            <button type="button" className={styles.secondaryButton} onClick={handleRetry}>
              {t('scanner.retry')}
            </button>
          </div>
        )}
        <ScanNotice
          notice={notice}
          session={session}
          onWrong={handleWrong}
          onSearch={() => {
            setNotice(null);
            setSearchOpen(true);
          }}
        />
      </div>

      {summary && (
        <div className={styles.summary} role="status">
          <p>{t('scanner.commitSuccess', { count: summary.count })}</p>
          {summary.cappedNames.length > 0 && (
            <p>{t('scanner.commitCapped', { names: summary.cappedNames.join(', ') })}</p>
          )}
          <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.summaryLink}>
            {t('scanner.openLibrary')}
          </Link>
        </div>
      )}

      {debug && <ScannerDebugPanel camera={debugCamera} crop={debugCrop} texts={debugTexts} />}

      <ScannerBar
        total={totalQuantity(session)}
        canConfirm={canConfirm}
        isPending={batchMutation.isPending}
        onReview={() => setReviewOpen(true)}
        onConfirm={handleConfirm}
      />

      <ReviewSheet
        open={reviewOpen}
        session={session}
        canConfirm={canConfirm}
        isPending={batchMutation.isPending}
        error={batchMutation.error}
        onClose={() => setReviewOpen(false)}
        onQuantity={(rowKey, quantity) => updateSession(setRowQuantity(sessionRef.current, rowKey, quantity))}
        onRemove={(rowKey) => updateSession(removeRow(sessionRef.current, rowKey))}
        onPick={(rowKey, cardIdentifier) => updateSession(pickFace(sessionRef.current, rowKey, cardIdentifier))}
        onConfirm={handleConfirm}
      />

      <NameSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} onPick={handleSearchPick} />

      <DiscardChangesConfirm
        open={blocked !== null}
        changeCount={totalQuantity(session)}
        copy={{
          title: t('scanner.discardTitle', { count: totalQuantity(session) }),
          description: t('scanner.discardBody'),
          keep: t('scanner.discardKeep'),
          discard: t('scanner.discardConfirm'),
        }}
        onKeepEditing={() => {
          blocked?.stay();
          setBlocked(null);
        }}
        onDiscard={() => {
          blocked?.proceed();
          setBlocked(null);
        }}
      />
    </div>
  );
}
