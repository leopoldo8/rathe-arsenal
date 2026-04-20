/* Rathe Arsenal — shared shell (brand SVG + Header + mock data) */

/* ============================================================
   DECKBOX SVG  —  exact port of preview/brand-logo.html
   ============================================================ */
const DeckboxDefs = () => (
  <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true">
    <defs>
      <linearGradient id="box-front" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7a2222"/>
        <stop offset="60%" stopColor="#5a1a1a"/>
        <stop offset="100%" stopColor="#3a0f0f"/>
      </linearGradient>
      <linearGradient id="box-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3a0f0f"/>
        <stop offset="100%" stopColor="#2a0808"/>
      </linearGradient>
      <linearGradient id="lid-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a2222"/>
        <stop offset="100%" stopColor="#4a1414"/>
      </linearGradient>
      <linearGradient id="card-base-shadow" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stopColor="#000" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#000" stopOpacity="0"/>
      </linearGradient>
      <clipPath id="above-rim" clipPathUnits="userSpaceOnUse">
        <polygon points="-10,-10 110,-10 110,24 72,24 60,32 24,36 -10,36"/>
      </clipPath>
      <clipPath id="clip-card-back" clipPathUnits="userSpaceOnUse">
        <path d="M36 34.9 L 72 30.9 L 72 2 L 36 6 Z"/>
      </clipPath>
      <clipPath id="clip-card-middle" clipPathUnits="userSpaceOnUse">
        <path d="M30 35.6 L 66 31.6 L 66 8 L 30 12 Z"/>
      </clipPath>
      <clipPath id="clip-card-front" clipPathUnits="userSpaceOnUse">
        <path d="M24 36 L 60 32 L 60 14 L 24 18 Z"/>
      </clipPath>
      <symbol id="deckbox" viewBox="0 0 104 104" overflow="visible">
        <path d="M36 28 L 72 24 L 72 96 L 36 96 Z" fill="#3a0f0f" stroke="#d69e2e" strokeWidth="0.6"/>
        <path d="M60 32 L 72 24 L 72 96 L 60 96 Z" fill="url(#box-side)" stroke="#d69e2e" strokeWidth="0.8"/>
        <path d="M24 36 L 60 32 L 60 96 L 24 96 Z" fill="url(#box-front)" stroke="#d69e2e" strokeWidth="1"/>
        <path d="M27 41 L 57 37 L 57 92 L 27 92 Z" fill="none" stroke="#d69e2e" strokeWidth="0.5" opacity="0.75"/>
        <text x="42" y="72" textAnchor="middle" fontFamily="UnifrakturCook, serif" fontWeight="700" fontSize="26" fill="#d69e2e">R</text>
        <path d="M36 28 L 72 24 L 78 12 L 42 16 Z" fill="#3a0f0f" stroke="#d69e2e" strokeWidth="0.8"/>
        <path d="M42 16 L 78 12 L 78 6 L 42 10 Z" fill="url(#lid-top)" stroke="#d69e2e" strokeWidth="0.8"/>
        <path d="M38.5 26.5 L 70.5 23 L 75 14 L 44 17.5 Z" fill="none" stroke="#d69e2e" strokeWidth="0.35" opacity="0.55"/>
        <path d="M24 36 L 60 32 L 72 24 L 36 28 Z" fill="#120303" stroke="#d69e2e" strokeWidth="0.9"/>
        <path d="M27 35.2 L 58 31.5 L 69 24.9 L 38 28.6 Z" fill="none" stroke="#d69e2e" strokeWidth="0.3" opacity="0.55"/>
        <g clipPath="url(#above-rim)">
          <g clipPath="url(#clip-card-back)">
            <path d="M36 34.9 L 72 30.9 L 72 2 L 36 6 Z" fill="#faf3e0" stroke="#b5a67c" strokeWidth="0.45"/>
            <path d="M36 34.9 L 72 30.9 L 72 28.9 L 36 32.9 Z" fill="url(#card-base-shadow)"/>
          </g>
          <g clipPath="url(#clip-card-middle)">
            <path d="M30 35.6 L 66 31.6 L 66 8 L 30 12 Z" fill="#f0e6cc" stroke="#b5a67c" strokeWidth="0.45"/>
            <path d="M30 35.6 L 66 31.6 L 66 29.6 L 30 33.6 Z" fill="url(#card-base-shadow)"/>
          </g>
          <g clipPath="url(#clip-card-front)">
            <path d="M24 36 L 60 32 L 60 14 L 24 18 Z" fill="#faf3e0" stroke="#b5a67c" strokeWidth="0.5"/>
            <path d="M24 36 L 60 32 L 60 30 L 24 34 Z" fill="url(#card-base-shadow)"/>
          </g>
        </g>
      </symbol>
    </defs>
  </svg>
);

