import React, { useState, useEffect } from 'react';
import Navigation from '../components/layout/Navigation';
import LoadingScreen from '../components/common/LoadingScreen';
import { images } from '../constants/images';

const SHEET_ID = "1SnLA2-p6zBPOP4DvgYV4hlaloX6w6FA0kWMMWtcyEk8";
const API_KEY = "AIzaSyAZPGNU3kwQG9xqrUrm3idVmHhgZz0PfY0";
const RANGE = "Players!A1:Q150";

const FILTERS = {
  Collegiate: ["D1", "D2", "D3"],
  Professional: ["North America", "Europe", "Oceania"],
};

const SORT_OPTIONS = [
  "Last Name A-Z",
  "Last Name Z-A",
  "First Name A-Z",
  "First Name Z-A",
];

interface Player {
  name: string;
  subtitle: string;
  image: string | null;
  subtitleIcon: string | null;
  hometown?: string;
  school?: string;
  youthClub?: string;
  youthClubIcon?: string | null;
  youthNationalTeam?: string;
  youthNationIcon?: string | null;
  position?: string;
  club?: string;
  clubIcon?: string | null;
  nationalTeam?: string;
  nationIcon?: string | null;
  college?: string;
  collegeIcon?: string | null;
}

const getDivision = (subtitle: string) => {
  if (!subtitle) return "D1";
  const s = subtitle.toLowerCase();
  const d1 = [
    "binghamton", "yale", "princeton", "georgetown", "duke", "harvard",
    "columbia", "cornell", "virginia", "bucknell", "pennsylvania", "colgate",
    "howard", "american", "elon", "high point", "wake forest", "william & mary",
    "radford", "manhattan", "providence", "george mason", "george washington",
    "massachusetts amherst", "wilmington", "university of california, los angeles",
    "illinois at chicago", "ohio state", "akron", "james madison", "old dominion",
    "lynchburg",
  ];
  const d3 = ["emory", "haverford", "st. louis"];
  if (d1.some((u) => s.includes(u))) return "D1";
  if (d3.some((u) => s.includes(u))) return "D3";
  return "D2";
};

const getRegion = (subtitle: string) => {
  if (!subtitle) return "North America";
  const s = subtitle.toLowerCase();
  const europe = [
    "bournemouth", "wolfsburg", "leverkusen", "westerlo", "leuven",
    "arsenal", "lyonnes", "grazer", "jiskra", "dukla",
  ];
  const oceania = ["manurewa", "birkenhead"];
  if (europe.some((u) => s.includes(u))) return "Europe";
  if (oceania.some((u) => s.includes(u))) return "Oceania";
  return "North America";
};

const processSheetAsset = (cellValue: string): string | null => {
  if (!cellValue || cellValue.trim() === "") return null;
  const trimmedValue = cellValue.trim();
  if (trimmedValue.startsWith("=IMAGE(")) {
    const match = trimmedValue.match(/=IMAGE\("([^"]+)"(?:,[^)]+)?\)/);
    if (match && match[1]) {
      let url = match[1];
      if (url.includes("drive.google.com")) {
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        if (fileIdMatch && fileIdMatch[1]) return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w400`;
        const ucIdMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        if (ucIdMatch && ucIdMatch[1]) return `https://drive.google.com/thumbnail?id=${ucIdMatch[1]}&sz=w400`;
      }
      return url;
    }
  }
  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    if (trimmedValue.includes("drive.google.com")) {
      const fileIdMatch = trimmedValue.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch && fileIdMatch[1]) return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w400`;
      const ucIdMatch = trimmedValue.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (ucIdMatch && ucIdMatch[1]) return `https://drive.google.com/thumbnail?id=${ucIdMatch[1]}&sz=w400`;
    }
    return trimmedValue;
  }
  if (trimmedValue.startsWith("data:")) return trimmedValue;
  return null;
};

