/**
 * Hardcoded discount codes — kept identical to the app's
 * constants/discountCodes.ts so a code is worth the same on either.
 *
 * These live in the app rather than in the `coupon_usage` / validate-coupon
 * function because they are promotions with rules the generic coupon engine
 * cannot express — GYAU50 halves only certain sessions on a bill rather than
 * taking a flat amount off the total.
 */

export interface DiscountableItem {
  eventTitle?: string;
  /**
   * Either a full ISO timestamp ("2026-09-26T10:00:00-04:00") or a bare
   * calendar date ("2026-09-26"). Both formats exist in bill_items: live app
   * check-ins carry the time, manual backfills often do not.
   */
  eventDate?: string;
  price?: number;
}

export interface DiscountResult {
  /** Dollars off the bill. 0 when nothing on the bill qualifies. */
  amount: number;
  /** The items the discount was computed from, for display. */
  qualifyingItems: DiscountableItem[];
  /** Human-readable reason when amount is 0. */
  reason?: string;
}

/** Bill months GYAU50 is valid for — September through December 2026. */
const GYAU50_MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];

const GYAU50_RATE = 0.5;

/**
 * True for the weekend group trainings GYAU50 covers: Friday evening,
 * Saturday morning + afternoon, Sunday morning + afternoon.
 *
 * Deliberately strict about what counts as a "group training":
 *  - camps are out, which matters because "Summer Camp, Youth Group" and
 *    "Summer Camp, Pro/College Group" both contain the word "Group";
 *  - privates, individual and small-group sessions are out;
 *  - Patrick Mullins sessions are out ("Group Training by MLS Star Patrick
 *    Mullins" runs Fri 5pm and Sun 3pm but isn't part of the promo);
 *  - venue suffixes are in ("Morning Group Training @Walt Whitman").
 *
 * Friday is the only day where time matters, because Friday also has a 10:00
 * Morning Group Training that does NOT qualify. When a bill item carries no
 * time (backfilled rows often don't) the title is used instead — every Friday
 * evening session is named "...Evening Group Training".
 */
export function isWeekendGroupSession(item: DiscountableItem): boolean {
  const title = String(item.eventTitle || "").toLowerCase();
  const raw = String(item.eventDate || "");
  if (!raw) return false;

  if (title.includes("camp")) return false;
  if (title.includes("small group")) return false;
  if (title.includes("private") || title.includes("individual")) return false;
  if (title.includes("patrick mullins")) return false;
  if (!title.includes("group training")) return false;

  // Anchor bare dates at noon so the weekday survives the timezone conversion.
  const day = raw.slice(0, 10);
  const dow = new Date(`${day}T12:00:00`).getDay(); // 0 Sun … 6 Sat
  if (dow === 6 || dow === 0) return true; // Saturday and Sunday, any session
  if (dow !== 5) return false; // Mon–Thu never qualify

  // Friday: evening only.
  const hasTime = raw.length > 10;
  if (hasTime) {
    const hour = parseInt(raw.slice(11, 13), 10);
    return !isNaN(hour) && hour >= 17;
  }
  return title.includes("evening");
}

/**
 * Evaluate GYAU50 against a bill. `billMonth` is the bill's `month` field
 * ("2026-09"), not the month it is paid in.
 */
export function evaluateGyau50(
  billMonth: string | undefined,
  items: DiscountableItem[] | undefined,
): DiscountResult {
  if (!billMonth || !GYAU50_MONTHS.includes(billMonth)) {
    return {
      amount: 0,
      qualifyingItems: [],
      reason: "GYAU50 applies to September–December bills only.",
    };
  }
  const qualifying = (items || []).filter(isWeekendGroupSession);
  if (qualifying.length === 0) {
    return {
      amount: 0,
      qualifyingItems: [],
      reason: "No weekend group trainings on this bill.",
    };
  }
  const base = qualifying.reduce((sum, i) => sum + (i.price || 0), 0);
  return {
    amount: Math.round(base * GYAU50_RATE * 100) / 100,
    qualifyingItems: qualifying,
  };
}

export interface HardcodedCode {
  code: string;
  label: string;
  evaluate: (
    billMonth: string | undefined,
    items: DiscountableItem[] | undefined,
  ) => DiscountResult;
}

export const HARDCODED_DISCOUNT_CODES: HardcodedCode[] = [
  {
    code: "GYAU50",
    label: "50% off weekend group trainings",
    evaluate: evaluateGyau50,
  },
];

/** Case/whitespace-insensitive lookup. Returns null for unknown codes. */
export function findHardcodedCode(input: string): HardcodedCode | null {
  const needle = String(input || "").trim().toUpperCase();
  return (
    HARDCODED_DISCOUNT_CODES.find((c) => c.code === needle) || null
  );
}
