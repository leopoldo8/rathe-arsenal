/* Rathe Arsenal — Library & CSV Sources pages */

/* Mock card database with pitch/cost/type for visual rendering */
const CARD_DB = [
  { id:'hasty-uprising-r',   name:'Hasty Uprising',   pitch:'R', cost:1, type:'attack-action',   set:'DTD' },
  { id:'hasty-uprising-y',   name:'Hasty Uprising',   pitch:'Y', cost:1, type:'attack-action',   set:'DTD' },
  { id:'snapdragon-scalers', name:'Snapdragon Scalers',pitch:'R',cost:0, type:'equipment',       set:'DYN' },
  { id:'command-conquer-r',  name:'Command and Conquer',pitch:'R',cost:0,type:'attack-action',   set:'WTR' },
  { id:'tome-firebrand',     name:'Tome of Firebrand', pitch:'-',cost:2, type:'equipment',       set:'DYN' },
  { id:'blaze-headlong-y',   name:'Blaze Headlong',   pitch:'Y', cost:0, type:'attack-action',   set:'DYN' },
  { id:'sigil-solace-r',     name:'Sigil of Solace',  pitch:'R', cost:0, type:'instant',         set:'WTR' },
  { id:'kindle-r',           name:'Kindle',           pitch:'R', cost:0, type:'action',          set:'DYN' },
  { id:'kindle-y',           name:'Kindle',           pitch:'Y', cost:0, type:'action',          set:'DYN' },
  { id:'rouse-ancients',     name:'Rouse the Ancients',pitch:'-',cost:4,type:'action',           set:'DYN' },
  { id:'invoke-azvolai-r',   name:'Invoke Azvolai',   pitch:'R', cost:1, type:'action',          set:'DYN' },
  { id:'invoke-kyloria-y',   name:'Invoke Kyloria',   pitch:'Y', cost:1, type:'action',          set:'DYN' },
  { id:'rosetta-thorn-r',    name:'Rosetta Thorn',    pitch:'R', cost:1, type:'instant',         set:'ROS' },
  { id:'flamescale-y',       name:'Flamescale Furnace',pitch:'Y',cost:1, type:'instant',         set:'DYN' },
  { id:'searing-ember-r',    name:'Searing Emberstride',pitch:'R',cost:1,type:'attack-action',   set:'DYN' },
  { id:'dominia-bellower',   name:'Dominia Bellower', pitch:'B', cost:3, type:'ally',            set:'DYN' },
  { id:'plaque-full-moon',   name:'Plaque of the Full Moon',pitch:'-',cost:0,type:'equipment',   set:'ROS' },
  { id:'channel-mount-h',    name:'Channel Mount Heroic',pitch:'B',cost:2,type:'action',         set:'UPR' },
  { id:'sink-below-r',       name:'Sink Below',       pitch:'R', cost:0, type:'defense-reaction',set:'WTR' },
  { id:'briars-call',        name:"Briar's Call",     pitch:'Y', cost:1, type:'action',          set:'EVR' },
  { id:'oaken-old',          name:'Oaken Old',        pitch:'B', cost:3, type:'ally',            set:'EVR' },
  { id:'pummel',             name:'Pummel',           pitch:'Y', cost:0, type:'attack-action',   set:'WTR' },
  { id:'raging-onslaught',   name:'Raging Onslaught', pitch:'R', cost:0, type:'attack-action',   set:'WTR' },
  { id:'unmovable',           name:'Unmovable',        pitch:'B', cost:0, type:'defense-reaction',set:'EVR' },
];

