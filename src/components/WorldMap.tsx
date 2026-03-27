import React, { useState, useEffect, useMemo } from 'react';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const W = 960, H = 500;
const projX = (lng: number) => ((lng + 180) / 360) * W;
const projY = (lat: number) => ((85 - lat) / 170) * H;

// ─── GeoJSON helpers ──────────────────────────────────────────────────────────
const ringToPath = (ring: number[][]): string =>
  `M${ring.map(([lng, lat]) => `${projX(lng).toFixed(1)},${projY(lat).toFixed(1)}`).join('L')}Z`;

const featureToPath = (f: any): string => {
  if (!f?.geometry) return '';
  const { type, coordinates: c } = f.geometry;
  try {
    if (type === 'Polygon')      return c.map(ringToPath).join(' ');
    if (type === 'MultiPolygon') return c.map((p: any[]) => p.map(ringToPath).join(' ')).join(' ');
  } catch { return ''; }
  return '';
};

const getCountryName = (f: any): string =>
  f.properties?.ADMIN || f.properties?.name || f.properties?.NAME || f.properties?.sovereignt || '';

// ─── Country name → key ───────────────────────────────────────────────────────
const nameToKey = (name: string): string | null => {
  const n = name.toLowerCase();
  if (n.includes('united states') || n === 'usa') return 'usa';
  if (n.includes('united kingdom') || n.includes('great britain') || n === 'england' || n === 'uk') return 'england';
  if (n === 'germany') return 'germany';
  if (n === 'belgium') return 'belgium';
  if (n === 'france') return 'france';
  if (n === 'austria') return 'austria';
  if (n.includes('czech') || n === 'czechia') return 'czech';
  if (n.includes('new zealand')) return 'new-zealand';
  return null;
};

// ─── Subtitle → player key ────────────────────────────────────────────────────
export const detectCountry = (subtitle: string): string => {
  if (!subtitle) return 'usa-collegiate';
  const s = subtitle.toLowerCase();

  if (s.includes('manurewa') || s.includes('birkenhead') || s.includes('new zealand'))
    return 'new-zealand';
  if (s.includes('bournemouth') || s.includes('arsenal') || s.includes('west ham') ||
      s.includes('chelsea') || s.includes('manchester') || s.includes('tottenham') ||
      s.includes('liverpool') || s.includes('everton') || s.includes('fulham'))
    return 'england';
  if (s.includes('wolfsburg') || s.includes('leverkusen') || s.includes('dortmund') ||
      s.includes('bayern') || s.includes('hamburg'))
    return 'germany';
  if (s.includes('westerlo') || s.includes('leuven') || s.includes('krc') ||
      s.includes('anderlecht') || s.includes('brugge'))
    return 'belgium';
  if (s.includes('lyon') || s.includes('lyonnes') || s.includes('paris') ||
      s.includes('marseille') || s.includes('lille'))
    return 'france';
  if (s.includes('grazer') || s.includes('salzburg') || s.includes('austria wien') ||
      s.includes('rapid'))
    return 'austria';
  if (s.includes('jiskra') || s.includes('dukla') || s.includes('sparta') ||
      s.includes('slavia') || s.includes('czech'))
    return 'czech';

  const collegeKws = [
    'university', 'college', 'binghamton', 'yale', 'princeton', 'georgetown',
    'duke', 'harvard', 'columbia', 'cornell', 'virginia', 'bucknell',
    'pennsylvania', 'colgate', 'howard', 'american', 'elon', 'high point',
    'wake forest', 'william & mary', 'radford', 'manhattan', 'providence',
    'george mason', 'george washington', 'massachusetts', 'wilmington',
    'illinois', 'ohio state', 'akron', 'james madison', 'old dominion',
    'lynchburg', 'emory', 'haverford', 'st. louis', 'maryland',
  ];
  return collegeKws.some(kw => s.includes(kw)) ? 'usa-collegiate' : 'usa-professional';
};

// ─── Dark theme ───────────────────────────────────────────────────────────────
const OCEAN    = '#0d1b2a';
const LAND     = '#1a2f4a';
const BORDER   = '#243d5c';
const HL_FILL  = 'rgba(59,130,246,0.28)';
const HL_BDR   = '#3B82F6';
const DOT_CLR  = '#60A5FA';
const LEADER   = 'rgba(96,165,250,0.50)';
const LBL_PRI  = 'rgba(255,255,255,0.90)';
const LBL_SUB  = 'rgba(255,255,255,0.50)';

