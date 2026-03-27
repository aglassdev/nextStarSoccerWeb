import React, { useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/* ── ISO numeric → our key ────────────────────────────────────────── */
// maps world-atlas numeric IDs to our internal country keys
const ISO_TO_KEY: Record<string, string> = {
  '840': 'usa',        // United States
  '826': 'england',    // United Kingdom
  '276': 'germany',    // Germany
  '056': 'belgium',    // Belgium
  '250': 'france',     // France
  '040': 'austria',    // Austria
  '203': 'czech',      // Czech Republic
  '554': 'new-zealand',// New Zealand
};

/* ── Subtitle → country key ───────────────────────────────────────── */
export const detectCountry = (subtitle: string): { key: string } => {
  if (!subtitle) return { key: 'usa' };
  const s = subtitle.toLowerCase();

  if (s.includes('manurewa') || s.includes('birkenhead') || s.includes('new zealand'))
    return { key: 'new-zealand' };
  if (s.includes('bournemouth') || s.includes('arsenal') || s.includes('west ham') ||
      s.includes('chelsea') || s.includes('manchester') || s.includes('tottenham') ||
      s.includes('liverpool') || s.includes('everton') || s.includes('fulham'))
    return { key: 'england' };
  if (s.includes('wolfsburg') || s.includes('leverkusen') || s.includes('dortmund') ||
      s.includes('bayern') || s.includes('hamburg') || s.includes('schalke'))
    return { key: 'germany' };
  if (s.includes('westerlo') || s.includes('leuven') || s.includes('krc') ||
      s.includes('anderlecht') || s.includes('brugge') || s.includes('gent'))
    return { key: 'belgium' };
  if (s.includes('lyon') || s.includes('lyonnes') || s.includes('paris') ||
      s.includes('marseille') || s.includes('lille') || s.includes('rennes'))
    return { key: 'france' };
  if (s.includes('grazer') || s.includes('salzburg') || s.includes('austria wien') ||
      s.includes('rapid') || s.includes('lask'))
    return { key: 'austria' };
  if (s.includes('jiskra') || s.includes('dukla') || s.includes('sparta') ||
      s.includes('slavia') || s.includes('czech'))
    return { key: 'czech' };

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

/* ── Color palette ────────────────────────────────────────────────── */
const COUNTRY_COLOR: Record<string, string> = {
  'usa':             '#3B82F6',
  'usa-collegiate':  '#3B82F6',
  'usa-professional':'#10B981',
  'england':         '#A78BFA',
  'germany':         '#A78BFA',
  'belgium':         '#A78BFA',
  'france':          '#A78BFA',
  'austria':         '#A78BFA',
  'czech':           '#A78BFA',
  'new-zealand':     '#FBBF24',
};

/* ── Marker positions [lng, lat] ─────────────────────────────────── */
interface MarkerDef {
  coords: [number, number];
  label: string;
  key: string;
  color: string;
}
const MARKER_DEFS: MarkerDef[] = [
  { key: 'usa-collegiate',  coords: [-82,  38], label: 'US Collegiate',  color: '#3B82F6' },
  { key: 'usa-professional',coords: [-100, 34], label: 'US Professional', color: '#10B981' },
  { key: 'england',         coords: [-1,   52], label: 'England',         color: '#A78BFA' },
  { key: 'germany',         coords: [10,   51], label: 'Germany',         color: '#A78BFA' },
  { key: 'belgium',         coords: [4,    50], label: 'Belgium',         color: '#A78BFA' },
  { key: 'france',          coords: [2,    46], label: 'France',          color: '#A78BFA' },
  { key: 'austria',         coords: [14,   47], label: 'Austria',         color: '#A78BFA' },
  { key: 'czech',           coords: [15,   50], label: 'Czech Rep.',      color: '#A78BFA' },
  { key: 'new-zealand',     coords: [172, -41], label: 'New Zealand',     color: '#FBBF24' },
];

interface WorldMapProps {
  alumni: { subtitle?: string }[];
}

const WorldMap: React.FC<WorldMapProps> = ({ alumni }) => {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    alumni.forEach(a => {
      const { key } = detectCountry(a.subtitle || '');
      c[key] = (c[key] || 0) + 1;
    });
    return c;
  }, [alumni]);

  /* Which ISO numeric IDs to highlight */
  const highlightedIsos = useMemo(() => {
    const set = new Set<string>();
    Object.entries(ISO_TO_KEY).forEach(([iso, key]) => {
      // usa covers both collegiate and professional
      if (key === 'usa' && (counts['usa-collegiate'] || counts['usa-professional'])) set.add(iso);
      else if (counts[key]) set.add(iso);
    });
    return set;
  }, [counts]);

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#0d1b2a' }}>
      <ComposableMap
        projectionConfig={{ scale: 147, center: [0, 10] }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const isoNum = String(geo.id);
              const key = ISO_TO_KEY[isoNum];
              const isHighlighted = highlightedIsos.has(isoNum);
              const fillColor = isHighlighted
                ? (COUNTRY_COLOR[key] ?? '#A78BFA') + '55'
                : '#1a2f4a';
              const strokeColor = isHighlighted
                ? (COUNTRY_COLOR[key] ?? '#A78BFA')
                : '#243d5c';

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 1.2 : 0.4}
                  style={{
                    default: { outline: 'none' },
                    hover:   { outline: 'none', fill: fillColor, filter: isHighlighted ? 'brightness(1.2)' : undefined },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Count markers */}
        {MARKER_DEFS.map(({ key, coords, label, color }) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          const r = Math.max(12, Math.min(22, 10 + count * 0.3));
          return (
            <Marker key={key} coordinates={coords}>
              {/* Glow */}
              <circle r={r + 6} fill={color} opacity={0.15} />
              {/* Badge */}
              <circle r={r} fill={color} opacity={0.92} />
              <text
                textAnchor="middle"
                y={1}
                dominantBaseline="middle"
                style={{ fill: 'white', fontSize: r > 17 ? 9 : 7, fontWeight: 800 }}
              >
                {count}
              </text>
              {/* Label */}
              <text
                textAnchor="middle"
                y={r + 10}
                style={{ fill: 'rgba(255,255,255,0.65)', fontSize: 6, fontWeight: 500 }}
              >
                {label}
              </text>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
};

export default WorldMap;
