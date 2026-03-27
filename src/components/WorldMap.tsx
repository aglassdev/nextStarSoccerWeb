import React from 'react';

/* ──────────────────────────────────────────────────────
   Country detection from subtitle field
────────────────────────────────────────────────────── */
const detectCountry = (subtitle: string): { key: string } => {
  if (!subtitle) return { key: 'usa-collegiate' };
  const s = subtitle.toLowerCase();

  // Oceania
  if (s.includes('manurewa') || s.includes('birkenhead') || s.includes('new zealand'))
    return { key: 'new-zealand' };

  // England
  if (
    s.includes('bournemouth') || s.includes('arsenal') || s.includes('west ham') ||
    s.includes('chelsea') || s.includes('manchester') || s.includes('tottenham') ||
    s.includes('liverpool') || s.includes('everton') || s.includes('fulham')
  ) return { key: 'england' };

  // Germany
  if (
    s.includes('wolfsburg') || s.includes('leverkusen') || s.includes('dortmund') ||
    s.includes('bayern') || s.includes('hamburg') || s.includes('schalke')
  ) return { key: 'germany' };

  // Belgium
  if (
    s.includes('westerlo') || s.includes('leuven') || s.includes('krc') ||
    s.includes('anderlecht') || s.includes('brugge') || s.includes('gent')
  ) return { key: 'belgium' };

  // France
  if (
    s.includes('lyon') || s.includes('lyonnes') || s.includes('paris') ||
    s.includes('marseille') || s.includes('lille') || s.includes('rennes')
  ) return { key: 'france' };

  // Austria
  if (
    s.includes('grazer') || s.includes('salzburg') || s.includes('austria wien') ||
    s.includes('rapid') || s.includes('lask')
  ) return { key: 'austria' };

  // Czech Republic
  if (
    s.includes('jiskra') || s.includes('dukla') || s.includes('sparta') ||
    s.includes('slavia') || s.includes('czech')
  ) return { key: 'czech-republic' };

  // USA: collegiate vs professional
  const collegeKws = [
    'university', 'college', 'binghamton', 'yale', 'princeton', 'georgetown',
    'duke', 'harvard', 'columbia', 'cornell', 'virginia', 'bucknell', 'pennsylvania',
    'colgate', 'howard', 'american', 'elon', 'high point', 'wake forest',
    'william & mary', 'radford', 'manhattan', 'providence', 'george mason',
    'george washington', 'massachusetts', 'wilmington', 'illinois', 'ohio state',
    'akron', 'james madison', 'old dominion', 'lynchburg', 'emory', 'haverford',
    'st. louis', 'maryland', 'rutgers', 'penn state', 'michigan', 'clemson',
    'north carolina', 'stanford', 'notre dame', 'indiana', 'kentucky',
  ];
  const isCollegiate = collegeKws.some(kw => s.includes(kw));
  return { key: isCollegiate ? 'usa-collegiate' : 'usa-professional' };
};

/* ──────────────────────────────────────────────────────
   Marker positions in the 1000×500 SVG coordinate space
   (approximate Mercator — x = (lng+180)/360×1000, y = (90−lat)/180×500)
────────────────────────────────────────────────────── */
interface MarkerDef {
  x: number;
  y: number;
  label: string;
  labelDy?: number; // label offset from center (default +r+10)
  labelAnchor?: 'start' | 'middle' | 'end';
  color: string;
}

const MARKERS: Record<string, MarkerDef> = {
  'usa-collegiate': { x: 248, y: 168, label: 'US Collegiate', color: '#3B82F6' },
  'usa-professional': { x: 192, y: 188, label: 'US Professional', color: '#10B981' },
  'england':         { x: 450, y: 96,  label: 'England',      color: '#A78BFA', labelDy: -16 },
  'czech-republic':  { x: 512, y: 88,  label: 'Czech Rep.',   color: '#A78BFA', labelDy: -16 },
  'germany':         { x: 516, y: 110, label: 'Germany',      color: '#A78BFA', labelDy:  22, labelAnchor: 'end' },
  'belgium':         { x: 483, y: 100, label: 'Belgium',      color: '#A78BFA', labelDy: -16 },
  'austria':         { x: 530, y: 120, label: 'Austria',      color: '#A78BFA', labelDy:  22 },
  'france':          { x: 466, y: 131, label: 'France',       color: '#A78BFA', labelDy:  22, labelAnchor: 'start' },
  'new-zealand':     { x: 896, y: 355, label: 'New Zealand',  color: '#FBBF24' },
};

interface WorldMapProps {
  alumni: { subtitle?: string }[];
}

