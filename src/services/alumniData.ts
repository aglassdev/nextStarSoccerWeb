import { ALUMNI_LOCAL_IMAGES } from '../constants/alumniLocalImages';

// The alumni list comes from a Google Sheet. It's fetched once per visit and
// shared: the background preload asks for it after the site opens, so the
// Alumni page usually has it (and its first photos) before it's opened.

const SHEET_ID = "1SnLA2-p6zBPOP4DvgYV4hlaloX6w6FA0kWMMWtcyEk8";
const API_KEY = "AIzaSyAZPGNU3kwQG9xqrUrm3idVmHhgZz0PfY0";
const RANGE = "Players!A1:Q150";

// Shown first, in this order, until a sort is picked (names as in the sheet).
export const FEATURED = [
  "Emily Fox",
  "Matai Akinmboni",
  "Kevin Paredes",
  "Lily Yohannes",
  "Luka Bentt",
  "Aaron Heard",
  "Bryang Kayo",
  "Donovan Pines",
  "Gabriel Segal",
  "Jean-Claude 'J.C.' Ngando",
  "Hosei Kijima",
  "Ian Harkes",
];

/** The cards loaded before the page shows (the first rows of the grid). */
export const FIRST_SCREEN_CARDS = 12;

export interface Player {
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

// A Drive file is served from the site when it has been copied there (as
// WebP), and from Drive's thumbnail service otherwise.
const driveAsset = (id: string) =>
  ALUMNI_LOCAL_IMAGES.has(id)
    ? `/assets/alumni/${id}.webp`
    : `https://drive.google.com/thumbnail?id=${id}&sz=w400`;

const fromDriveUrl = (url: string): string | null => {
  if (!url.includes("drive.google.com")) return null;
  const id = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)?.[1] || url.match(/[?&]id=([a-zA-Z0-9-_]+)/)?.[1];
  return id ? driveAsset(id) : null;
};

const processSheetAsset = (cellValue: string): string | null => {
  if (!cellValue || cellValue.trim() === "") return null;
  const trimmedValue = cellValue.trim();
  if (trimmedValue.startsWith("=IMAGE(")) {
    const match = trimmedValue.match(/=IMAGE\("([^"]+)"(?:,[^)]+)?\)/);
    if (match && match[1]) return fromDriveUrl(match[1]) || match[1];
  }
  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    return fromDriveUrl(trimmedValue) || trimmedValue;
  }
  if (trimmedValue.startsWith("data:")) return trimmedValue;
  return null;
};

async function fetchAlumni(): Promise<Player[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}&valueRenderOption=FORMULA`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  if (data.error) throw new Error(`Google Sheets API error: ${data.error.message}`);
  if (!data.values || data.values.length === 0) throw new Error("No data found");
  const [headers, ...rows] = data.values;
  const nonEmptyRows = rows.filter((row: any[]) => row.some((cell) => cell && cell.toString().trim() !== ""));
  if (nonEmptyRows.length === 0) throw new Error("No data rows found");
  return nonEmptyRows.map((row: any[]) => {
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
}

let cached: Promise<Player[]> | null = null;

/** The alumni list, fetched once and shared. `refresh` fetches it again. */
export function loadAlumni(refresh = false): Promise<Player[]> {
  if (!cached || refresh) {
    cached = fetchAlumni();
    cached.catch(() => { cached = null; }); // a failed fetch is retried next time
  }
  return cached;
}

/** Featured players first (in FEATURED order), then the rest. */
export const featuredRank = (p: Player) => {
  const i = FEATURED.indexOf((p.name || "").trim());
  return i === -1 ? Infinity : i;
};

const lastName = (p: Player) => {
  const parts = (p.name || "").split(" ");
  return parts[parts.length - 1] || "";
};

/** The grid's order before a sort is picked: featured first, then last name A-Z. */
export const defaultOrder = (players: Player[]) =>
  [...players].sort((a, b) => featuredRank(a) - featuredRank(b) || lastName(a).localeCompare(lastName(b)));

/** Photos and logos on the first cards of the grid, as it first opens. */
export const firstScreenAlumniImages = (players: Player[]) =>
  defaultOrder(players.filter((p) => p.name || p.subtitle))
    .slice(0, FIRST_SCREEN_CARDS)
    .flatMap((p) => [p.image, p.subtitleIcon]);