function Brand({ size = 'md', markOnly = false }) {
  const cls = `brand ${size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : ''}`;
  const icoCls = size === 'sm' ? 'brand-ico sm' : size === 'lg' ? 'brand-ico lg' : 'brand-ico';
  return (
    <a className={cls} href="#/">
      <svg className={icoCls} viewBox="0 0 104 104"><use href="#deckbox"/></svg>
      {!markOnly && (
        <div className="brand-words">
          <div className="brand-rathe">Rathe</div>
          <div className="brand-arsenal">Arsenal</div>
        </div>
      )}
    </a>
  );
}

/* ============================================================
   HEADER
   ============================================================ */

function Header({ currentPage, user }) {
  const signedIn = Boolean(user);
  return (
    <header className="app-header">
      <Brand size="sm"/>
      {signedIn && (
        <nav className="header-nav">
          <a className={currentPage === 'home' ? 'active' : ''} href="#/home">Decks</a>
          <a className={currentPage === 'collection' ? 'active' : ''} href="#/collection">Collection</a>
          <a className={currentPage === 'reviews' ? 'active' : ''} href="#/reviews">Reviews</a>
          <a className={currentPage === 'import' ? 'active' : ''} href="#/import">Import</a>
        </nav>
      )}
      <span className="header-spacer" />
      {signedIn ? (
        <>
          <span className="header-email hide-800">{user.email}</span>
          <a className="header-icon-btn" href="#/settings" title="Settings" aria-label="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
            </svg>
          </a>
        </>
      ) : (
        <>
          <a className="ra-link" href="#/sign-in">Sign in</a>
          <a className="ra-btn ra-btn--primary ra-btn--sm" href="#/sign-up">Get started</a>
        </>
      )}
    </header>
  );
}

/* ============================================================
   MOCK DATA
   ============================================================ */

const MOCK_USER = { email: 'leopoldo@rathe.gg', verified: true };

// Richer mock with hero class + Have/Sub/Missing counts
const MOCK_DECKS = [
  { id:1, name:'Iyslander, Stormbind',        hero:'Iyslander', heroClass:'wizard',     format:'Classic Constructed', readiness:87, raw:82, have:54, sub:4,  miss:2 },
  { id:2, name:'Dromai, Ash Artist',          hero:'Dromai',    heroClass:'illusionist',format:'Classic Constructed', readiness:71, raw:58, have:42, sub:5,  miss:8 },
  { id:3, name:'Briar, Warden of Thorns',     hero:'Briar',     heroClass:'runeblade',  format:'Classic Constructed', readiness:92, raw:89, have:58, sub:2,  miss:1 },
  { id:4, name:'Kassai, Cintari Sellsword',   hero:'Kassai',    heroClass:'warrior',    format:'Blitz',               readiness:64, raw:52, have:32, sub:8,  miss:14 },
  { id:5, name:'Prism, Sculptor of Arc Light',hero:'Prism',     heroClass:'illusionist',format:'Classic Constructed', readiness:43, raw:38, have:28, sub:6,  miss:24 },
  { id:6, name:'Oldhim, Grandfather of Eons', hero:'Oldhim',    heroClass:'guardian',   format:'Classic Constructed', readiness:85, raw:79, have:52, sub:5,  miss:3 },
  { id:7, name:'Fai, Rising Rebellion',       hero:'Fai',       heroClass:'ninja',      format:'Blitz',               readiness:31, raw:26, have:18, sub:4,  miss:28 },
  { id:8, name:'Kayo, Berserker Runt',        hero:'Kayo',      heroClass:'brute',      format:'Blitz',               readiness:58, raw:51, have:30, sub:6,  miss:14 },
];