const WorldMap: React.FC<WorldMapProps> = ({ alumni }) => {
  /* Count by marker key */
  const counts: Record<string, number> = {};
  alumni.forEach(a => {
    const { key } = detectCountry(a.subtitle || '');
    if (MARKERS[key]) counts[key] = (counts[key] || 0) + 1;
  });

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#0d1b2a' }}>
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-auto"
        aria-label="World map showing player locations"
      >
        {/* ── Subtle grid ── */}
        {[100, 200, 300, 400].map(y => (
          <line key={`lat${y}`} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
        ))}
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(x => (
          <line key={`lng${x}`} x1={x} y1="0" x2={x} y2="500" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
        ))}

        {/* ── Continent / landmass shapes ── */}
        {/* North America */}
        <path d="M82,68 L115,52 L160,48 L215,55 L268,68 L300,92 L312,122 L318,158 L300,196 L270,232 L235,252 L195,244 L158,224 L118,196 L90,168 L72,132 L68,96 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Greenland */}
        <path d="M220,28 L262,18 L296,32 L292,56 L258,62 L220,50 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Central America + Caribbean rough */}
        <path d="M270,235 L310,232 L322,248 L295,255 L268,248 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* South America */}
        <path d="M228,258 L282,250 L315,270 L325,312 L312,362 L282,408 L252,415 L226,394 L212,348 L212,295 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* UK / Ireland */}
        <path d="M436,84 L462,78 L476,92 L469,116 L445,122 L432,109 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Scandinavia */}
        <path d="M480,60 L533,52 L550,68 L533,98 L497,108 L477,92 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Mainland Europe */}
        <path d="M460,98 L552,82 L570,102 L574,132 L556,164 L509,174 L462,164 L440,148 L442,116 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Iberian Peninsula */}
        <path d="M440,130 L476,124 L479,153 L454,162 L438,150 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Africa */}
        <path d="M450,167 L544,163 L568,196 L574,272 L550,347 L511,388 L473,363 L450,301 L437,240 L440,194 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Madagascar */}
        <path d="M556,278 L572,268 L579,308 L565,333 L552,313 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Asia (main) */}
        <path d="M555,80 L815,62 L858,90 L860,147 L826,187 L770,217 L716,244 L650,254 L580,228 L552,184 L550,120 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Indian subcontinent */}
        <path d="M608,176 L650,170 L667,217 L647,244 L610,240 L600,210 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* SE Asia */}
        <path d="M708,174 L792,170 L814,200 L780,224 L730,222 L705,202 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Japan */}
        <path d="M822,108 L844,98 L854,118 L842,140 L822,130 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* Australia */}
        <path d="M763,284 L862,277 L884,314 L880,366 L840,387 L790,378 L760,340 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />
        {/* New Zealand */}
        <path d="M882,340 L904,330 L917,350 L910,376 L885,374 Z"
          fill="#1a2f4a" stroke="#243d5c" strokeWidth="0.8" />

        {/* ── Highlighted countries (when they have players) ── */}
        {counts['england']        > 0 && <path d="M436,84 L462,78 L476,92 L469,116 L445,122 L432,109 Z" fill="rgba(167,139,250,0.35)" stroke="#A78BFA" strokeWidth="1.2" />}
        {counts['germany']        > 0 && <path d="M495,95 L540,88 L552,105 L548,128 L520,140 L492,130 L490,108 Z" fill="rgba(167,139,250,0.35)" stroke="#A78BFA" strokeWidth="1.2" />}
        {counts['belgium']        > 0 && <path d="M470,105 L500,100 L508,118 L488,128 L464,120 Z" fill="rgba(167,139,250,0.35)" stroke="#A78BFA" strokeWidth="1.2" />}
        {counts['france']         > 0 && <path d="M452,120 L492,112 L502,140 L486,162 L456,158 L440,138 Z" fill="rgba(167,139,250,0.35)" stroke="#A78BFA" strokeWidth="1.2" />}
        {counts['austria']        > 0 && <path d="M500,118 L535,112 L545,128 L528,138 L500,132 Z" fill="rgba(167,139,250,0.35)" stroke="#A78BFA" strokeWidth="1.2" />}
        {counts['czech-republic'] > 0 && <path d="M492,98 L532,92 L540,108 L514,116 L490,110 Z" fill="rgba(167,139,250,0.35)" stroke="#A78BFA" strokeWidth="1.2" />}
        {counts['new-zealand']    > 0 && <path d="M882,340 L904,330 L917,350 L910,376 L885,374 Z" fill="rgba(251,191,36,0.35)" stroke="#FBBF24" strokeWidth="1.2" />}

        {/* USA highlight (east coast region where most players are) */}
        {(counts['usa-collegiate'] > 0 || counts['usa-professional'] > 0) && (
          <path d="M155,120 L285,108 L310,140 L308,190 L272,225 L195,240 L155,210 L140,165 Z"
            fill="rgba(59,130,246,0.18)" stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 2" />
        )}

        {/* ── Markers ── */}
        {Object.entries(MARKERS).map(([key, def]) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          const r = Math.max(14, Math.min(26, 12 + count * 0.35));
          const labelY = def.labelDy != null
            ? def.y + def.labelDy + (def.labelDy < 0 ? -r : r)
            : def.y + r + 12;
          const anchor: 'start' | 'middle' | 'end' = def.labelAnchor || 'middle';

          return (
            <g key={key}>
              {/* Pulse ring */}
              <circle cx={def.x} cy={def.y} r={r + 7} fill={def.color} opacity="0.12" />
              {/* Main circle */}
              <circle cx={def.x} cy={def.y} r={r} fill={def.color} opacity="0.92" />
              {/* Count */}
              <text
                x={def.x} y={def.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={r > 20 ? 10 : 8} fontWeight="800"
              >
                {count}
              </text>
              {/* Label */}
              <text
                x={def.x + (anchor === 'start' ? r + 2 : anchor === 'end' ? -(r + 2) : 0)}
                y={labelY}
                textAnchor={anchor}
                fill="rgba(255,255,255,0.65)"
                fontSize="7.5"
                fontWeight="500"
                letterSpacing="0.3"
              >
                {def.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default WorldMap;
