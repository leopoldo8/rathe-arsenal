/* Rathe Arsenal — app pages (Home, Import, Deck detail, Onboarding, Settings, Collection, Reviews) */

/* ---------------- HOME (empty) ---------------- */

function HomeEmpty() {
  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="home"/>
      <main className="app-main narrow">
        <div className="empty-home">
          <Brand size="lg" markOnly/>
          <h1>Welcome, Hero.</h1>
          <p>Your armory is empty. Track a deck to see how ready your collection is — we'll surface owned cards, valid substitutes, and exactly what's missing.</p>
          <div className="empty-home__steps">
            <div className="empty-step">
              <div className="empty-step__n">01</div>
              <h4>Paste a deck</h4>
              <p>From Fabrary, or pick a meta deck we've indexed.</p>
            </div>
            <div className="empty-step">
              <div className="empty-step__n">02</div>
              <h4>Confirm your library</h4>
              <p>We'll cross-reference against your uploaded collection.</p>
            </div>
            <div className="empty-step">
              <div className="empty-step__n">03</div>
              <h4>See readiness</h4>
              <p>Approve or reject each substitution. Buy what's left.</p>
            </div>
          </div>
          <Button variant="primary" size="lg" href="#/import" as="a">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2.5v11l5-1 5 1v-11l-5 1-5-1z"/><path d="M8 6v5m-2-2.5L8 11l2-2.5"/>
            </svg>
            Track your first deck
          </Button>
        </div>
      </main>
    </div>
  );
}

/* ---------------- HOME (populated) — shelf layout ---------------- */