// User library: map of card_id -> [{ source, qty }]
const LIBRARY_MOCK = [
  { card: 'hasty-uprising-r',  ownedFrom: [{ source: 'fabrary-main.csv', qty: 2 }, { source: 'fleshcube-export.csv', qty: 1 }] },
  { card: 'snapdragon-scalers',ownedFrom: [{ source: 'fabrary-main.csv', qty: 3 }] },
  { card: 'command-conquer-r', ownedFrom: [{ source: 'fleshcube-export.csv', qty: 3 }] },
  { card: 'tome-firebrand',    ownedFrom: [{ source: 'fabrary-main.csv', qty: 1 }] },
  { card: 'blaze-headlong-y',  ownedFrom: [{ source: 'fabrary-main.csv', qty: 3 }] },
  { card: 'sigil-solace-r',    ownedFrom: [{ source: 'fabrary-main.csv', qty: 3 }] },
  { card: 'kindle-r',          ownedFrom: [{ source: 'fabrary-main.csv', qty: 2 }, { source: 'store-pickup.csv', qty: 1 }] },
  { card: 'kindle-y',          ownedFrom: [{ source: 'fabrary-main.csv', qty: 3 }] },
  { card: 'rouse-ancients',    ownedFrom: [{ source: 'fleshcube-export.csv', qty: 2 }] },
  { card: 'invoke-kyloria-y',  ownedFrom: [{ source: 'fabrary-main.csv', qty: 2 }] },
  { card: 'flamescale-y',      ownedFrom: [{ source: 'store-pickup.csv', qty: 2 }] },
  { card: 'oaken-old',         ownedFrom: [{ source: 'fabrary-main.csv', qty: 2 }] },
  { card: 'pummel',            ownedFrom: [{ source: 'fabrary-main.csv', qty: 3 }] },
  { card: 'raging-onslaught',  ownedFrom: [{ source: 'fleshcube-export.csv', qty: 3 }] },
  { card: 'unmovable',         ownedFrom: [{ source: 'fabrary-main.csv', qty: 2 }] },
];

const CSV_SOURCES = [
  { id:'s1', name:'fabrary-main.csv',     uploadedAt: '2024-09-14', uniqueCards: 186, totalCopies: 402, active: true  },
  { id:'s2', name:'fleshcube-export.csv', uploadedAt: '2024-10-02', uniqueCards: 94,  totalCopies: 178, active: true  },
  { id:'s3', name:'store-pickup.csv',     uploadedAt: '2024-11-20', uniqueCards: 28,  totalCopies: 46,  active: true  },
  { id:'s4', name:'trade-in-2023.csv',    uploadedAt: '2023-12-08', uniqueCards: 142, totalCopies: 312, active: false },
];

// Enrich mock deck detail cards with pitch/cost/type
function enrichCard(cardFromDeck) {
  const match = CARD_DB.find(c => c.id === cardFromDeck.id) || CARD_DB.find(c => c.name === cardFromDeck.name);
  return { ...cardFromDeck, pitch: match?.pitch || '-', cost: match?.cost, type: match?.type || 'action' };
}

/* ---------------- LIBRARY PAGE ---------------- */

