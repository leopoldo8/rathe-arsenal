import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './CardLightbox.module.css';
import { setCssVar } from '../../lib/dom/setCssVar';

export interface ICardLightboxProps {
  /**
   * Large-size WebP URL for the card face — the primary candidate.
   * Treated as a single-entry sources list when `sources` is omitted.
   */
  readonly imageUrl: string;
  /**
   * Optional ordered list of fallback URLs. The lightbox tries each in
   * sequence on load failure — same model as `CardArt`. When empty/omitted
   * only `imageUrl` is attempted.
   */
  readonly sources?: readonly string[];
  /** Card name — used as dialog title + img alt. */
  readonly name: string;
  /** Called when user dismisses via Escape, backdrop, or close button. */
  readonly onClose: () => void;
}

/**
 * Fullscreen card preview with perspective tilt on mouse-move.
 *
 * Dismisses on Escape, backdrop click, or the explicit close button.
 * Respects `prefers-reduced-motion` — the tilt collapses to a static
 * card when the user has motion reduced (R56 parity).
 */
export function CardLightbox({
  imageUrl,
  sources,
  name,
  onClose,
}: ICardLightboxProps): React.ReactElement {
  const { t } = useTranslation();
  const candidateList = sources && sources.length > 0 ? sources : [imageUrl];
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const currentSrc = candidateList[sourceIndex];
  const errored = sourceIndex >= candidateList.length;
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef<boolean>(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Capture reduced-motion preference once. We intentionally do NOT
    // subscribe to changes — the preview is short-lived and the current
    // value at open time is what matters for the perceived motion.
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  // Escape-to-close. Kept in a ref-free effect so the handler always
  // reads the latest onClose without re-subscribing per render.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Focus the close button so keyboard users can immediately dismiss
    // without tabbing through the overlay.
    closeButtonRef.current?.focus();
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion.current) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Normalize pointer to [-1, 1] on each axis relative to the card
    // centerpoint. Max tilt magnitude of 12deg reads as a strong but
    // non-disorienting parallax — more and the image warps past recognition.
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setTilt({ x: normY * -12, y: normX * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  // Perspective tilt is a continuous three-value transform — bridged via CSS
  // custom properties on the card element. The pre-existing transform-style/
  // transition on .card in the module still applies; we only override the
  // rotateX/Y values that change on every mousemove.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    setCssVar(el, '--tilt-x', `${tilt.x}deg`);
    setCssVar(el, '--tilt-y', `${tilt.y}deg`);
  }, [tilt]);

  // Portal to <body> so the lightbox escapes any ancestor that contains it
  // (sticky/overflow sidebar, transformed parent, etc). Without this, a
  // mount inside `DeckDetailSidebar` (sticky + overflow-y:auto) would clip
  // the backdrop and leave the navbar/page chrome visible behind it.
  if (typeof document === 'undefined') {
    return null as unknown as React.ReactElement;
  }
  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      data-testid="card-lightbox-backdrop"
    >
      <button
        type="button"
        ref={closeButtonRef}
        className={styles.closeButton}
        onClick={onClose}
        aria-label={t('ui.closeFullscreenPreview')}
        data-testid="card-lightbox-close"
      >
        &#10005;
      </button>
      <div
        ref={cardRef}
        className={styles.card}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        data-testid="card-lightbox-card"
      >
        {!loaded && !errored && (
          <div
            className={styles.skeleton}
            role="status"
            aria-label={t('ui.loadingCardArt', { name })}
            data-testid="card-lightbox-skeleton"
          />
        )}
        {errored && (
          // Graceful fallback for LSS S3 misses: the image code didn't
          // resolve to a real asset (404, network, CORS). Keep the
          // container intact and communicate the state instead of
          // looping the skeleton forever.
          <div
            className={styles.errorState}
            role="alert"
            data-testid="card-lightbox-error"
          >
            <span className={styles.errorGlyph} aria-hidden="true">&#9670;</span>
            <span className={styles.errorTitle}>{t('ui.cardArtUnavailable')}</span>
            <span className={styles.errorBody}>{name}</span>
          </div>
        )}
        {!errored && currentSrc && (
          <img
            // `key` forces a fresh element when the URL changes — the next
            // candidate runs through load → error/loaded even when the
            // previous tick already advanced the index.
            key={currentSrc}
            src={currentSrc}
            alt={name}
            className={loaded ? `${styles.image} ${styles['image--loaded']}` : styles.image}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              setSourceIndex((i) => i + 1);
            }}
            data-testid="card-lightbox-image"
          />
        )}
      </div>
      <p className={styles.caption} aria-hidden="true">
        {name}
      </p>
    </div>,
    document.body,
  );
}
