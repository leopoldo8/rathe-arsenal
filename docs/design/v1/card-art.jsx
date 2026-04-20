/* Rathe Arsenal — CardArt
   Stylized FaB-style card face placeholder. Memorable, legible,
   uses pitch color + type + cost diamond for identity at a glance.
*/

const PITCH_COLORS = {
  R: { bg: '#3d1511', frame: '#c0574a', ink: '#f4d2c6', sym: '#e7916a' },
  Y: { bg: '#3d2e0a', frame: '#c5923a', ink: '#f4e2b3', sym: '#e6c35d' },
  B: { bg: '#0f1f36', frame: '#4a7ea8', ink: '#d2e2f4', sym: '#6a9ec9' },
  '-': { bg: '#1e2128', frame: '#555', ink: '#c8c2b3', sym: '#888' },
};

const TYPE_GLYPHS = {
  // Stylized silhouettes keyed by type. Each returns JSX <g> to place in card art area.
  'attack-action': (
    <g>
      <path d="M30 60 L50 22 L70 60 L58 62 L64 78 L52 82 L46 66 L36 62 Z" fill="currentColor" opacity="0.9"/>
      <path d="M42 60 L50 38 L58 60 Z" fill="#000" opacity="0.25"/>
    </g>
  ),
  'defense-reaction': (
    <g>
      <path d="M50 18 L78 28 L74 62 Q50 82 50 82 Q50 82 26 62 L22 28 Z" fill="currentColor" opacity="0.85"/>
      <path d="M50 28 L68 34 L66 58 Q50 72 50 72 Q50 72 34 58 L32 34 Z" fill="#000" opacity="0.18"/>
    </g>
  ),
  'action': (
    <g>
      <circle cx="50" cy="50" r="28" fill="currentColor" opacity="0.82"/>
      <circle cx="50" cy="50" r="18" fill="none" stroke="#000" strokeWidth="1.4" opacity="0.3"/>
      <path d="M38 50 L50 38 L62 50 L50 62 Z" fill="#000" opacity="0.25"/>
    </g>
  ),
  'instant': (
    <g>
      <path d="M54 18 L34 52 L48 52 L40 82 L66 44 L52 44 Z" fill="currentColor" opacity="0.9"/>
    </g>
  ),
  'equipment': (
    <g>
      <path d="M30 36 L50 22 L70 36 L70 70 L50 82 L30 70 Z" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.85"/>
      <path d="M40 44 L50 38 L60 44 L60 62 L50 68 L40 62 Z" fill="currentColor" opacity="0.7"/>
    </g>
  ),
  'ally': (
    <g>
      <circle cx="50" cy="38" r="10" fill="currentColor" opacity="0.9"/>
      <path d="M28 82 Q28 58 50 58 Q72 58 72 82 Z" fill="currentColor" opacity="0.85"/>
    </g>
  ),
  'hero': (
    <g>
      <circle cx="50" cy="36" r="12" fill="currentColor" opacity="0.95"/>
      <path d="M24 86 Q24 56 50 56 Q76 56 76 86 Z" fill="currentColor" opacity="0.9"/>
      <path d="M50 20 L40 14 L50 10 L60 14 Z" fill="currentColor" opacity="0.9"/>
    </g>
  ),
  'token': (
    <g>
      <circle cx="50" cy="50" r="22" fill="currentColor" opacity="0.5"/>
      <circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3"/>
    </g>
  ),
};

/**
 * CardArt
 * props:
 *   name  — card name
 *   pitch — 'R' | 'Y' | 'B' | '-'
 *   cost  — number or null
 *   pitchValue — number (pitch value shown in pitch corner). default = same as pitch R=1/Y=2/B=3
 *   type  — 'attack-action' | 'defense-reaction' | 'action' | 'instant' | 'equipment' | 'ally' | 'hero' | 'token'
 *   size  — 'xs' (48) | 'sm' (72) | 'md' (112) | 'lg' (180)
 *   missing — bool. Darkens + adds "missing" diagonal mark
 */
