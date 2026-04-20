/* Rathe Arsenal — auth pages (Landing, Sign in, Sign up, Forgot, Reset, Check email, Verify) */

function AuthSplit({ title, sub, children, footer, tagline }) {
  return (
    <div className="auth-split">
      <div className="auth-split__art">
        <div className="auth-split__art-content">
          <div className="auth-split__mark">
            <Brand size="md"/>
          </div>
          <div className="auth-split__tagline">
            <h2>{tagline || 'Your arsenal, forged.'}</h2>
            <p>Track your Flesh and Blood decks. See which cards you own, which have substitutes, and what it would cost to finish the build.</p>
          </div>
        </div>
        <div className="auth-split__quote">
          "A warrior prepares the blade before the battle, not during it."<br/>
          <span style={{color:'var(--ra-fg-muted)',fontStyle:'normal',fontFamily:'var(--ra-font-mono)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>— Rathe proverb</span>
        </div>
      </div>
      <div className="auth-split__form">
        <div className="auth-split__inner">
          <h1>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
          {children}
          {footer && <div className="auth-split__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- LANDING ---------------- */

function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__top">
        <Brand size="sm"/>
        <div className="right">
          <a className="ra-link" href="#/sign-in">Sign in</a>
          <a className="ra-btn ra-btn--primary ra-btn--sm" href="#/sign-up">Get started</a>
        </div>
      </div>

      <section className="landing__hero">
        <div className="landing__eyebrow">Flesh and Blood · Collection tracker</div>
        <h1 className="landing__title">Your arsenal,<br/>forged.</h1>
        <p className="landing__tag">
          Paste a deck. See what you own, what substitutes clean, and exactly how many Reais complete the build. No guessing. No half-finished sleeves.
        </p>
        <div className="landing__cta">
          <a className="ra-btn ra-btn--primary ra-btn--lg" href="#/sign-up">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2.5v11l5-1 5 1v-11l-5 1-5-1z"/><path d="M8 6v5m-2-2.5L8 11l2-2.5"/>
            </svg>
            Start tracking
          </a>
          <a className="ra-btn ra-btn--ghost ra-btn--lg" href="#/sign-in">I already have an account</a>
        </div>
      </section>

      <section className="landing__pillars">
        <div className="pillar">
          <div className="pillar__num">01</div>
          <h3>Readiness, not guesses</h3>
          <p>Every deck gets an effective % that counts owned cards and valid substitutes. Know what's table-ready at a glance.</p>
        </div>
        <div className="pillar">
          <div className="pillar__num">02</div>
          <h3>Substitutes with a reason</h3>
          <p>Tier-scored swaps with written rationale. Reject the ones you don't like — readiness recalculates instantly.</p>
        </div>
        <div className="pillar">
          <div className="pillar__num">03</div>
          <h3>Finish at the store</h3>
          <p>Aggregated shopping line across every tracked deck — shortest path to complete your arsenal.</p>
        </div>
      </section>

      <section className="landing__demo">
        <div className="landing__demo-title">
          <div className="ra-eyebrow accent">Sample deck</div>
          <h2 className="ra-h2" style={{marginTop:10}}>Iyslander, at 87% ready</h2>
        </div>
        <div style={{display:'flex',justifyContent:'center'}}>
          <div style={{width:300}}>
            <DeckCard deck={MOCK_DECKS[0]} onOpen={()=>location.hash='#/decks/1'}/>
          </div>
        </div>
      </section>

      <footer className="landing__footer">
        <span>◆ Rathe Arsenal — v0.1</span>
        <span>Not affiliated with Legend Story Studios.</span>
      </footer>
    </div>
  );
}

/* ---------------- SIGN IN ---------------- */

function SignInPage() {
  const [email, setEmail] = React.useState('leopoldo@rathe.gg');
  const [pw, setPw] = React.useState('••••••••');
  const [err, setErr] = React.useState(null);
  const submit = (e) => {
    e.preventDefault();
    if (!email.includes('@')) { setErr('Enter a valid email.'); return; }
    location.hash = '#/home';
  };
  return (
    <AuthSplit
      title="Sign in"
      sub="Welcome back, Hero."
      tagline="Welcome back to the armory."
      footer={<>
        <a href="#/forgot-password">Forgot password?</a>
        <span>No account? <a href="#/sign-up">Create one</a></span>
      </>}
    >
      {err && <Banner kind="error" strong="Error">{err}</Banner>}
      <form onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="hero@rathe.gg"/>
        <Input label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)}/>
        <Button type="submit" variant="primary">Sign in</Button>
      </form>
    </AuthSplit>
  );
}

/* ---------------- SIGN UP ---------------- */

function SignUpPage() {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    location.hash = '#/check-your-email';
  };
  return (
    <AuthSplit
      title="Create your account"
      sub="Start tracking in under a minute."
      tagline="Join the armory."
      footer={<span>Already have one? <a href="#/sign-in">Sign in</a></span>}
    >
      <form onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="hero@rathe.gg" required/>
        <Input label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} hint="At least 8 characters." required/>
        <Button type="submit" variant="primary">Create account</Button>
      </form>
      <p style={{fontSize:11,color:'var(--ra-fg-muted)',fontFamily:'var(--ra-font-mono)',letterSpacing:'0.05em',marginTop:20,lineHeight:1.6}}>
        By creating an account you accept the terms. We'll send a verification link to confirm your email.
      </p>
    </AuthSplit>
  );
}

