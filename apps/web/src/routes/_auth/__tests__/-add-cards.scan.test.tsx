import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { AuthContext, type IAuthContext } from '../../../auth/AuthContext';
import type { ICollectorCodesResponse } from '../../../api/collector-codes';
import type { IOcrEngine } from '../../../components/card-scanner/ocr-engine';
import {
  BROWSER_SCANNER_DEPS,
  ScannerDepsContext,
  type IScannerDeps,
} from '../../../components/card-scanner/scanner-deps';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: Record<string, unknown>) => config,
  useBlocker: () => undefined,
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}));

const FILLER_CODES = Array.from({ length: 201 }, (_, i) => `FIL${String(i).padStart(3, '0')}`);

const CODES_RESPONSE: ICollectorCodesResponse = {
  imageSmallBase: 'https://cdn.test/small/',
  cards: [
    { cardIdentifier: 'nimblism-red', name: 'Nimblism', pitch: 1, printings: [{ code: 'WTR218' }] },
    { cardIdentifier: 'crane-dance-yellow', name: 'Crane Dance', pitch: 2, printings: [{ code: '1HP108' }] },
    { cardIdentifier: 'a-drop-in-the-ocean-blue', name: 'A Drop in the Ocean', pitch: 3, printings: [{ code: 'MST095' }] },
    { cardIdentifier: 'inner-chi-blue', name: 'Inner Chi', pitch: 3, printings: [{ code: 'MST095' }] },
    ...FILLER_CODES.map((code) => ({ cardIdentifier: `filler-${code}`, name: `Filler ${code}`, pitch: null, printings: [{ code }] })),
  ],
};

const codesState = { data: CODES_RESPONSE as ICollectorCodesResponse | undefined, isPending: false, isError: false, refetch: vi.fn() };

vi.mock('../../../api/collector-codes', () => ({
  useCollectorCodesQuery: () => codesState,
}));

import { AddCardsScanPage } from '../add-cards.scan';

interface IHarness {
  readonly deps: IScannerDeps;
  readonly recognize: ReturnType<typeof vi.fn>;
  readonly loadEngine: ReturnType<typeof vi.fn>;
  readonly tick: () => Promise<void>;
  readonly read: (text: string) => Promise<void>;
  readonly scan: (code: string) => Promise<void>;
  readonly leave: () => Promise<void>;
}

