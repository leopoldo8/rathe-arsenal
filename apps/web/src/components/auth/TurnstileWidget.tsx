import React, { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface ITurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: ITurnstileApi;
  }
}

/** The Turnstile site key, or undefined when the deployment has none: then no widget exists and no token is sent. */
export function turnstileSiteKey(): string | undefined {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  return key === undefined || key === '' ? undefined : key;
}

let scriptLoading: Promise<ITurnstileApi> | null = null;

function loadTurnstile(): Promise<ITurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoading ??= new Promise<ITurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('turnstile script failed'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

interface ITurnstileWidgetProps {
  /** Called with a fresh single-use token, or null once it expired or the check failed. */
  readonly onToken: (token: string | null) => void;
}

/** Invisible unless Cloudflare doubts the visitor. Renders nothing at all when no site key is configured. */
export function TurnstileWidget({ onToken }: ITurnstileWidgetProps): React.ReactElement | null {
  const siteKey = turnstileSiteKey();
  return siteKey === undefined ? null : <ActiveWidget siteKey={siteKey} onToken={onToken} />;
}

function ActiveWidget({ siteKey, onToken }: { readonly siteKey: string; readonly onToken: (token: string | null) => void }): React.ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(onToken);
  latest.current = onToken;

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || container.current === null) return;
        widgetId = api.render(container.current, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          callback: (token: string) => latest.current(token),
          'expired-callback': () => latest.current(null),
          'error-callback': () => latest.current(null),
        });
      })
      .catch(() => latest.current(null));
    return () => {
      cancelled = true;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={container} data-testid="turnstile-widget" />;
}