function CardArt({ name, pitch='-', cost=null, pitchValue=null, type='action', size='sm', missing=false }) {
  const colors = PITCH_COLORS[pitch] || PITCH_COLORS['-'];
  const widthMap = { xs: 48, sm: 72, md: 112, lg: 180 };
  const width = widthMap[size] || 72;
  const height = Math.round(width * 1.4);
  const pv = pitchValue ?? (pitch === 'R' ? 1 : pitch === 'Y' ? 2 : pitch === 'B' ? 3 : null);
  const glyph = TYPE_GLYPHS[type] || TYPE_GLYPHS['action'];

  return (
    <div
      className={'card-art card-art--' + size + (missing ? ' card-art--missing' : '')}
      style={{
        width, height,
        '--card-bg': colors.bg,
        '--card-frame': colors.frame,
        '--card-ink': colors.ink,
        '--card-sym': colors.sym,
      }}
      title={name}
    >
      <svg viewBox="0 0 100 140" width={width} height={height} preserveAspectRatio="none">
        {/* Card base */}
        <rect x="2" y="2" width="96" height="136" rx="5" ry="5"
              fill="var(--card-bg)" stroke="var(--card-frame)" strokeWidth="1.5"/>
        {/* Outer double frame */}
        <rect x="4.5" y="4.5" width="91" height="131" rx="3.5" ry="3.5"
              fill="none" stroke="var(--card-frame)" strokeWidth="0.4" opacity="0.6"/>
        {/* Art panel */}
        <rect x="10" y="22" width="80" height="70" rx="1.5" ry="1.5"
              fill="#000" fillOpacity="0.35" stroke="var(--card-frame)" strokeWidth="0.4"/>
        {/* Type glyph */}
        <g transform="translate(10 22)" style={{color: 'var(--card-sym)'}}>{glyph}</g>

        {/* Cost diamond (top-left) */}
        {cost != null && (
          <g>
            <path d="M15 15 L22 8 L29 15 L22 22 Z" fill="var(--card-frame)" stroke="var(--card-bg)" strokeWidth="1"/>
            <text x="22" y="18.5" textAnchor="middle" fontSize="9.5"
                  fontFamily="'Cinzel', serif" fontWeight="700" fill="var(--card-bg)">{cost}</text>
          </g>
        )}

        {/* Pitch pip (top-right) */}
        {pv != null && (
          <g>
            <circle cx="82" cy="14" r="7" fill="var(--card-bg)" stroke="var(--card-frame)" strokeWidth="1"/>
            {Array.from({length: pv}).map((_, i) => (
              <circle key={i} cx={76 + i*4} cy="14" r="1.4" fill="var(--card-sym)"/>
            ))}
          </g>
        )}

        {/* Name band */}
        <rect x="10" y="95" width="80" height="14" rx="1" ry="1"
              fill="#000" fillOpacity="0.55"/>
        <text x="50" y="104" textAnchor="middle" fontSize="6.5"
              fontFamily="'Cinzel', serif" fontWeight="600" fill="var(--card-ink)"
              style={{textTransform:'uppercase', letterSpacing:'0.06em'}}>
          {name.length > 18 ? name.slice(0, 17) + '…' : name}
        </text>

        {/* Effect text lines */}
        <g opacity="0.5">
          <rect x="12" y="113" width="76" height="1.4" fill="var(--card-ink)"/>
          <rect x="12" y="117" width="60" height="1.4" fill="var(--card-ink)"/>
          <rect x="12" y="121" width="70" height="1.4" fill="var(--card-ink)"/>
          <rect x="12" y="125" width="48" height="1.4" fill="var(--card-ink)"/>
        </g>

        {/* Missing hatch overlay */}
        {missing && (
          <g>
            <rect x="2" y="2" width="96" height="136" rx="5" ry="5" fill="rgba(0,0,0,0.55)"/>
            <path d="M10 130 L90 20" stroke="rgba(192, 87, 74, 0.9)" strokeWidth="1.5" strokeDasharray="3 3"/>
          </g>
        )}
      </svg>
    </div>
  );
}

/* Card chip — horizontal: small art + name + metadata. For use in lists. */
function CardChip({ card, qty, trailing, missing, onClick }) {
  return (
    <div className={'card-chip' + (onClick ? ' card-chip--clickable' : '') + (missing ? ' card-chip--missing' : '')} onClick={onClick}>
      <CardArt name={card.name} pitch={card.pitch} cost={card.cost} type={card.type} size="xs" missing={missing}/>
      <div className="card-chip__body">
        <div className="card-chip__name">{card.name}</div>
        <div className="card-chip__meta">
          {card.pitch && card.pitch !== '-' && <span className={'pitch-pip pitch-' + card.pitch}>{card.pitch}</span>}
          {card.cost != null && <span className="cost-pip">{card.cost}</span>}
          <span className="type-pip">{(card.type || '').replace('-', ' ')}</span>
          {qty && <span className="qty-pip">×{qty}</span>}
        </div>
      </div>
      {trailing && <div className="card-chip__trailing">{trailing}</div>}
    </div>
  );
}

Object.assign(window, { CardArt, CardChip, PITCH_COLORS });