let fetchMock: ReturnType<typeof vi.fn>;
let readQueue: string[];
let getUserMedia: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function buildHarness(overrides: Partial<IScannerDeps> = {}): IHarness {
  let scheduledTick: (() => void) | null = null;
  const recognize = vi.fn(async () => readQueue.shift() ?? '');
  const engine: IOcrEngine = { recognize, terminate: vi.fn(async () => undefined) };
  const loadEngine = vi.fn(async () => engine);

  const deps: IScannerDeps = {
    ...BROWSER_SCANNER_DEPS,
    attachStream: vi.fn(),
    captureCard: () => ({ width: 1, height: 1, pixels: new Uint8ClampedArray(1) }),
    loadEngine,
    scheduleTicks: (tick) => {
      scheduledTick = tick;
      return () => {
        scheduledTick = null;
      };
    },
    ...overrides,
  };

  const tick = async (): Promise<void> => {
    await act(async () => {
      scheduledTick?.();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
  };
  const read = async (text: string): Promise<void> => {
    readQueue.push(text);
    await tick();
  };
  const scan = async (code: string): Promise<void> => {
    await read(`EN | ${code} Artist`);
    await read(`EN | ${code} Artist`);
  };
  const leave = async (): Promise<void> => {
    await read('');
    await read('');
    await read('');
  };
  return { deps, recognize, loadEngine, tick, read, scan, leave };
}

function renderScanner(deps: IScannerDeps): ReturnType<typeof render> {
  const authValue = { token: 'test-jwt', user: null, isLoading: false } as unknown as IAuthContext;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <AuthContext.Provider value={authValue}>
      <QueryClientProvider client={queryClient}>
        <ScannerDepsContext.Provider value={deps}>
          <AddCardsScanPage />
        </ScannerDepsContext.Provider>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

async function renderReady(overrides: Partial<IScannerDeps> = {}): Promise<IHarness> {
  const harness = buildHarness(overrides);
  renderScanner(harness.deps);
  await waitFor(() => expect(screen.queryByText('Getting the scanner ready…')).not.toBeInTheDocument());
  return harness;
}

function barCount(): string {
  return screen.getByTestId('scanner-bar-count').textContent ?? '';
}

function confirmButtons(): HTMLElement[] {
  return screen.getAllByRole('button', { name: 'Add to library' });
}

function batchCalls(): unknown[][] {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/collection/cards/batch'));
}

beforeEach(async () => {
  await setTestLocale('en-US');
  readQueue = [];
  codesState.data = CODES_RESPONSE;
  codesState.isError = false;
  getUserMedia = vi.fn(async () => ({ getTracks: () => [] }) as unknown as MediaStream);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/api/catalog/search')) {
      return jsonResponse(200, {
        results: [
          {
            cardIdentifier: 'crane-dance-yellow',
            name: 'Crane Dance',
            pitch: 2,
            classes: [],
            types: [],
            ownedQuantity: 0,
            imageUrl: null,
            legalFormats: [],
            legalHeroes: [],
            bannedFormats: [],
          },
        ],
      });
    }
    return jsonResponse(201, { results: [], recomputedDeckCount: 0 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/add-cards/scan', () => {
  it('opens the rear camera with the guide and hint', async () => {
    const harness = buildHarness();
    renderScanner(harness.deps);

    await waitFor(() => expect(harness.deps.attachStream).toHaveBeenCalled());
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: 'environment' }) }),
    );
    expect(document.querySelector('video')).toBeInTheDocument();
    expect(screen.getByTestId('card-guide')).toBeInTheDocument();
    expect(screen.getByText('Line up the bottom edge of the card with the guide.')).toBeInTheDocument();
  });

  it('shows loading and does not recognize while the engine downloads', async () => {
    const harness = buildHarness({ loadEngine: () => new Promise<IOcrEngine>(() => undefined) });
    renderScanner(harness.deps);

    expect(await screen.findByText('Getting the scanner ready…')).toBeInTheDocument();
    await harness.tick();
    expect(harness.recognize).not.toHaveBeenCalled();
  });

  it('shows a scan notice for the accepted card', async () => {
    const harness = await renderReady();

    await harness.scan('WTR218');
    await harness.leave();
    await harness.scan('WTR218');

    const notice = screen.getByTestId('scan-notice');
    expect(within(notice).getByText('Nimblism')).toBeInTheDocument();
    expect(within(notice).getByRole('img', { name: /red/i })).toBeInTheDocument();
    expect(notice.querySelector('img[src="https://cdn.test/small/WTR218.webp"]')).toBeInTheDocument();
    expect(within(notice).getByText('× 2 in the list')).toBeInTheDocument();
    expect(within(notice).getByRole('button', { name: /Undo the scan of Nimblism/ })).toHaveTextContent('Wrong');
  });

  it('names both faces in the notice', async () => {
    const harness = await renderReady();

    await harness.scan('MST095');

    expect(within(screen.getByTestId('scan-notice')).getByText('A Drop in the Ocean / Inner Chi')).toBeInTheDocument();
  });

  it('replaces the notice on the next scan', async () => {
    const harness = await renderReady();

    await harness.scan('WTR218');
    await harness.scan('1HP108');

    const notices = screen.getAllByTestId('scan-notice');
    expect(notices).toHaveLength(1);
    expect(within(notices[0]!).getByText('Crane Dance')).toBeInTheDocument();
  });

  it('hides the notice after 4 seconds', async () => {
    const harness = await renderReady();
    vi.useFakeTimers();

    await harness.scan('WTR218');
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByTestId('scan-notice')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('scan-notice')).not.toBeInTheDocument();
  });

  it('Wrong drops the bar count by one', async () => {
    const harness = await renderReady();
    await harness.scan('WTR218');
    await harness.leave();
    await harness.scan('WTR218');
    expect(barCount()).toBe('2 cards');

    fireEvent.click(screen.getByRole('button', { name: /Undo the scan of Nimblism/ }));

    expect(barCount()).toBe('1 card');
  });

  it('offers search for 5 seconds after Wrong', async () => {
    const harness = await renderReady();
    vi.useFakeTimers();
    await harness.scan('WTR218');

    fireEvent.click(screen.getByRole('button', { name: /Undo the scan of Nimblism/ }));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(within(screen.getByTestId('scan-notice')).getByText('Removed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search by name' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('scan-notice')).not.toBeInTheDocument();
  });

  async function openSearchAfterWrong(harness: IHarness): Promise<void> {
    await harness.scan('WTR218');
    fireEvent.click(screen.getByRole('button', { name: /Undo the scan of Nimblism/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Search by name' }));
    await screen.findByRole('dialog', { name: 'Which card was it?' });
  }

  it('pauses recognition while the search is open', async () => {
    const harness = await renderReady();
    await openSearchAfterWrong(harness);
    const callsBefore = harness.recognize.mock.calls.length;

    await userEvent.type(screen.getByRole('searchbox'), 'Crane');
    await harness.tick();
    await harness.tick();

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/catalog/search?q=Crane'))).toBe(true),
    );
    expect(harness.recognize.mock.calls.length).toBe(callsBefore);
  });

  it('adds the picked card and resumes', async () => {
    const harness = await renderReady();
    await openSearchAfterWrong(harness);
    await userEvent.type(screen.getByRole('searchbox'), 'Crane');

    fireEvent.click(await screen.findByRole('button', { name: /Crane Dance/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(barCount()).toBe('1 card');
    const callsAfterClose = harness.recognize.mock.calls.length;
    await harness.tick();
    expect(harness.recognize).toHaveBeenCalledTimes(callsAfterClose + 1);
  });

  it('closing the search changes nothing', async () => {
    const harness = await renderReady();
    await openSearchAfterWrong(harness);
    const callsBefore = harness.recognize.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await harness.tick();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(barCount()).toBe('Point the camera at a card');
    expect(harness.recognize.mock.calls.length).toBe(callsBefore + 1);
  });

  it('bar sums the tray and opens the review', async () => {
    const harness = await renderReady();
    await harness.scan('WTR218');
    await harness.leave();
    await harness.scan('WTR218');
    await harness.scan('1HP108');

    expect(barCount()).toBe('3 cards');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog', { name: 'Scanned cards' });
    expect(within(dialog).getAllByTestId('review-row')).toHaveLength(2);
  });

  it('review row bounds its stepper', async () => {
    const harness = await renderReady();
    await harness.scan('WTR218');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Scanned cards' });
    const row = within(dialog).getByTestId('review-row');

    expect(row.querySelector('img[src="https://cdn.test/small/WTR218.webp"]')).toBeInTheDocument();
    expect(within(row).getByText('Nimblism')).toBeInTheDocument();
    expect(within(row).getByRole('img', { name: /red/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Decrease Nimblism' })).toBeDisabled();
    for (let i = 0; i < 19; i += 1) fireEvent.click(within(row).getByRole('button', { name: 'Increase Nimblism' }));
    expect(within(row).getByText('20')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Increase Nimblism' })).toBeDisabled();

    fireEvent.click(within(row).getByRole('button', { name: 'Remove Nimblism' }));
    expect(within(dialog).queryByTestId('review-row')).not.toBeInTheDocument();
  });

  it('asks which face of a double-faced card', async () => {
    const harness = await renderReady();
    await harness.scan('MST095');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const row = within(await screen.findByRole('dialog', { name: 'Scanned cards' })).getByTestId('review-row');

    expect(within(row).getByText('Which face?')).toBeInTheDocument();
    fireEvent.click(within(within(row).getByRole('group', { name: 'Which face?' })).getByRole('button', { name: /Inner Chi/ }));

    expect(within(row).queryByText('Which face?')).not.toBeInTheDocument();
    expect(within(row).getByText('Inner Chi')).toBeInTheDocument();
    expect(within(row).queryByText('A Drop in the Ocean')).not.toBeInTheDocument();
  });

  it('confirm waits for every face pick', async () => {
    const harness = await renderReady();
    await harness.scan('MST095');

    for (const button of confirmButtons()) expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const row = within(await screen.findByRole('dialog', { name: 'Scanned cards' })).getByTestId('review-row');
    fireEvent.click(within(within(row).getByRole('group', { name: 'Which face?' })).getByRole('button', { name: /Inner Chi/ }));

    for (const button of confirmButtons()) expect(button).toBeEnabled();
  });

  it('shows the tray-full message', async () => {
    const harness = await renderReady();
    for (const code of FILLER_CODES.slice(0, 200)) await harness.scan(code);
    expect(barCount()).toBe('200 cards');

    await harness.scan(FILLER_CODES[200]!);

    expect(
      within(screen.getByTestId('scan-notice')).getByText(
        'The list reached 200 cards. Add these to your library before going on.',
      ),
    ).toBeInTheDocument();
    expect(barCount()).toBe('200 cards');
  }, 30_000);

  it('empty tray disables confirm', async () => {
    await renderReady();

    expect(barCount()).toBe('Point the camera at a card');
    expect(confirmButtons()[0]).toBeDisabled();
  });

  it('shows permission denied', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    renderScanner(buildHarness().deps);

    expect(await screen.findByText('No camera access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search by name' })).toHaveAttribute('href', '/add-cards/manual');
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });

  it.each([
    ['mediaDevices undefined', (): void => {
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    }],
    ['NotFoundError', (): void => {
      getUserMedia.mockRejectedValue(Object.assign(new Error('none'), { name: 'NotFoundError' }));
    }],
  ])('shows no camera: %s', async (_label, arrange) => {
    arrange();
    renderScanner(buildHarness().deps);

    expect(await screen.findByText('No camera found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search by name' })).toHaveAttribute('href', '/add-cards/manual');
  });

  it('engine failure offers retry and keeps the tray', async () => {
    const harness = buildHarness();
    const workingLoader = harness.deps.loadEngine;
    const loadEngine = vi
      .fn<IScannerDeps['loadEngine']>()
      .mockRejectedValueOnce(new Error('download failed'))
      .mockImplementation(workingLoader);
    renderScanner({ ...harness.deps, loadEngine });

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('The scanner could not load.')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Getting the scanner ready…')).not.toBeInTheDocument());
    expect(loadEngine).toHaveBeenCalledTimes(2);

    await harness.scan('WTR218');
    harness.recognize.mockRejectedValueOnce(new Error('worker crashed'));

    await harness.tick();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByText('The scanner could not load.')).toBeInTheDocument();
    expect(barCount()).toBe('1 card');
    fireEvent.click(retry);

    await waitFor(() => expect(loadEngine).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByText('The scanner could not load.')).not.toBeInTheDocument());
    expect(barCount()).toBe('1 card');
  });

  it('cancels beforeunload with a non-empty tray', async () => {
    const harness = await renderReady();
    await harness.scan('WTR218');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('renders in both locales', async () => {
    await setTestLocale('pt-BR');
    const { unmount } = renderScanner(buildHarness().deps);
    const ptHint = (await screen.findByText('Alinhe a borda de baixo da carta com a guia.')).textContent;
    unmount();

    await setTestLocale('en-US');
    renderScanner(buildHarness().deps);
    const enHint = (await screen.findByText('Line up the bottom edge of the card with the guide.')).textContent;
    expect(ptHint).not.toBe(enHint);
  });

  it('commits the whole tray in one request', async () => {
    const harness = await renderReady();
    await harness.scan('WTR218');
    await harness.leave();
    await harness.scan('WTR218');
    await harness.scan('1HP108');

    fireEvent.click(confirmButtons()[0]!);

    await waitFor(() => expect(batchCalls()).toHaveLength(1));
    const [, init] = batchCalls()[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body)).items).toEqual(
      expect.arrayContaining([
        { cardIdentifier: 'nimblism-red', quantity: 2 },
        { cardIdentifier: 'crane-dance-yellow', quantity: 1 },
      ]),
    );
    expect(JSON.parse(String(init.body)).items).toHaveLength(2);
  });

  it('summarizes a successful commit', async () => {
    const harness = await renderReady();
    await harness.scan('WTR218');
    await harness.leave();
    await harness.scan('WTR218');
    await harness.scan('1HP108');

    fireEvent.click(confirmButtons()[0]!);

    expect(await screen.findByText('3 cards added')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open library' })).toHaveAttribute('href', '/library');
    expect(barCount()).toBe('Point the camera at a card');
  });

  it('names capped cards', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(201, {
        results: [{ cardIdentifier: 'nimblism-red', newQuantity: 20, capped: true }],
        recomputedDeckCount: 0,
      }),
    );
    const harness = await renderReady();
    await harness.scan('WTR218');

    fireEvent.click(confirmButtons()[0]!);

    expect(await screen.findByText('Limited to 20 copies: Nimblism')).toBeInTheDocument();
  });

  it('keeps the tray when the commit fails', async () => {
    fetchMock.mockImplementationOnce(async () => jsonResponse(500, { message: 'boom' }));
    const harness = await renderReady();
    await harness.scan('WTR218');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Scanned cards' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to library' }));

    expect(await within(dialog).findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(within(dialog).getAllByTestId('review-row')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(batchCalls()).toHaveLength(2));
    const bodies = batchCalls().map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it('localizes INVALID_CARD_IDENTIFIER', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(400, { success: false, statusCode: 400, error: 'x', code: 'INVALID_CARD_IDENTIFIER' }),
    );
    const harness = await renderReady();
    await harness.scan('WTR218');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Scanned cards' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to library' }));

    expect(await within(dialog).findByText('One of the cards is not in the catalog.')).toBeInTheDocument();
  });
});