function LibraryPage() {
  const [query, setQuery] = React.useState('');
  const [pitchF, setPitchF] = React.useState('all');
  const [typeF, setTypeF] = React.useState('all');
  const [groupBy, setGroupBy] = React.useState('type');
  const [library, setLibrary] = React.useState(LIBRARY_MOCK);

  const sumQty = (ownedFrom) => ownedFrom.reduce((s, e) => s + e.qty, 0);

  const libWithData = library.map(l => {
    const card = CARD_DB.find(c => c.id === l.card);
    return card ? { ...card, qty: sumQty(l.ownedFrom), sources: l.ownedFrom } : null;
  }).filter(Boolean);

  // Filter
  const filtered = libWithData.filter(c => {
    if (pitchF !== 'all' && c.pitch !== pitchF) return false;
    if (typeF !== 'all' && c.type !== typeF) return false;
    return true;
  });

  // Suggestions only when user is typing something not already owned
  const ownedIds = new Set(library.map(l => l.card));
  const suggestions = query.trim().length >= 2
    ? CARD_DB.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) && !ownedIds.has(c.id)).slice(0, 8)
    : [];

  const addToLibrary = (cardId) => {
    setLibrary(L => [...L, { card: cardId, ownedFrom: [{ source: 'manual-add', qty: 1 }] }]);
    setQuery('');
  };

  // Group for display
  const groups = {};
  filtered.forEach(c => {
    const key = groupBy === 'type' ? c.type : groupBy === 'pitch' ? (c.pitch || '-') : c.set;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  const groupOrder = Object.keys(groups).sort();

  const totalUnique = libWithData.length;
  const totalCopies = libWithData.reduce((s, c) => s + c.qty, 0);
  const totalValue = Math.round(totalCopies * 18.5);
  const pitchBreakdown = ['R','Y','B'].map(p => libWithData.filter(c => c.pitch === p).length);

  const pitchDisplay = (p) => p === 'attack-action' ? 'Attack Action' : p === 'defense-reaction' ? 'Defense Reaction' : p.charAt(0).toUpperCase() + p.slice(1);

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="library"/>
      <main className="app-main full">
        <div className="page-head">
          <div>
            <h1>Library</h1>
            <div className="page-sub">Everything you own, aggregated from your CSVs and manual additions.</div>
          </div>
          <a className="ra-btn ra-btn--ghost" href="#/csv-sources">Manage CSVs →</a>
        </div>

        <div className="lib-stats">
          <div className="lib-stat"><div className="lib-stat__n">{totalUnique}</div><div className="lib-stat__l">Unique cards</div></div>
          <div className="lib-stat"><div className="lib-stat__n">{totalCopies}</div><div className="lib-stat__l">Total copies</div></div>
          <div className="lib-stat"><div className="lib-stat__n">{pitchBreakdown[0]}·{pitchBreakdown[1]}·{pitchBreakdown[2]}</div><div className="lib-stat__l">R · Y · B</div></div>
          <div className="lib-stat"><div className="lib-stat__n">R${totalValue}</div><div className="lib-stat__l">Est. value</div></div>
        </div>

        <div className="lib-head">
          <div className="lib-search">
            <div className="lib-search__input">
              <input
                type="text"
                placeholder="Search by name to add — e.g. Dominia Bellower"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="lib-suggest">
                  {suggestions.map(c => (
                    <div key={c.id} className="lib-suggest__item">
                      <CardArt name={c.name} pitch={c.pitch} cost={c.cost} type={c.type} size="xs"/>
                      <div style={{flex:1, minWidth:0}}>
                        <div className="lib-suggest__name">{c.name}</div>
                        <div className="lib-suggest__meta">
                          {c.pitch !== '-' && <span>Pitch {c.pitch} · </span>}
                          Cost {c.cost} · {pitchDisplay(c.type)} · {c.set}
                        </div>
                      </div>
                      <button className="lib-suggest__add" onClick={() => addToLibrary(c.id)}>+ Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lib-filters">
            <span className="lib-filter-label">Pitch</span>
            <div className="lib-filter-group">
              {['all','R','Y','B','-'].map(p => (
                <button key={p} className={'lib-filter-btn' + (pitchF === p ? ' on' : '')} onClick={() => setPitchF(p)}>
                  {p === 'all' ? 'All' : p === '-' ? 'None' : p}
                </button>
              ))}
            </div>
            <div className="lib-filter-sep"/>
            <span className="lib-filter-label">Type</span>
            <div className="lib-filter-group">
              {['all','attack-action','defense-reaction','action','instant','equipment','ally'].map(t => (
                <button key={t} className={'lib-filter-btn' + (typeF === t ? ' on' : '')} onClick={() => setTypeF(t)}>
                  {t === 'all' ? 'All' : t === 'attack-action' ? 'Attack' : t === 'defense-reaction' ? 'Defense' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="lib-filter-sep"/>
            <span className="lib-filter-label">Group by</span>
            <div className="lib-filter-group">
              {['type','pitch','set'].map(g => (
                <button key={g} className={'lib-filter-btn' + (groupBy === g ? ' on' : '')} onClick={() => setGroupBy(g)}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="lib-empty">No cards match these filters. Loosen them, or search by name above to add.</div>
        ) : groupOrder.map(g => (
          <div key={g} className="lib-list__group">
            <div className="lib-list__group-hd">
              <h3>{groupBy === 'type' ? pitchDisplay(g) : groupBy === 'pitch' ? (g === '-' ? 'No pitch' : 'Pitch ' + g) : g}</h3>
              <span className="count">{groups[g].length} unique · {groups[g].reduce((s,c)=>s+c.qty,0)} copies</span>
            </div>
            <div className="lib-list">
              {groups[g].map(c => (
                <CardChip
                  key={c.id}
                  card={c}
                  qty={c.qty}
                  trailing={
                    <span style={{color: c.sources.length > 1 ? 'var(--ra-accent)' : 'var(--ra-fg-muted)'}}>
                      {c.sources.length > 1 ? `◆ ${c.sources.length} sources` : c.sources[0].source.replace('.csv','').slice(0,12)}
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

/* ---------------- CSV SOURCES PAGE ---------------- */

function CsvSourcesPage() {
  const [sources, setSources] = React.useState(CSV_SOURCES);
  const toggle = (id) => setSources(S => S.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const remove = (id) => setSources(S => S.filter(s => s.id !== id));

  const active = sources.filter(s => s.active);
  const activeCopies = active.reduce((s, x) => s + x.totalCopies, 0);
  const activeUnique = active.reduce((s, x) => s + x.uniqueCards, 0);

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="csv-sources"/>
      <main className="app-main">
        <a className="back-link" href="#/library">← Back to Library</a>
        <div className="page-head">
          <div>
            <h1>CSV sources</h1>
            <div className="page-sub">Every collection file you've imported. Toggle which ones count toward your Library.</div>
          </div>
          <Button variant="primary">+ Upload CSV</Button>
        </div>

        <div className="csv-hero">
          <div className="csv-hero__icon">Σ</div>
          <div className="csv-hero__body">
            <h3>Duplicates are summed, not overwritten</h3>
            <p>
              When the same card appears across multiple active CSVs, we <b>add the quantities</b>.
              Example: <code>fabrary-main.csv</code> has 2× <i>Kindle (R)</i>, <code>store-pickup.csv</code> has 1× — your Library shows <b>3×</b>.
              Toggle a source off to exclude it from every reckoning.
            </p>
          </div>
        </div>

        <div className="lib-stats" style={{marginBottom: 24}}>
          <div className="lib-stat"><div className="lib-stat__n">{active.length}</div><div className="lib-stat__l">Active sources</div></div>
          <div className="lib-stat"><div className="lib-stat__n">{sources.length - active.length}</div><div className="lib-stat__l">Disabled</div></div>
          <div className="lib-stat"><div className="lib-stat__n">{activeUnique.toLocaleString()}</div><div className="lib-stat__l">Rows (pre-dedup)</div></div>
          <div className="lib-stat"><div className="lib-stat__n">{activeCopies.toLocaleString()}</div><div className="lib-stat__l">Copies counted</div></div>
        </div>

        <div className="csv-list">
          {sources.map(s => (
            <div key={s.id} className={'csv-item' + (s.active ? '' : ' inactive')}>
              <div className={'csv-item__toggle' + (s.active ? ' on' : '')} onClick={() => toggle(s.id)} role="button" aria-pressed={s.active}/>
              <div className="csv-item__info">
                <div className="csv-item__name">{s.name}</div>
                <div className="csv-item__meta">Uploaded {s.uploadedAt} · {s.active ? 'counted in Library' : 'excluded'}</div>
              </div>
              <div className="csv-item__count">
                <div className="n">{s.uniqueCards}</div>
                <div className="l">unique</div>
              </div>
              <div className="csv-item__count">
                <div className="n">{s.totalCopies}</div>
                <div className="l">copies</div>
              </div>
              <button className="ra-btn ra-btn--danger ra-btn--sm" onClick={() => remove(s.id)}>Remove</button>
            </div>
          ))}
        </div>

        <div className="csv-dedup-example">
          <h4>◆ How deduplication works</h4>
          <p>When two sources list the same card, we sum. We never silently pick one.</p>
          <div className="csv-dedup-diagram">
            <div className="csv-dedup-src">
              <div className="csv-dedup-src__title">fabrary-main.csv</div>
              <div className="csv-dedup-row"><span>Kindle (R)</span><span className="qty">×2</span></div>
              <div className="csv-dedup-row"><span>Hasty Uprising (R)</span><span className="qty">×2</span></div>
              <div className="csv-dedup-row"><span>Pummel</span><span className="qty">×3</span></div>
            </div>
            <div className="csv-dedup-arrow">→</div>
            <div className="csv-dedup-src">
              <div className="csv-dedup-src__title">store-pickup.csv</div>
              <div className="csv-dedup-row"><span>Kindle (R)</span><span className="qty">×1</span></div>
              <div className="csv-dedup-row"><span>Hasty Uprising (R)</span><span className="qty">×1</span></div>
              <div className="csv-dedup-row"><span>Flamescale Furnace</span><span className="qty">×2</span></div>
            </div>
          </div>
          <div style={{textAlign:'center',margin:'18px 0 10px',fontFamily:'var(--ra-font-display)',color:'var(--ra-accent)',letterSpacing:'0.2em',textTransform:'uppercase',fontSize:11}}>Library</div>
          <div className="csv-dedup-result">
            <div className="csv-dedup-src__title">Your Library (deduplicated)</div>
            <div className="csv-dedup-row"><span>Kindle (R)</span><span className="qty">×3</span></div>
            <div className="csv-dedup-row"><span>Hasty Uprising (R)</span><span className="qty">×3</span></div>
            <div className="csv-dedup-row"><span>Pummel</span><span className="qty">×3</span></div>
            <div className="csv-dedup-row"><span>Flamescale Furnace</span><span className="qty">×2</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { LibraryPage, CsvSourcesPage, CARD_DB, enrichCard });
