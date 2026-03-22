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
  if (!cellValue || cellValue.trim() === "") {
    return null;
  }

  const trimmedValue = cellValue.trim();
  
  // Handle =IMAGE() formula
  if (trimmedValue.startsWith("=IMAGE(")) {
    const match = trimmedValue.match(/=IMAGE\("([^"]+)"(?:,[^)]+)?\)/);
    if (match && match[1]) {
      let url = match[1];
      
      // Convert Google Drive URLs to direct download format
      if (url.includes("drive.google.com")) {
        // Format: https://drive.google.com/file/d/FILE_ID/view
        // Convert to: https://drive.google.com/thumbnail?id=FILE_ID&sz=w400
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          // Use thumbnail API which is more reliable for displaying in web
          return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w400`;
        }
        // If already in uc?id= format
        const ucIdMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        if (ucIdMatch && ucIdMatch[1]) {
          return `https://drive.google.com/thumbnail?id=${ucIdMatch[1]}&sz=w400`;
        }
      }
      
      return url;
    }
  }
  
  // Handle direct URLs
  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    // Convert Google Drive URLs even if not in =IMAGE() formula
    if (trimmedValue.includes("drive.google.com")) {
      const fileIdMatch = trimmedValue.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w400`;
      }
      const ucIdMatch = trimmedValue.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (ucIdMatch && ucIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${ucIdMatch[1]}&sz=w400`;
      }
    }
    return trimmedValue;
  }
  
  // Handle data URLs
  if (trimmedValue.startsWith("data:")) {
    return trimmedValue;
  }
  
  return null;
};