// ─── Leader-line definitions for small / clustered countries ─────────────────
// cLng/cLat = dot on country centroid
// aLng/aLat = anchor for the label text (in open ocean/sky)
const LEADERS: {
  key: string; label: string;
  cLng: number; cLat: number;
  aLng: number; aLat: number;
  ta: 'start' | 'middle' | 'end';
}[] = [
  { key: 'england',     label: 'England',     cLng: -1,   cLat: 52,   aLng: -28,  aLat: 62,   ta: 'end'    },
  { key: 'belgium',     label: 'Belgium',     cLng:  4,   cLat: 50.5, aLng:  -3,  aLat: 65,   ta: 'middle' },
  { key: 'france',      label: 'France',      cLng:  2,   cLat: 46,   aLng: -15,  aLat: 40,   ta: 'end'    },
  { key: 'germany',     label: 'Germany',     cLng: 10,   cLat: 51,   aLng:  26,  aLat: 61,   ta: 'start'  },
  { key: 'czech',       label: 'Czech Rep.',  cLng: 15.5, cLat: 49.7, aLng:  35,  aLat: 54,   ta: 'start'  },
  { key: 'austria',     label: 'Austria',     cLng: 14,   cLat: 47.5, aLng:  31,  aLat: 42,   ta: 'start'  },
  { key: 'new-zealand', label: 'New Zealand', cLng: 172,  cLat: -41,  aLng: 157,  aLat: -52,  ta: 'end'    },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface WorldMapProps {
  alumni: { subtitle?: string }[];
}

const WorldMap: React.FC<WorldMapProps> = ({ alumni }) => {
  const [worldGeo, setWorldGeo] = useState<any>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const sources = [
      'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
      'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
    ];
    (async () => {
      for (const url of sources) {
        try {
          const r = await fetch(url);
          if (r.ok) { const d = await r.json(); if (d?.features) { setWorldGeo(d); break; } }
        } catch { /* try next */ }
      }
      setLoading(false);
    })();
  }, []);

  const worldPaths = useMemo(() => {
    if (!worldGeo?.features) return [];
    return worldGeo.features
      .map((f: any) => ({
        name: getCountryName(f),
        key:  nameToKey(getCountryName(f)),
        d:    featureToPath(f),
      }))
      .filter((p: any) => p.d);
  }, [worldGeo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    alumni.forEach(a => {
      const k = detectCountry(a.subtitle || '');
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [alumni]);

  const collegiate   = counts['usa-collegiate']  || 0;
  const professional = counts['usa-professional'] || 0;
  const usaTotal     = collegiate + professional;

  if (loading) return (
    <div className="w-full rounded-2xl flex items-center justify-center py-20"
         style={{ background: OCEAN }}>
      <p className="text-gray-600 text-sm">Loading map…</p>
    </div>
  );

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: OCEAN }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>

        {/* Ocean */}
        <rect width={W} height={H} fill={OCEAN} />

        {/* Subtle lat/lng grid */}
        {[100, 200, 300, 400].map(y => (
          <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y}
            stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        ))}
        {[96, 192, 288, 384, 480, 576, 672, 768, 864].map(x => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H}
            stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        ))}

        {/* Every country */}
        {worldPaths.map(({ name, key, d }: any) => {
          const isHL = key && (
            key === 'usa'    ? usaTotal > 0 :
            key !== null     ? (counts[key] || 0) > 0 : false
          );
          return (
            <path key={name} d={d}
              fill={isHL ? HL_FILL : LAND}
              stroke={isHL ? HL_BDR : BORDER}
              strokeWidth={isHL ? 1 : 0.35}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* USA — two compact labels side by side inside the country */}
        {usaTotal > 0 && (() => {
          const baseY = projY(38);
          const bothExist = collegiate > 0 && professional > 0;
          const leftX  = bothExist ? projX(-95) : projX(-90);
          const rightX = projX(-78);
          return (
            <g fontFamily="system-ui,sans-serif">
              {collegiate > 0 && (
                <g textAnchor="middle">
                  <text x={bothExist ? leftX : leftX} y={baseY}
                    fill={LBL_PRI} fontSize="8" fontWeight="700">
                    Collegiate
                  </text>
                  <text x={bothExist ? leftX : leftX} y={baseY + 10}
                    fill={LBL_SUB} fontSize="7">
                    {collegiate} players
                  </text>
                </g>
              )}
              {professional > 0 && (
                <g textAnchor="middle">
                  <text x={rightX} y={baseY}
                    fill={LBL_PRI} fontSize="8" fontWeight="700">
                    Professional
                  </text>
                  <text x={rightX} y={baseY + 10}
                    fill={LBL_SUB} fontSize="7">
                    {professional} players
                  </text>
                </g>
              )}
            </g>
          );
        })()}

        {/* Small/clustered countries — dashed leader lines + offset labels */}
        {LEADERS.map(({ key, label, cLng, cLat, aLng, aLat, ta }) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          const cx = projX(cLng), cy = projY(cLat);
          const ax = projX(aLng), ay = projY(aLat);
          return (
            <g key={key} fontFamily="system-ui,sans-serif">
              <line x1={cx} y1={cy} x2={ax} y2={ay}
                stroke={LEADER} strokeWidth="0.8" />
              <circle cx={cx} cy={cy} r="2.5" fill={DOT_CLR} />
              <text x={ax} y={ay - 4} textAnchor={ta} fill={LBL_PRI} fontSize="8.5" fontWeight="700">
                {label}
              </text>
              <text x={ax} y={ay + 7} textAnchor={ta} fill={LBL_SUB} fontSize="7.5">
                {count} {count === 1 ? 'player' : 'players'}
              </text>
            </g>
          );
        })}

      </svg>
    </div>
  );
};

export default WorldMap;