const MOCK_DECK_DETAIL = {
  id: 2, name: 'Dromai, Ash Artist', hero: 'Dromai', heroClass: 'illusionist',
  format: 'Classic Constructed',
  ulid: '01JA7RDROMAI02',
  readiness: 71, raw: 58,
  have: 42, sub: 5, miss: 8,
  rejectionCount: 0,
  fidelity: 97,
  path: 'B',
  exact: [
    { id:'hasty-uprising-r',  name:'Hasty Uprising (R)',   qty:3, slot:'main' },
    { id:'snapdragon',        name:'Snapdragon Scalers',   qty:3, slot:'main' },
    { id:'command-conquer-r', name:'Command and Conquer (R)', qty:3, slot:'main' },
    { id:'tome-firebrand',    name:'Tome of Firebrand',    qty:1, slot:'main' },
    { id:'blaze-headlong-y',  name:'Blaze Headlong (Y)',   qty:3, slot:'main' },
    { id:'sigil-solace-r',    name:'Sigil of Solace (R)',  qty:3, slot:'main' },
    { id:'kindle-r',          name:'Kindle (R)',           qty:3, slot:'main' },
    { id:'rouse-ancients',    name:'Rouse the Ancients',   qty:2, slot:'main' },
  ],
  substituted: [
    {
      id: 's1',
      original:  { name: 'Invoke Azvolai',      pitch:'R', qty: 2, slot: 'main' },
      proxy:     { name: 'Invoke Kyloria',      pitch:'Y', qty: 2, available: 2 },
      tier: 1, score: 92,
      rationale: 'Same card family. Yellow pitch substitutes for red. Preserves curve on turn-2 attack actions.',
    },
    {
      id: 's2',
      original:  { name: 'Rosetta Thorn',       pitch:'R', qty: 1, slot: 'main' },
      proxy:     { name: 'Flamescale Furnace',  pitch:'Y', qty: 1, available: 2 },
      tier: 2, score: 78,
      rationale: 'Alternate 1-cost arcane enabler. Loses on-hit trigger but keeps board tempo.',
    },
    {
      id: 's3',
      original:  { name: 'Searing Emberstride', pitch:'R', qty: 2, slot: 'main' },
      proxy:     { name: 'Kindle (Y)',          pitch:'Y', qty: 2, available: 3 },
      tier: 1, score: 88,
      rationale: 'Drops a pitch value but preserves arcane damage count. Safe swap on most hands.',
    },
  ],
  missing: [
    { id:'dominia-bellower',  name:'Dominia Bellower',           qty: 2, slot: 'main', price: 4800 },
    { id:'plaque-full-moon',  name:'Plaque of the Full Moon',    qty: 1, slot: 'main', price: 3200 },
    { id:'channel-mount-h',   name:'Channel Mount Heroic',       qty: 3, slot: 'main', price: 2100 },
    { id:'sink-below-r',      name:'Sink Below (R)',             qty: 1, slot: 'main', price: 1800 },
    { id:'briars-call',       name:'Briar\'s Call',              qty: 1, slot: 'main', price: 1290 },
  ],
};

const AGG_SHOPPING = {
  totalCents: 31200, completable: 4, total: 6, storeName: 'Cúpula DT',
};

const META_DECKS = [
  { id:'m1', name:'Jaw-Dropping Briar',       hero:'Briar',     heroClass:'runeblade',  format:'CC',    tier:'S', buildPct:'78%' },
  { id:'m2', name:'Iyslander Arcane Control', hero:'Iyslander', heroClass:'wizard',     format:'CC',    tier:'S', buildPct:'62%' },
  { id:'m3', name:'Dash I/O Turbo',           hero:'Dash I/O',  heroClass:'mechanologist',format:'Blitz',tier:'A', buildPct:'55%' },
  { id:'m4', name:'Uzuri Stealth',            hero:'Uzuri',     heroClass:'assassin',   format:'CC',    tier:'A', buildPct:'48%' },
];

function formatBrl(cents) {
  const reais = Math.round(cents / 100);
  return `R$ ${reais.toLocaleString('pt-BR')}`;
}
function readyClass(p) {
  if (p >= 80) return 'high';
  if (p >= 50) return 'mid';
  return 'low';
}

/* ============================================================
   PRIMITIVE COMPONENTS
   ============================================================ */

function Button({ children, variant='primary', size='md', as, href, ...rest }) {
  const cls = `ra-btn ra-btn--${variant}${size !== 'md' ? ' ra-btn--' + size : ''}`;
  if (as === 'a' || href) return <a className={cls} href={href} {...rest}>{children}</a>;
  return <button className={cls} {...rest}>{children}</button>;
}

function Input({ label, error, hint, ...rest }) {
  return (
    <div className="ra-field">
      {label && <label className="ra-label">{label}</label>}
      <input className={'ra-input' + (error ? ' error' : '')} {...rest}/>
      {error && <div style={{color:'var(--ra-ready-low)',fontSize:12,fontFamily:'var(--ra-font-mono)'}}>{error}</div>}
      {hint && !error && <div style={{color:'var(--ra-fg-muted)',fontSize:12}}>{hint}</div>}
    </div>
  );
}

function Banner({ kind='info', strong, children, action }) {
  return (
    <div className={`ra-banner ra-banner--${kind}`} role="status">
      {strong && <strong>{strong}</strong>}
      <span>{children}</span>
      {action && <span className="ra-banner-action">{action}</span>}
    </div>
  );
}

/* ============================================================
   DECK CARD  —  faithful to preview/components-deck-card.html
   ============================================================ */