function HomePopulated() {
  const [decks, setDecks] = React.useState(MOCK_DECKS);
  const ready = decks.filter(d => d.readiness >= 80);
  const almost = decks.filter(d => d.readiness >= 50 && d.readiness < 80);
  const build = decks.filter(d => d.readiness < 50);

  const onUntrack = (id) => setDecks(ds => ds.filter(d => d.id !== id));
  const onOpen = (id) => { location.hash = '#/decks/' + id; };

  const avgReady = Math.round(decks.reduce((s,d)=>s+d.readiness, 0) / (decks.length || 1));
  const totalMissing = decks.reduce((s,d)=>s+d.miss, 0);

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="home"/>
      <main className="app-main full">

        <div className="home-hero">
          <div className="home-hero__left">
            <div className="ra-eyebrow accent">Your armory</div>
            <h1>Good to see you, Leopoldo.</h1>
            <p>{ready.length} decks ready to play · {almost.length} almost there · {build.length} to build.</p>
          </div>
          <div className="home-hero__stats">
            <div className="home-stat">
              <div className="home-stat__n">{decks.length}</div>
              <div className="home-stat__l">Decks</div>
            </div>
            <div className="home-stat">
              <div className="home-stat__n">{avgReady}%</div>
              <div className="home-stat__l">Avg Ready</div>
            </div>
            <div className="home-stat">
              <div className="home-stat__n">{totalMissing}</div>
              <div className="home-stat__l">Missing</div>
            </div>
            <div style={{alignSelf:'center',marginLeft:12}}>
              <Button variant="primary" href="#/import" as="a">+ Import</Button>
            </div>
          </div>
        </div>

        <Banner kind="info" strong={formatBrl(AGG_SHOPPING.totalCents)}>
          would complete {AGG_SHOPPING.completable} of {AGG_SHOPPING.total} decks on {AGG_SHOPPING.storeName}.
          <a href="#/reviews" className="ra-link" style={{marginLeft:'auto'}}>See breakdown →</a>
        </Banner>

        {ready.length > 0 && (
          <section className="home-shelf">
            <div className="home-shelf__head">
              <div className="title">
                <div className="ra-diamond" style={{background:'var(--ra-ready-high)'}}/>
                <h2 className="ra-h2" style={{fontSize:16}}>Ready to play</h2>
                <span className="home-shelf__count">{ready.length} decks · ≥80%</span>
              </div>
            </div>
            <div className="ra-deck-grid">
              {ready.map(d => <DeckCard key={d.id} deck={d} onOpen={onOpen} onUntrack={onUntrack}/>)}
            </div>
          </section>
        )}

        {almost.length > 0 && (
          <section className="home-shelf">
            <div className="home-shelf__head">
              <div className="title">
                <div className="ra-diamond"/>
                <h2 className="ra-h2" style={{fontSize:16}}>Almost there</h2>
                <span className="home-shelf__count">{almost.length} decks · 50–80%</span>
              </div>
              <a href="#/reviews" className="ra-link">Review subs →</a>
            </div>
            <div className="ra-deck-grid">
              {almost.map(d => <DeckCard key={d.id} deck={d} onOpen={onOpen} onUntrack={onUntrack}/>)}
            </div>
          </section>
        )}

        {build.length > 0 && (
          <section className="home-shelf">
            <div className="home-shelf__head">
              <div className="title">
                <div className="ra-diamond" style={{background:'var(--ra-ready-low)'}}/>
                <h2 className="ra-h2" style={{fontSize:16}}>Needs collection</h2>
                <span className="home-shelf__count">{build.length} decks · &lt;50%</span>
              </div>
            </div>
            <div className="ra-deck-grid">
              {build.map(d => <DeckCard key={d.id} deck={d} onOpen={onOpen} onUntrack={onUntrack}/>)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------------- IMPORT ---------------- */

function ImportPage() {
  const [tab, setTab] = React.useState('url');
  const [url, setUrl] = React.useState('https://fabrary.com/decks/01J027FSFWMBYYDR457YVXM5QT');
  const [preview, setPreview] = React.useState(null);
  const doPreview = () => setPreview(MOCK_DECKS[1]);
  const confirm = () => { location.hash = '#/decks/' + preview.id; };

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="import"/>
      <main className="app-main">
        <a className="back-link" href="#/home">← Back to decks</a>
        <div className="page-head">
          <div>
            <h1>Import a deck</h1>
            <div className="page-sub">Paste a Fabrary URL or start from a curated meta deck.</div>
          </div>
        </div>

        <div className="import-tabs">
          <button className={tab==='url' ? 'on' : ''} onClick={()=>{setTab('url');setPreview(null);}}>From URL</button>
          <button className={tab==='meta' ? 'on' : ''} onClick={()=>{setTab('meta');setPreview(null);}}>From meta decks</button>
        </div>

        <div className="import-layout">
          <div>
            {tab === 'url' && !preview && (
              <div className="ra-card">
                <div className="ra-field">
                  <label className="ra-label">Fabrary URL</label>
                  <input className="ra-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://fabrary.com/decks/…"/>
                </div>
                <div style={{marginTop:20,display:'flex',gap:10}}>
                  <Button variant="primary" onClick={doPreview}>Preview deck</Button>
                  <Button variant="ghost" href="#/home" as="a">Cancel</Button>
                </div>
              </div>
            )}

            {tab === 'meta' && !preview && (
              <>
                <div className="ra-eyebrow accent" style={{marginBottom:4}}>Curated builds</div>
                <p style={{color:'var(--ra-fg-secondary)',fontSize:14,marginTop:0}}>Tier-ranked meta decks, auto-updated from tournament results.</p>
                <div className="meta-deck-grid">
                  {META_DECKS.map(m => (
                    <div key={m.id} className="meta-deck" onClick={()=>setPreview({...MOCK_DECKS[1], name: m.name, hero: m.hero, heroClass: m.heroClass || 'wizard'})}>
                      <h4>{m.name}</h4>
                      <div className="meta">{m.hero} · {m.format}</div>
                      <div className="foot">
                        <span>Tier {m.tier}</span>
                        <span className="ready">{m.buildPct} buildable</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {preview && (
              <>
                <Banner kind="ok" strong="Preview">We found this deck. Review before tracking.</Banner>
                <div style={{marginTop:20,display:'grid',gridTemplateColumns:'300px 1fr',gap:28,alignItems:'start'}}>
                  <DeckCard deck={preview}/>
                  <div>
                    <div className="ra-eyebrow accent">Against your library</div>
                    <h2 className="ra-h1" style={{fontSize:26,marginTop:8}}>{preview.have} owned · {preview.sub} substitutable · {preview.miss} missing</h2>
                    <p style={{color:'var(--ra-fg-secondary)',marginTop:8,lineHeight:1.55}}>
                      Tracking this deck will compute per-card readiness and propose substitutions. You can reject any proposal later.
                    </p>
                    <div style={{marginTop:20,display:'flex',gap:10}}>
                      <Button variant="primary" onClick={confirm}>Track this deck</Button>
                      <Button variant="ghost" onClick={()=>setPreview(null)}>Back</Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="import-side">
            <h4>How it works</h4>
            <ul>
              <li>We parse the Fabrary list and cross-reference it with your uploaded library.</li>
              <li>Missing cards get substitution proposals, tier-scored with rationale.</li>
              <li>Reject any proposal you disagree with — readiness recalculates instantly.</li>
              <li>Need to update your library? <a href="#/settings" className="ra-link" style={{fontSize:11}}>Upload CSV in Settings</a></li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ---------------- DECK DETAIL ---------------- */

function DeckDetailPage() {
  const d = MOCK_DECK_DETAIL;
  const [path, setPath] = React.useState('B');
  const [rejected, setRejected] = React.useState(new Set());
  const [owned, setOwned] = React.useState(new Set());
  const [showUntrack, setShowUntrack] = React.useState(false);

  const onReject = (id) => setRejected(s => new Set([...s, id]));
  const onRestore = (id) => setRejected(s => { const n = new Set(s); n.delete(id); return n; });
  const onMark = (id) => setOwned(s => new Set([...s, id]));

  const activeSubs = d.substituted.filter(s => !rejected.has(s.id));
  const pendingMissing = d.missing.filter(m => !owned.has(m.id));
  const totalMissingCents = pendingMissing.reduce((s,m) => s + m.price * m.qty, 0);

  const adjustedReady = Math.max(0, d.readiness - rejected.size * 6);
  const rc = readyClass(adjustedReady);

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="home"/>
      <main className="app-main full">
        <a className="back-link" href="#/home">← All decks</a>

        <div className="dd-layout">
          <div>
            <div className="dd-hero">
              <div className={`dd-hero__top ra-hero--${d.heroClass}`}>
                <div className="ra-deck__tag" style={{position:'absolute',top:20,left:24}}>{d.hero} · {d.heroClass}</div>
                <div className="dd-hero__top-right">
                  <a className="ra-link" href="#" style={{background:'rgba(12,13,16,0.6)',padding:'6px 12px',border:'1px solid var(--ra-accent-soft-bd)',borderRadius:2,backdropFilter:'blur(4px)'}}>View on Fabrary ↗</a>
                </div>
              </div>
              <div className="dd-hero__bottom">
                <div className="dd-hero__names">
                  <h1>{d.name}</h1>
                  <div className="dd-hero__meta">
                    <span className="ra-meta">{d.format}</span>
                    <span className="ra-meta" style={{color:'var(--ra-fg-subtle)'}}>· ULID: {d.ulid}</span>
                  </div>
                  <div className="path-switch">
                    <button className={path==='A'?'on':''} onClick={()=>setPath('A')}>A<span className="sub">Exact</span></button>
                    <button className={path==='B'?'on':''} onClick={()=>setPath('B')}>B<span className="sub">With subs</span></button>
                    <button className={path==='C'?'on':''} onClick={()=>setPath('C')}>C<span className="sub">Closest</span></button>
                  </div>
                </div>
                <div className="dd-hero__readiness">
                  <div className={`dd-pct ${rc}`}><span>{adjustedReady}</span><span className="sym">%</span></div>
                  <div className="ra-eyebrow" style={{color:'var(--ra-fg-muted)',marginTop:6}}>Effective Ready</div>
                  <div className="dd-raw">Raw {d.raw}% · Fidelity {d.fidelity}%</div>
                </div>
              </div>
              <div className="dd-bar" style={{margin:'0 28px 24px'}}>
                <div className="dd-bar-fill" style={{'--pct': adjustedReady + '%'}}/>
              </div>
            </div>

            {rejected.size > 0 && (
              <Banner kind="warn" strong="Modified view">
                You have rejected {rejected.size} substitution{rejected.size > 1 ? 's' : ''}.
                <button className="ra-link" style={{marginLeft:'auto',background:'transparent',border:'none',cursor:'pointer'}} onClick={()=>setRejected(new Set())}>Reset ↺</button>
              </Banner>
            )}

            {path === 'C' && (
              <Banner kind="pathc" strong="Closest playable">
                This path drops {pendingMissing.length} missing cards and rebuilds the curve. Fidelity {d.fidelity}%.
              </Banner>
            )}

            <div className="bd-section" style={{marginTop:24}}>
              <div className="ra-section-hd">
                <div className="ra-section-hd__left">
                  <div className="ra-diamond" style={{background:'var(--ra-ready-high)'}}/>
                  <h2 className="ra-h3">Exact matches</h2>
                  <span className="ra-meta">{d.exact.length} cards</span>
                </div>
              </div>
              <div className="dd-card-grid">
                {d.exact.slice(0,8).map(c => {
                  const db = CARD_DB.find(x => x.id === c.id) || CARD_DB.find(x => x.name === c.name.replace(/ \([RYB]\)$/,''));
                  return (
                    <div key={c.id} className="dd-card-cell">
                      <CardArt name={c.name} pitch={db?.pitch || '-'} cost={db?.cost} type={db?.type || 'action'} size="sm"/>
                      <div className="dd-card-cell__qty">×{c.qty}</div>
                    </div>
                  );
                })}
                {d.exact.length > 8 && (
                  <div className="dd-card-cell dd-card-cell--more">
                    <div className="dd-card-cell__more-n">+{d.exact.length - 8}</div>
                    <div className="dd-card-cell__more-l">more</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bd-section">
              <div className="ra-section-hd">
                <div className="ra-section-hd__left">
                  <div className="ra-diamond"/>
                  <h2 className="ra-h3">Substituted</h2>
                  <span className="ra-meta">{activeSubs.length} of {d.substituted.length} active</span>
                </div>
                {rejected.size > 0 && <button className="ra-btn ra-btn--pitch ra-btn--sm" onClick={()=>setRejected(new Set())}>Reset rejections</button>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {d.substituted.map(s => (
                  <SubRow key={s.id} row={s} rejected={rejected.has(s.id)} onReject={onReject} onRestore={onRestore}/>
                ))}
              </div>
            </div>

            <div className="bd-section">
              <div className="ra-section-hd">
                <div className="ra-section-hd__left">
                  <div className="ra-diamond" style={{background:'var(--ra-ready-low)'}}/>
                  <h2 className="ra-h3">Not owned</h2>
                  <span className="ra-meta">{pendingMissing.length} cards · {formatBrl(totalMissingCents)}</span>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {d.missing.map(c => {
                  if (owned.has(c.id)) return null;
                  const db = CARD_DB.find(x => x.id === c.id) || CARD_DB.find(x => x.name === c.name.replace(/ \([RYB]\)$/,''));
                  return (
                    <div key={c.id} className="dd-miss-row">
                      <CardArt name={c.name} pitch={db?.pitch || '-'} cost={db?.cost} type={db?.type || 'action'} size="xs" missing/>
                      <div className="dd-miss-row__body">
                        <div className="dd-miss-row__name">{c.name}</div>
                        <div className="dd-miss-row__meta">{c.id}</div>
                      </div>
                      <span className="dd-miss-row__qty">×{c.qty}</span>
                      <span className="dd-miss-row__price">{formatBrl(c.price * c.qty)}</span>
                      <button className="dd-miss-row__mark" onClick={()=>onMark(c.id)}>Mark owned</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bd-section" style={{padding:'20px 0',borderTop:'1px solid var(--ra-border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div className="ra-eyebrow" style={{color:'var(--ra-ready-low)'}}>Danger</div>
                <div style={{fontFamily:'var(--ra-font-serif)',fontStyle:'italic',color:'var(--ra-fg-muted)',fontSize:13,marginTop:4}}>Remove this deck from your armory.</div>
              </div>
              <Button variant="danger" onClick={()=>setShowUntrack(true)}>Untrack deck</Button>
            </div>
          </div>

          <aside className="shop-card">
            <div className="shop-card__head">
              <div className="label">◆ Shopping line · {AGG_SHOPPING.storeName}</div>
              <div className="shop-card__total">{formatBrl(totalMissingCents)}</div>
              <div className="shop-card__sub">completes this deck</div>
            </div>
            <ul className="shop-card__items">
              {pendingMissing.slice(0,5).map(m => (
                <li key={m.id}>
                  <span className="name">{m.name} <span style={{color:'var(--ra-fg-muted)'}}>×{m.qty}</span></span>
                  <span className="price">{formatBrl(m.price * m.qty)}</span>
                </li>
              ))}
              {pendingMissing.length === 0 && (
                <li><span className="name" style={{color:'var(--ra-ready-high)'}}>◆ Fully covered</span><span/></li>
              )}
            </ul>
            <div className="shop-card__foot">
              <Button variant="primary" size="sm" style={{width:'100%'}} disabled={pendingMissing.length === 0}>
                Open on {AGG_SHOPPING.storeName} ↗
              </Button>
              <div style={{textAlign:'center',marginTop:10,fontSize:11,color:'var(--ra-fg-muted)',fontFamily:'var(--ra-font-mono)',letterSpacing:'0.08em'}}>
                Stock refreshed 2h ago
              </div>
            </div>
          </aside>
        </div>

        <Modal open={showUntrack} onClose={()=>setShowUntrack(false)} danger title="Untrack this deck?">
          <p>Removing "{d.name}" won't delete any cards from your library. You can always track it again later.</p>
          <div className="ra-modal__actions">
            <Button variant="ghost" onClick={()=>setShowUntrack(false)}>Cancel</Button>
            <Button variant="danger" onClick={()=>{setShowUntrack(false); location.hash = '#/home';}}>Untrack</Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

/* ---------------- ONBOARDING (3-step wizard) ---------------- */

function OnboardingPage() {
  const [step, setStep] = React.useState(1);
  const steps = [
    { n: 1, label: 'Paste deck' },
    { n: 2, label: 'Upload library' },
    { n: 3, label: 'Review subs' },
  ];

  return (
    <div className="app-shell">
      <Header user={MOCK_USER}/>
      <main className="app-main narrow">
        <div className="onboard">
          <div className="onboard__steps">
            {steps.map(s => (
              <div key={s.n} className={`onboard__step ${step === s.n ? 'cur' : step > s.n ? 'done' : ''}`}>
                <div className="onboard__num"><span>{s.n}</span></div>
                <div className="onboard__label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="onboard__body">
            {step === 1 && (<>
              <div className="ra-eyebrow accent">Step 1 of 3</div>
              <h1>First, a deck</h1>
              <p>Paste any Fabrary URL. We'll use it to understand what you want to play.</p>
              <div style={{maxWidth:420,margin:'0 auto'}}>
                <Input placeholder="https://fabrary.com/decks/…" defaultValue="https://fabrary.com/decks/01J027FSFWMBYYDR457YVXM5QT"/>
              </div>
              <div className="onboard__actions">
                <Button variant="ghost" href="#/home" as="a">Skip for now</Button>
                <Button variant="primary" onClick={()=>setStep(2)}>Continue →</Button>
              </div>
            </>)}
            {step === 2 && (<>
              <div className="ra-eyebrow accent">Step 2 of 3</div>
              <h1>Your library</h1>
              <p>Upload a CSV of the cards you own, or start empty and mark them as you go. We won't share this.</p>
              <div style={{maxWidth:420,margin:'0 auto',padding:'32px',border:'1px dashed var(--ra-border-strong)',borderRadius:2,textAlign:'center',background:'var(--ra-bg-raised)'}}>
                <div style={{fontSize:32,color:'var(--ra-accent)',marginBottom:10}}>↑</div>
                <div className="ra-h3" style={{marginBottom:6}}>Drop a CSV or click to browse</div>
                <div className="ra-meta" style={{textTransform:'none',letterSpacing:'0.04em',fontSize:11}}>Supports Fabrary, Flesh Cube, Penny Dreadful exports</div>
              </div>
              <div className="onboard__actions">
                <Button variant="ghost" onClick={()=>setStep(1)}>← Back</Button>
                <Button variant="primary" onClick={()=>setStep(3)}>I'll start empty →</Button>
              </div>
            </>)}
            {step === 3 && (<>
              <div className="ra-eyebrow accent">Step 3 of 3</div>
              <h1>Substitutions are honest</h1>
              <p>When a card is missing, we propose a tier-scored swap with a reason. You can reject any of them — readiness updates instantly.</p>
              <div style={{maxWidth:560,margin:'0 auto'}}>
                <SubRow row={MOCK_DECK_DETAIL.substituted[0]}/>
              </div>
              <div className="onboard__actions">
                <Button variant="ghost" onClick={()=>setStep(2)}>← Back</Button>
                <Button variant="primary" href="#/home" as="a">Enter the armory →</Button>
              </div>
            </>)}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------------- SETTINGS ---------------- */

function SettingsPage() {
  const [showDel, setShowDel] = React.useState(false);
  const [pw, setPw] = React.useState('');
  const [confirm, setConfirm] = React.useState(false);
  const canDelete = pw.length >= 8 && confirm;

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="settings"/>
      <main className="app-main narrow">
        <div className="page-head">
          <div>
            <h1>Settings</h1>
            <div className="page-sub">Account and data controls.</div>
          </div>
        </div>

        <div className="settings-sections">
          <div className="settings-row">
            <div>
              <h3>Account</h3>
              <p className="hint">Your identity in the arsenal.</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Input label="Email" value={MOCK_USER.email} readOnly/>
              <div>
                <label className="ra-label">Email status</label>
                <div style={{marginTop:8}}><Banner kind="ok" strong="Verified">Your email is confirmed.</Banner></div>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <h3>Library</h3>
              <p className="hint">Upload or refresh your owned cards. Used to compute readiness.</p>
            </div>
            <div>
              <div style={{padding:16,background:'var(--ra-bg-raised)',border:'1px solid var(--ra-border)',borderRadius:2,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div className="ra-mono" style={{fontSize:13}}>library-2024-09.csv</div>
                  <div className="ra-meta" style={{marginTop:2}}>412 unique · uploaded 4 days ago</div>
                </div>
                <Button variant="ghost" size="sm">Replace</Button>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <h3>Preferences</h3>
              <p className="hint">Where to price missing cards.</p>
            </div>
            <div>
              <Input label="Preferred store" defaultValue="Cúpula DT"/>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <h3>Password</h3>
              <p className="hint">Keep the armory locked.</p>
            </div>
            <div>
              <Button variant="ghost">Change password</Button>
            </div>
          </div>
        </div>

        <div className="danger-zone">
          <h2>◆ Danger zone</h2>
          <p>Deleting your account removes all tracked decks, substitutions, and your library. This cannot be undone.</p>
          <Button variant="danger" onClick={()=>setShowDel(true)}>Delete my account</Button>
        </div>

        <Modal open={showDel} onClose={()=>setShowDel(false)} danger title="Delete account?">
          <p>This will permanently erase your library and tracked decks. Type your password and confirm to proceed.</p>
          <Input label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Enter your password"/>
          <label style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:14,fontSize:13,color:'var(--ra-fg-secondary)',cursor:'pointer'}}>
            <input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} style={{marginTop:3}}/>
            I understand this cannot be undone.
          </label>
          <div className="ra-modal__actions">
            <Button variant="ghost" onClick={()=>{setShowDel(false);setPw('');setConfirm(false);}}>Cancel</Button>
            <Button variant="danger" disabled={!canDelete} onClick={()=>{setShowDel(false); location.hash = '#/';}}>
              Delete forever
            </Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

/* ---------------- COLLECTION (new — fills UX gap) ---------------- */

function CollectionPage() {
  const sets = [
    { code: 'DTD', name: 'Dusk till Dawn',    owned: 68, total: 112 },
    { code: 'HVY', name: 'Heavy Hitters',     owned: 42, total: 98 },
    { code: 'EVO', name: 'Bright Lights',     owned: 28, total: 134 },
    { code: 'ROS', name: 'Rosetta',           owned: 15, total: 128 },
  ];
  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="collection"/>
      <main className="app-main">
        <div className="page-head">
          <div>
            <h1>Collection</h1>
            <div className="page-sub">412 unique cards across 4 sets.</div>
          </div>
          <Button variant="ghost">Upload CSV</Button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:16}}>
          {sets.map(s => {
            const pct = Math.round((s.owned/s.total)*100);
            return (
              <div key={s.code} className="ra-card">
                <div className="ra-eyebrow accent">{s.code}</div>
                <div className="ra-h3" style={{marginTop:6,marginBottom:12}}>{s.name}</div>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
                  <div className="ra-readiness-display" style={{fontSize:32,color:'var(--ra-accent)'}}>
                    {pct}<span style={{fontSize:14,opacity:0.7,fontFamily:'var(--ra-font-display)'}}>%</span>
                  </div>
                  <div className="ra-meta">{s.owned} / {s.total}</div>
                </div>
                <div className="dd-bar" style={{marginTop:12}}>
                  <div className="dd-bar-fill" style={{'--pct': pct + '%'}}/>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ---------------- SUBSTITUTION REVIEWS (new — cross-deck) ---------------- */

function ReviewsPage() {
  const [rejected, setRejected] = React.useState(new Set());
  const onReject = (id) => setRejected(s => new Set([...s, id]));
  const onRestore = (id) => setRejected(s => { const n = new Set(s); n.delete(id); return n; });

  const subs = MOCK_DECK_DETAIL.substituted.map((s,i) => ({...s, deckName: MOCK_DECKS[i % MOCK_DECKS.length].name}));

  return (
    <div className="app-shell">
      <Header user={MOCK_USER} currentPage="reviews"/>
      <main className="app-main">
        <div className="page-head">
          <div>
            <h1>Substitution review</h1>
            <div className="page-sub">All proposed swaps across your tracked decks, in one place.</div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <span className="ra-meta">{rejected.size} rejected · {subs.length - rejected.size} active</span>
            {rejected.size > 0 && <Button variant="pitch" size="sm" onClick={()=>setRejected(new Set())}>Reset all</Button>}
          </div>
        </div>

        <Banner kind="info" strong="How this works">Approve a swap by leaving it. Reject to exclude it from readiness.</Banner>

        <div style={{display:'flex',flexDirection:'column',gap:18,marginTop:24}}>
          {subs.map(s => (
            <div key={s.id}>
              <div className="ra-meta" style={{marginBottom:8,color:'var(--ra-fg-secondary)'}}>◆ {s.deckName}</div>
              <SubRow row={s} rejected={rejected.has(s.id)} onReject={onReject} onRestore={onRestore}/>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, {
  HomeEmpty, HomePopulated, ImportPage, DeckDetailPage, OnboardingPage, SettingsPage,
  CollectionPage, ReviewsPage,
});