/* ---------------- FORGOT / RESET / EMAIL states ---------------- */

function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const submit = (e) => { e.preventDefault(); location.hash = '#/check-your-email'; };
  return (
    <AuthSplit
      title="Forgot password"
      sub="We'll email you a reset link."
      tagline="Lost the key? We'll forge another."
      footer={<a href="#/sign-in">Back to sign in</a>}
    >
      <form onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="hero@rathe.gg" required/>
        <Button type="submit" variant="primary">Send reset link</Button>
      </form>
    </AuthSplit>
  );
}

function ResetPasswordPage() {
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const err = pw && pw2 && pw !== pw2 ? "Passwords don't match." : null;
  const submit = (e) => { e.preventDefault(); if (!err) location.hash = '#/sign-in'; };
  return (
    <AuthSplit
      title="Set a new password"
      sub="Choose carefully — your arsenal awaits."
      tagline="A new key, a new campaign."
      footer={<a href="#/sign-in">Back to sign in</a>}
    >
      <form onSubmit={submit}>
        <Input label="New password" type="password" value={pw} onChange={e=>setPw(e.target.value)} required/>
        <Input label="Confirm" type="password" value={pw2} onChange={e=>setPw2(e.target.value)} error={err} required/>
        <Button type="submit" variant="primary" disabled={!!err}>Update password</Button>
      </form>
    </AuthSplit>
  );
}

function CheckYourEmailPage() {
  return (
    <AuthSplit
      title="Check your email"
      sub="We've sent you a link. Follow it to continue."
      tagline="The raven has flown."
      footer={<a href="#/sign-in">Back to sign in</a>}
    >
      <div style={{border:'1px solid var(--ra-border)',background:'var(--ra-bg-raised)',borderRadius:2,padding:'18px 20px',display:'flex',gap:16,alignItems:'center'}}>
        <div style={{fontSize:32,color:'var(--ra-accent)'}}>✉</div>
        <div>
          <div className="ra-h3" style={{marginBottom:4}}>Sent to your inbox</div>
          <div className="ra-meta" style={{textTransform:'none',letterSpacing:'0.05em'}}>Check spam if you don't see it in 2 minutes.</div>
        </div>
      </div>
      <div style={{marginTop:18,display:'flex',gap:10}}>
        <Button variant="ghost" size="sm">Resend</Button>
        <Button variant="ghost" size="sm" onClick={()=>location.hash='#/verify-email'}>I got the link →</Button>
      </div>
    </AuthSplit>
  );
}

function VerifyEmailPage() {
  const [state, setState] = React.useState('verifying');
  React.useEffect(() => {
    const t = setTimeout(() => setState('done'), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <AuthSplit
      title={state === 'done' ? 'Email verified' : 'Verifying…'}
      sub={state === 'done' ? 'Welcome to the arsenal.' : 'This takes only a moment.'}
      tagline="The seal is set."
      footer={state === 'done' ? <a href="#/onboarding">Continue →</a> : null}
    >
      {state === 'verifying' ? (
        <div style={{padding:'40px 0',textAlign:'center',color:'var(--ra-fg-muted)'}}>
          <div style={{fontSize:48,color:'var(--ra-accent)',animation:'pulse 1.2s ease-in-out infinite'}}>◆</div>
          <div className="ra-meta" style={{marginTop:16}}>Confirming seal…</div>
        </div>
      ) : (
        <>
          <Banner kind="ok" strong="Verified">Your email is confirmed.</Banner>
          <div style={{marginTop:20}}>
            <Button variant="primary" onClick={()=>location.hash='#/onboarding'}>Continue to onboarding</Button>
          </div>
        </>
      )}
    </AuthSplit>
  );
}

Object.assign(window, {
  LandingPage, SignInPage, SignUpPage, ForgotPasswordPage, ResetPasswordPage,
  CheckYourEmailPage, VerifyEmailPage,
});