function DeckCard({ deck, onOpen, onUntrack }) {
  const rc = readyClass(deck.readiness);
  return (
    <div className="ra-deck" onClick={() => onOpen && onOpen(deck.id)}>
      <div className={`ra-deck__hero ra-hero--${deck.heroClass}`}>
        <div className="ra-deck__tag">{deck.hero}{deck.heroClass ? ' · ' + deck.heroClass : ''}</div>
      </div>
      <div className="ra-deck__body">
        <div className="ra-deck__title">{deck.name}</div>
        <div className="ra-deck__meta">{deck.format}</div>
        <div className="ra-deck__ready">
          <div className={`ra-deck__pct ${rc}`}>
            <span>{deck.readiness}</span><span className="sym">%</span>
          </div>
          <div className="ra-deck__pct-label">Ready</div>
        </div>
        <div className="ra-deck__bar"><div className="ra-deck__bar-fill" style={{'--pct': deck.readiness + '%'}}/></div>
        <div className="ra-deck__counts">
          <div className="ra-count ra-count--have"><span className="n">{deck.have}</span><span className="l">Have</span></div>
          <div className="ra-count ra-count--sub"><span className="n">{deck.sub}</span><span className="l">Sub</span></div>
          <div className="ra-count ra-count--miss"><span className="n">{deck.miss}</span><span className="l">Missing</span></div>
        </div>
        <div className="ra-deck__footer">
          <button className="ra-deck__untrack" onClick={(e) => { e.stopPropagation(); onUntrack && onUntrack(deck.id); }}>Untrack</button>
          <span className="ra-deck__view">View →</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SUBSTITUTION ROW  —  faithful to preview/components-substitution.html
   ============================================================ */

function SubRow({ row, rejected, onReject, onRestore }) {
  // Enrich with card-art metadata
  const origDb = typeof CARD_DB !== 'undefined' ? CARD_DB.find(c => c.name === row.original.name || (c.pitch === row.original.pitch && c.name.startsWith(row.original.name.split(' (')[0]))) : null;
  const proxyDb = typeof CARD_DB !== 'undefined' ? CARD_DB.find(c => c.name === row.proxy.name || (c.pitch === row.proxy.pitch && c.name.startsWith(row.proxy.name.split(' (')[0]))) : null;
  const origType = origDb?.type || 'action';
  const proxyType = proxyDb?.type || 'action';
  const origCost = origDb?.cost;
  const proxyCost = proxyDb?.cost;
  return (
    <div className={'ra-sub' + (rejected ? ' pending' : '')}>
      <div className="ra-sub__chip ra-sub__chip--orig">
        <div className="ra-sub__stripe"/>
        {typeof CardArt !== 'undefined' && (
          <CardArt name={row.original.name} pitch={row.original.pitch} cost={origCost} type={origType} size="xs" missing/>
        )}
        <div className="ra-sub__body">
          <div className="ra-sub__name">{row.original.name}</div>
          <div className="ra-sub__meta"><span className="ra-tag ra-tag--miss">Missing</span>×{row.original.qty} · {row.original.slot}</div>
        </div>
      </div>
      <div className={`ra-sub__rail ${row.tier === 2 ? 'ra-tier--2' : row.tier === 3 ? 'ra-tier--3' : ''}`}>
        <div className="ra-tier"><span className="ra-tier__num"><span>{row.tier}</span></span>TIER</div>
        <div className="ra-sub__arrow">→</div>
        <div className="ra-confidence" style={{'--pct': row.score + '%'}}/>
        <div className="ra-confidence__text">{row.score}%</div>
      </div>
      <div className="ra-sub__chip ra-sub__chip--proxy">
        {typeof CardArt !== 'undefined' && (
          <CardArt name={row.proxy.name} pitch={row.proxy.pitch} cost={proxyCost} type={proxyType} size="xs"/>
        )}
        <div className="ra-sub__body">
          <div className="ra-sub__name">{row.proxy.name}</div>
          <div className="ra-sub__meta"><span className="ra-tag ra-tag--have">In library</span>×{row.proxy.available} available</div>
        </div>
        {rejected ? (
          <button className="ra-sub__reject" onClick={() => onRestore && onRestore(row.id)} title="Restore">↺</button>
        ) : (
          <button className="ra-sub__reject" onClick={() => onReject && onReject(row.id)} aria-label="Reject">×</button>
        )}
        <div className="ra-sub__stripe"/>
      </div>
      <div className="ra-sub__rationale">{row.rationale}</div>
    </div>
  );
}

/* ============================================================
   MODAL
   ============================================================ */

function Modal({ open, title, children, onClose, danger }) {
  if (!open) return null;
  return (
    <div className="ra-modal-backdrop" onClick={onClose}>
      <div className="ra-modal" onClick={(e) => e.stopPropagation()} style={danger ? {} : {}}>
        {title && <h2 style={!danger ? {color:'var(--ra-fg-primary)'} : {}}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  DeckboxDefs, Brand, Header,
  MOCK_USER, MOCK_DECKS, MOCK_DECK_DETAIL, AGG_SHOPPING, META_DECKS,
  formatBrl, readyClass,
  Button, Input, Banner, DeckCard, SubRow, Modal,
});