/* ─── Flip Card ─────────────────────────────────────────────────────────── */
const FlipCard: React.FC<{ player: Player }> = ({ player }) => {
  const [flipped, setFlipped] = useState(false);

  const infoItems = [
    { label: 'Hometown', value: player.hometown },
    { label: 'High School', value: player.school },
    { label: 'Position', value: player.position },
    { label: 'Youth Club', value: player.youthClub, icon: player.youthClubIcon },
    { label: 'College', value: player.college, icon: player.collegeIcon },
    { label: 'Club', value: player.club, icon: player.clubIcon },
    { label: 'National Team', value: player.nationalTeam, icon: player.nationIcon },
  ].filter((item) => item.value && item.value.trim() !== '');

  return (
    <div
      className="flip-card cursor-pointer"
      onClick={() => setFlipped((f) => !f)}
      style={{ perspective: '1000px' }}
    >
      <div
        className="flip-card-inner relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* FRONT */}
        <div
          className="flip-card-front absolute inset-0 rounded-2xl overflow-hidden bg-gray-900 border border-white/5"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Photo */}
          <div className="w-full aspect-[3/4] overflow-hidden">
            {player.image ? (
              <img
                src={player.image}
                alt={player.name}
                className="w-full h-full object-cover object-top"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          {/* Name + subtitle */}
          <div className="p-3">
            <p className="text-white text-sm font-semibold leading-tight truncate">{player.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {player.subtitleIcon && (
                <img src={player.subtitleIcon} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <p className="text-gray-400 text-xs truncate">{player.subtitle}</p>
            </div>
          </div>

          {/* Tap hint */}
          <div className="absolute top-2 right-2 w-6 h-6 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* BACK */}
        <div
          className="flip-card-back absolute inset-0 rounded-2xl overflow-hidden bg-gray-900 border border-white/10 p-4 flex flex-col"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
            {player.image ? (
              <img src={player.image} alt={player.name}
                className="w-9 h-9 rounded-full object-cover object-top flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-700 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-white text-xs font-bold leading-tight truncate">{player.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {player.subtitleIcon && (
                  <img src={player.subtitleIcon} alt="" className="w-3 h-3 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
                <p className="text-gray-400 text-[10px] truncate">{player.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
            {infoItems.length > 0 ? infoItems.map((item, i) => (
              <div key={i}>
                <p className="text-gray-500 text-[9px] uppercase tracking-wider">{item.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.icon && (
                    <img src={item.icon} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <p className="text-white text-xs leading-tight">{item.value}</p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-xs italic mt-4 text-center">No additional info</p>
            )}
          </div>

          {/* Close hint */}
          <p className="text-gray-600 text-[9px] text-center mt-3 uppercase tracking-widest">tap to flip back</p>
        </div>
      </div>
    </div>
  );
};

/* ─── Main page ─────────────────────────────────────────────────────────── */
const AlumniPage = () => {
  const [alumni, setAlumni] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortOption, setSortOption] = useState(SORT_OPTIONS[0]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.entries(FILTERS).forEach(([cat, subs]) => {
      initial[cat] = true;
      subs.forEach((sub) => (initial[sub] = true));
    });
    return initial;
  });

  useEffect(() => { fetchAlumniData(); }, []);

  const fetchAlumniData = async () => {
    try {
      setLoading(true);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}&valueRenderOption=FORMULA`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (data.error) throw new Error(`Google Sheets API error: ${data.error.message}`);
      if (!data.values || data.values.length === 0) { setError("No data found"); return; }
      const [headers, ...rows] = data.values;
      const nonEmptyRows = rows.filter((row: any[]) => row.some((cell) => cell && cell.toString().trim() !== ""));
      if (nonEmptyRows.length === 0) { setError("No data rows found"); return; }
      const transformedData: Player[] = nonEmptyRows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, idx: number) => { obj[header] = row[idx] || ""; });
        return {
          ...obj,
          image: processSheetAsset(obj.image),
          subtitleIcon: processSheetAsset(obj.subtitleIcon),
          youthClubIcon: processSheetAsset(obj.youthClubIcon),
          youthNationIcon: processSheetAsset(obj.youthNationIcon),
          nationIcon: processSheetAsset(obj.nationIcon),
          clubIcon: processSheetAsset(obj.clubIcon),
          collegeIcon: processSheetAsset(obj.collegeIcon),
        };
      });
      setAlumni(transformedData);
      setError(null);
    } catch (err) {
      setError("Failed to fetch alumni data: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const closeMenus = () => { setFilterOpen(false); setSortOpen(false); };

  const toggleCategory = (category: string) => {
    setSelectedFilters((prev) => {
      const subs = FILTERS[category as keyof typeof FILTERS];
      const allSubsSelected = subs.every((sub) => prev[sub]);
      const newValue = !allSubsSelected;
      const next = { ...prev, [category]: newValue };
      subs.forEach((sub) => { next[sub] = newValue; });
      return next;
    });
  };

  const toggleSubFilter = (sub: string, parent: string) => {
    setSelectedFilters((prev) => {
      const next = { ...prev, [sub]: !prev[sub] };
      const subs = FILTERS[parent as keyof typeof FILTERS];
      next[parent] = subs.every((s) => next[s]);
      return next;
    });
  };

  if (loading) return <LoadingScreen message="Loading alumni..." />;

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center">
            <p className="text-red-500 text-base mb-6 max-w-md">{error}</p>
            <button onClick={fetchAlumniData} className="bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const filtered = alumni.filter((alum) => {
    const nameMatch = alum.name && alum.name.toLowerCase().includes(searchText.toLowerCase());
    const subMatch = alum.subtitle && alum.subtitle.toLowerCase().includes(searchText.toLowerCase());
    if (!nameMatch && !subMatch) return false;
    const isUni = alum.subtitle && alum.subtitle.toLowerCase().includes("university");
    const division = getDivision(alum.subtitle || "");
    const region = getRegion(alum.subtitle || "");
    return (isUni && selectedFilters[division]) || (!isUni && selectedFilters[region]);
  });

  const sorted = [...filtered].sort((a, b) => {
    const aParts = (a.name || "").split(" ");
    const bParts = (b.name || "").split(" ");
    const aFirst = aParts[0] || "", aLast = aParts[aParts.length - 1] || "";
    const bFirst = bParts[0] || "", bLast = bParts[bParts.length - 1] || "";
    switch (sortOption) {
      case "Last Name A-Z": return aLast.localeCompare(bLast);
      case "Last Name Z-A": return bLast.localeCompare(aLast);
      case "First Name A-Z": return aFirst.localeCompare(bFirst);
      case "First Name Z-A": return bFirst.localeCompare(aFirst);
      default: return 0;
    }
  });

  const renderCheckbox = (label: string, checked: boolean, onPress: () => void, isParent = false) => (
    <button onClick={onPress} className="flex justify-between items-center ml-2 mt-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors w-full text-left">
      <span className={`text-gray-800 text-sm ${isParent ? 'font-bold' : ''}`}>{label}</span>
      <div className={`w-4 h-4 border border-gray-800 rounded flex items-center justify-center ${checked ? 'bg-gray-800' : 'bg-transparent'}`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <div className={filterOpen || sortOpen ? 'cursor-pointer' : ''} onClick={closeMenus}>
        <div className="pt-20">

          {/* Header banner */}
          <div className="relative mb-8">
            <img src={images.alumniHeader} alt="Alumni Header" className="w-full h-64 object-cover" style={{ objectPosition: '50% 30%' }} />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center">
              <h1 className="text-white text-4xl font-bold font-lt-wave">Players & Alumni</h1>
              <p className="text-white/50 text-sm mt-2 uppercase tracking-widest">{sorted.length} players</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-4 px-6 mb-8 items-center">
            {/* Filter */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setFilterOpen((f) => !f); setSortOpen(false); }}
                className="flex items-center gap-2 text-white text-sm border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filter</span>
              </button>
              {filterOpen && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-10 left-0 bg-white rounded-xl p-3 min-w-52 z-50 shadow-2xl">
                  {Object.entries(FILTERS).map(([cat, subs]) => (
                    <div key={cat} className="mb-3 last:mb-0">
                      {renderCheckbox(cat, selectedFilters[cat], () => toggleCategory(cat), true)}
                      {subs.map((sub) => (
                        <div key={sub} className="ml-4">
                          {renderCheckbox(sub, selectedFilters[sub], () => toggleSubFilter(sub, cat))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setSortOpen((s) => !s); setFilterOpen(false); }}
                className="flex items-center gap-2 text-white text-sm border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <span>Sort</span>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {sortOpen && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-10 left-0 bg-white rounded-xl p-2 w-44 z-50 shadow-2xl">
                  {SORT_OPTIONS.map((opt) => (
                    <button key={opt} onClick={() => { setSortOption(opt); setSortOpen(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 transition-colors ${sortOption === opt ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Search players..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white text-sm px-4 py-1.5 rounded-lg outline-none placeholder-gray-500 focus:border-white/40 transition-colors"
              />
              {!searchText && (
                <svg className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>

          {/* Cards grid */}
          <div className="px-6 pb-16">
            {sorted.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No players found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sorted.map((alum, i) => (
                  <div key={`alum-${i}`} style={{ height: '280px' }}>
                    <FlipCard player={alum} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="bg-black py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
          </p>
        </div>
      </footer>

      <style>{`
        .flip-card { width: 100%; height: 100%; }
        .flip-card:hover .flip-card-inner { transform: rotateY(5deg); }
        .flip-card-inner { width: 100%; height: 100%; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AlumniPage;