const PlayerOverlay: React.FC<{
  player: Player | null;
  onClose: () => void;
  visible: boolean;
}> = ({ player, onClose, visible }) => {
  if (!visible || !player) return null;

  const renderInfoRow = (label: string, value?: string, icon?: string | null) => {
    if (!value || value.trim() === "") return null;

    return (
      <div className="mb-4 px-1">
        <p className="text-gray-600 text-sm font-bold mb-1">{label}:</p>
        <div className="flex items-center">
          {icon && (
            <img
              src={icon}
              alt=""
              className="w-4 h-4 mr-2 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <p className="text-gray-800 text-sm flex-1 break-words">
            {value}
          </p>
        </div>
      </div>
    );
  };

  const leftColumnInfo = [
    { label: "Hometown", value: player.hometown },
    { label: "High School", value: player.school },
    { label: "Youth Club", value: player.youthClub, icon: player.youthClubIcon },
    { label: "Youth National Team", value: player.youthNationalTeam, icon: player.youthNationIcon },
  ];

  const rightColumnInfo = [
    { label: "Position", value: player.position },
    { label: "Club", value: player.club, icon: player.clubIcon },
    { label: "National Team", value: player.nationalTeam, icon: player.nationIcon },
    { label: "College", value: player.college, icon: player.collegeIcon },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Half - Hero Section */}
        <div className="bg-gray-100 pt-8 pb-10 flex flex-col items-center border-b border-gray-200">
          <div className="w-40 h-40 rounded-xl overflow-hidden mb-6 bg-white shadow-md">
            {player.image ? (
              <img
                src={player.image}
                alt={player.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Failed to load image:', player.image);
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-full h-full bg-gray-200 flex items-center justify-center';
                    placeholder.innerHTML = '<span class="text-gray-400 text-sm">No Image</span>';
                    parent.appendChild(placeholder);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-white flex items-center justify-center">
                <span className="text-gray-400 text-sm">No Image</span>
              </div>
            )}
          </div>

          <h2 className="text-gray-800 text-2xl font-bold text-center mb-3">
            {player.name}
          </h2>

          <div className="flex items-center">
            {player.subtitleIcon && (
              <img
                src={player.subtitleIcon}
                alt=""
                className="w-5 h-5 mr-2 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <p className="text-gray-600 text-base text-center">
              {player.subtitle}
            </p>
          </div>
        </div>

        {/* Bottom Half - Info Section */}
        <div className="p-6">
          <div className="flex justify-between gap-4">
            <div className="w-1/2">
              {leftColumnInfo.map((info, index) => (
                <React.Fragment key={`left-${index}`}>
                  {renderInfoRow(info.label, info.value, info.icon)}
                </React.Fragment>
              ))}
            </div>
            <div className="w-1/2">
              {rightColumnInfo.map((info, index) => (
                <React.Fragment key={`right-${index}`}>
                  {renderInfoRow(info.label, info.value, info.icon)}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Back Arrow Button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const AlumniPage = () => {
  const [alumni, setAlumni] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortOption, setSortOption] = useState(SORT_OPTIONS[0]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.entries(FILTERS).forEach(([cat, subs]) => {
      initial[cat] = true;
      subs.forEach((sub) => (initial[sub] = true));
    });
    return initial;
  });

  useEffect(() => {
    fetchAlumniData();
  }, []);

  const fetchAlumniData = async () => {
    try {
      setLoading(true);

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}&valueRenderOption=FORMULA`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${data.error?.message || "Unknown error"}`,
        );
      }

      if (data.error) {
        throw new Error(`Google Sheets API error: ${data.error.message}`);
      }

      if (!data.values || data.values.length === 0) {
        setError("No data found in the spreadsheet");
        return;
      }

      const [headers, ...rows] = data.values;
      const nonEmptyRows = rows.filter((row: any[]) =>
        row.some((cell) => cell && cell.toString().trim() !== ""),
      );

      if (nonEmptyRows.length === 0) {
        setError("No data rows found");
        return;
      }

      const transformedData: Player[] = nonEmptyRows.map((row: any[], index: number) => {
        const alumniObject: any = {};
        headers.forEach((header: string, headerIndex: number) => {
          alumniObject[header] = row[headerIndex] || "";
        });

        const processed = {
          ...alumniObject,
          image: processSheetAsset(alumniObject.image),
          subtitleIcon: processSheetAsset(alumniObject.subtitleIcon),
          youthClubIcon: processSheetAsset(alumniObject.youthClubIcon),
          youthNationIcon: processSheetAsset(alumniObject.youthNationIcon),
          nationIcon: processSheetAsset(alumniObject.nationIcon),
          clubIcon: processSheetAsset(alumniObject.clubIcon),
          collegeIcon: processSheetAsset(alumniObject.collegeIcon),
        };

        // Debug log for first few entries
        if (index < 3) {
          console.log(`Player ${index}:`, {
            name: processed.name,
            originalImage: alumniObject.image,
            processedImage: processed.image
          });
        }

        return processed;
      });

      console.log(`Loaded ${transformedData.length} alumni`);
      setAlumni(transformedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching alumni:', err);
      setError("Failed to fetch alumni data: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const closeMenus = () => {
    setFilterOpen(false);
    setSortOpen(false);
  };

  const openPlayerOverlay = (player: Player) => {
    console.log('Opening player:', player.name, 'Image URL:', player.image);
    setSelectedPlayer(player);
    setOverlayVisible(true);
  };

  const closePlayerOverlay = () => {
    setOverlayVisible(false);
    setSelectedPlayer(null);
  };

  const toggleCategory = (category: string) => {
    setSelectedFilters((prev) => {
      const subs = FILTERS[category as keyof typeof FILTERS];
      const allSubsSelected = subs.every((sub) => prev[sub]);
      const newValue = !allSubsSelected;
      const next = { ...prev, [category]: newValue };
      subs.forEach((sub) => {
        next[sub] = newValue;
      });
      return next;
    });
  };

  const toggleSubFilter = (sub: string, parent: string) => {
    setSelectedFilters((prev) => {
      const next = { ...prev, [sub]: !prev[sub] };
      const subs = FILTERS[parent as keyof typeof FILTERS];
      const allSelected = subs.every((s) => next[s]);
      next[parent] = allSelected;
      return next;
    });
  };

  if (loading) {
    return <LoadingScreen message="Loading alumni..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center">
            <p className="text-red-500 text-base mb-6 max-w-md">{error}</p>
            <button
              onClick={fetchAlumniData}
              className="bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filtered = alumni.filter((alum) => {
    const nameMatch =
      alum.name && alum.name.toLowerCase().includes(searchText.toLowerCase());
    const subMatch =
      alum.subtitle &&
      alum.subtitle.toLowerCase().includes(searchText.toLowerCase());
    if (!nameMatch && !subMatch) return false;

    const isUni =
      alum.subtitle && alum.subtitle.toLowerCase().includes("university");
    const division = getDivision(alum.subtitle || "");
    const region = getRegion(alum.subtitle || "");
    const collOK = isUni && selectedFilters[division];
    const profOK = !isUni && selectedFilters[region];
    return collOK || profOK;
  });

  const sorted = filtered.sort((a, b) => {
    const aNameParts = (a.name || "").split(" ");
    const bNameParts = (b.name || "").split(" ");
    const aFirst = aNameParts[0] || "";
    const aLast = aNameParts[aNameParts.length - 1] || "";
    const bFirst = bNameParts[0] || "";
    const bLast = bNameParts[bNameParts.length - 1] || "";

    switch (sortOption) {
      case "Last Name A-Z":
        return aLast.localeCompare(bLast);
      case "Last Name Z-A":
        return bLast.localeCompare(aLast);
      case "First Name A-Z":
        return aFirst.localeCompare(bFirst);
      case "First Name Z-A":
        return bFirst.localeCompare(aFirst);
      default:
        return 0;
    }
  });

  const renderCheckbox = (
    label: string,
    checked: boolean,
    onPress: () => void,
    isParent = false
  ) => (
    <button
      onClick={onPress}
      className="flex justify-between items-center ml-2 mt-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors w-full text-left"
    >
      <span className={`text-gray-800 text-sm ${isParent ? 'font-bold' : ''}`}>
        {label}
      </span>
      <div
        className={`w-4 h-4 border border-gray-800 rounded flex items-center justify-center ${
          checked ? 'bg-gray-800' : 'bg-transparent'
        }`}
      >
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

      <div
        className={filterOpen || sortOpen ? 'cursor-pointer' : ''}
        onClick={closeMenus}
      >
        <div className="pt-20">
          {/* Header */}
          <div className="relative mb-6">
            <img
              src={images.alumniHeader}
              alt="Alumni Header"
              className="w-full h-64 object-cover"
              style={{ objectPosition: '50% 30%' }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <h1 className="text-white text-4xl font-medium">
                Players & Alumni
              </h1>
            </div>
          </div>

          {/* Search, Filter, Sort Controls */}
          <div className="flex gap-3 px-6 mb-6">
            {/* Filter */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterOpen((f) => !f);
                  setSortOpen(false);
                }}
                className="flex items-center gap-2 text-white text-sm"
              >
                <span>Filter</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>

              {filterOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-8 left-0 bg-white rounded-lg p-3 min-w-48 z-50 shadow-lg"
                >
                  {Object.entries(FILTERS).map(([cat, subs]) => (
                    <div key={cat} className="mb-3 last:mb-0">
                      {renderCheckbox(
                        cat,
                        selectedFilters[cat],
                        () => toggleCategory(cat),
                        true
                      )}
                      {subs.map((sub) => (
                        <div key={sub} className="ml-4">
                          {renderCheckbox(sub, selectedFilters[sub], () =>
                            toggleSubFilter(sub, cat)
                          )}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSortOpen((s) => !s);
                  setFilterOpen(false);
                }}
                className="flex items-center gap-2 text-white text-sm"
              >
                <span>Sort</span>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {sortOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-8 left-0 bg-white rounded-lg p-2 w-40 z-50 shadow-lg"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSortOption(opt);
                        setSortOpen(false);
                      }}
                      className="block w-full text-left px-3 py-1 text-sm text-gray-800 hover:bg-gray-100 rounded"
                    >
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
                placeholder="Search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-transparent border-b border-white text-white text-sm pb-1 outline-none placeholder-gray-400"
              />
              {!searchText && (
                <svg className="w-3.5 h-3.5 text-gray-400 absolute right-0 top-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>

          {/* Alumni Cards Grid - Landscape style (horizontal rows) */}
          <div className="px-6 pb-12">
            {sorted.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No alumni found matching your criteria</p>
              </div>
            ) : (
              sorted.map((alum, i) => (
                <button
                  key={`alum-${i}`}
                  onClick={() => openPlayerOverlay(alum)}
                  className="flex items-center gap-4 w-full bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4 hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="w-20 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                    {alum.image ? (
                      <img
                        src={alum.image}
                        alt={alum.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Image load error for:', alum.name, alum.image);
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('.placeholder-text')) {
                            const placeholder = document.createElement('div');
                            placeholder.className = 'placeholder-text w-full h-full flex items-center justify-center';
                            placeholder.innerHTML = '<span class="text-gray-500 text-xs">No Image</span>';
                            parent.appendChild(placeholder);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-500 text-xs">No Image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-base font-bold mb-1 truncate">
                      {alum.name || ""}
                    </h3>
                    <p className="text-gray-400 text-sm truncate">
                      {alum.subtitle || ""}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <PlayerOverlay
        player={selectedPlayer}
        visible={overlayVisible}
        onClose={closePlayerOverlay}
      />

      {/* Footer */}
      <footer className="bg-black py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AlumniPage;
