import PdfPrinter from "pdfmake";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The two monthly statements, as PDFs:
//  - hourlyStatement: a coach's sessions, pay for each, deductions, total
//  - shareReport: Phillip Gyau's session share report for the month (the
//    same layout as his quarterly reports: 50% / 30% summaries, then every
//    session with gross revenue, costs, net revenue and what's collected)

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const printer = new PdfPrinter({
  Helvetica: { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" },
  Wave: { normal: path.join(ASSETS, "LTWave-Regular.otf"), bold: path.join(ASSETS, "LTWave-Bold.otf") },
});
const LOGO = path.join(ASSETS, "NextStarBallBlack.png");

const ET = "America/New_York";
const INK = "#111111", MUTED = "#666666", FAINT = "#999999", RULE = "#E3E3E3";

export const money = (v) => {
  const s = `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return v < -0.004 ? `–${s}` : s;
};
const cents = (n) => Math.round(n * 100) / 100;
export const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};
const when = (iso, dateOnly) => {
  const d = new Date(iso);
  const part = (o) => d.toLocaleDateString("en-US", { ...o, timeZone: ET });
  const day = `${part({ weekday: "short" })} ${part({ month: "short", day: "numeric" })}`;
  if (dateOnly) return day;
  return `${day} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }).replace(":00 ", " ")}`;
};
const shortDay = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const REASONS = { late: "Late", noShow: "No-show", other: "Other" };
const deductionLabel = (d) => [REASONS[d.reason] || "Deduction", d.note].filter(Boolean).join(" · ");

const header = (docTitle, prepared) => ({
  columns: [
    { columns: [{ image: LOGO, width: 20 }, { text: "NEXT STAR SOCCER", font: "Wave", bold: true, fontSize: 11, characterSpacing: 0.8, margin: [8, 4, 0, 0] }], width: "*" },
    { stack: [{ text: docTitle, bold: true, fontSize: 8.5 }, { text: `Prepared ${prepared}`, fontSize: 8.5, color: MUTED }], alignment: "right", width: "auto" },
  ],
});
const rule = (w = 1.5, color = INK, top = 12, bottom = 0) => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: w, lineColor: color }], margin: [0, top, 0, bottom],
});
const title = (name, sub) => [
  { text: name, font: "Wave", bold: true, fontSize: 24, margin: [0, 18, 0, 2] },
  { text: sub, fontSize: 11, color: "#444444", margin: [0, 0, 0, 16] },
];
const cell = (text, opts = {}) => ({ text, fontSize: 8.5, margin: [0, 3.5, 0, 3.5], ...opts });
const th = (text, alignment = "left", sub) => ({
  stack: [{ text: text.toUpperCase(), fontSize: 6.8, bold: true, color: "#444444", characterSpacing: 0.4 }, ...(sub ? [{ text: sub, fontSize: 6.5, color: FAINT }] : [])],
  alignment, margin: [0, 0, 0, 4],
});
// Thin rules between rows, a heavier one under the header and over a total
const listLayout = (totalRow = true) => ({
  hLineWidth: (i, node) => (i === 1 ? 0.9 : totalRow && i === node.table.body.length - 1 ? 0.9 : i === 0 || i === node.table.body.length ? 0 : 0.4),
  hLineColor: (i, node) => (i === 1 || (totalRow && i === node.table.body.length - 1) ? INK : RULE),
  vLineWidth: () => 0,
  paddingLeft: (i) => (i === 0 ? 0 : 5), paddingRight: (i, node) => (i === node.table.widths.length - 1 ? 0 : 5),
});

const render = (content) => new Promise((resolve, reject) => {
  const doc = printer.createPdfKitDocument({
    pageSize: "LETTER",
    pageMargins: [36, 40, 36, 44],
    defaultStyle: { font: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.15 },
    content,
    footer: (page, pages) => (pages > 1 ? { text: `${page} / ${pages}`, alignment: "right", fontSize: 7.5, color: FAINT, margin: [0, 12, 36, 0] } : null),
  });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);
  doc.end();
});

const deductionRows = (deductions) => deductions.map((d) => [
  cell(d.date ? shortDay(d.date) : "", { color: MUTED }),
  cell(deductionLabel(d), { colSpan: 2 }), {},
  cell(`– ${money(d.amount)}`, { alignment: "right", color: "#B42318" }),
]);

// ── Every coach but Phillip ──────────────────────────────────────────────────

export function hourlyTotals(s) {
  const sessions = cents(s.sessions.reduce((t, x) => t + (x.amount || 0), 0));
  const deductions = cents((s.deductions || []).reduce((t, d) => t + (d.amount || 0), 0));
  return { sessions, deductions, total: cents(sessions - deductions) };
}

export function hourlyStatement(s, prepared) {
  const t = hourlyTotals(s);
  const rows = [...s.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const body = [
    [th("Date"), th("Session", "left", "location"), th("Hours & rate"), th("Pay", "right")],
    ...rows.map((x) => [
      cell(when(x.date, x.dateOnly)),
      { stack: [{ text: x.title, fontSize: 8.5 }, ...(x.facility && x.facility !== "—" ? [{ text: x.facility, fontSize: 7.5, color: FAINT }] : [])], margin: [0, 3.5, 0, 3.5] },
      cell(x.basis || "", { color: MUTED }),
      cell(money(x.amount), { alignment: "right" }),
    ]),
    [cell("Sessions", { bold: true, colSpan: 3 }), {}, {}, cell(money(t.sessions), { bold: true, alignment: "right" })],
  ];
  const content = [
    header("Coach Statement", prepared), rule(),
    ...title(s.coach, `${monthLabel(s.month)}  ·  ${rows.length} session${rows.length === 1 ? "" : "s"}`),
    { table: { headerRows: 1, widths: [100, "*", 110, 70], body, dontBreakRows: true }, layout: listLayout() },
  ];
  if ((s.deductions || []).length) {
    content.push(
      { text: "DEDUCTIONS", fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.6, margin: [0, 16, 0, 2] },
      { table: { widths: [100, "*", 110, 70], body: deductionRows(s.deductions) }, layout: listLayout(false) },
    );
  }
  content.push(
    rule(1.5, INK, 14, 0),
    { columns: [{ text: "Total earned", font: "Wave", bold: true, fontSize: 14 }, { text: money(t.total), font: "Wave", bold: true, fontSize: 14, alignment: "right" }], margin: [0, 8, 0, 0] },
    ...(t.deductions ? [{ text: `${money(t.sessions)} for sessions, less ${money(t.deductions)} in deductions`, fontSize: 8.5, color: MUTED, margin: [0, 3, 0, 0] }] : []),
    { text: "Questions about this statement? Reply to this email.", fontSize: 8, color: FAINT, margin: [0, 26, 0, 0] },
  );
  return render(content);
}

// ── Phillip Gyau: the session share report, for one month ────────────────────

const sum = (rows, k) => rows.reduce((t, x) => t + (x[k] || 0), 0);
const costOf = (x) => (x.coachCost || 0) + (x.facilityCost || 0) + (x.otherCost || 0);

function shareSummary(rows, rate) {
  const exp = sum(rows, "gross"), col = sum(rows, "collected");
  const coach = sum(rows, "coachCost"), fac = sum(rows, "facilityCost"), other = sum(rows, "otherCost");
  const ep = exp - coach - fac - other, cp = col - coach - fac - other;
  return {
    n: rows.length, rev: [exp, col], coach: [coach, coach], fac: [fac, fac], other: [other, other],
    profit: [ep, cp], gross: [ep * rate, cp * rate], admin: [ep * 0.05, cp * 0.05],
    share: [cents(sum(rows, "expectedShare")), cents(sum(rows, "share"))],
  };
}

export function shareTotals(s) {
  const att = s.sessions.filter((x) => x.attended), miss = s.sessions.filter((x) => !x.attended);
  const a = shareSummary(att, 0.5), m = shareSummary(miss, 0.3);
  const deductions = cents((s.deductions || []).reduce((t, d) => t + (d.amount || 0), 0));
  const expected = cents(a.share[0] + m.share[0]), collected = cents(a.share[1] + m.share[1]);
  return { att, miss, a, m, deductions, expected, collected, total: cents(collected - deductions), expectedTotal: cents(expected - deductions) };
}

const summaryBlock = (heading, rateLabel, sm) => {
  const line = (label, pair, opts = {}) => [
    { text: label, fontSize: 9, margin: [0, 4, 0, 4], color: opts.cost ? "#555555" : INK, bold: !!opts.bold },
    { text: `${opts.cost ? "– " : ""}${money(pair[0])}`, fontSize: 9, alignment: "right", margin: [0, 4, 0, 4], color: opts.cost ? "#555555" : INK, bold: !!opts.bold },
    { text: `${opts.cost ? "– " : ""}${money(pair[1])}`, fontSize: 9, alignment: "right", margin: [0, 4, 0, 4], color: opts.cost ? "#555555" : INK, bold: !!opts.bold },
  ];
  const body = [
    [{ text: "" }, th("Expected", "right", "everything billed"), th("Collected", "right", "bills paid")],
    line("Gross revenue", sm.rev, { bold: true }),
    line("Coach pay", sm.coach, { cost: true }),
    line("Facility hire", sm.fac, { cost: true }),
    ...(Math.abs(sm.other[0]) > 0.004 ? [line("Other session costs", sm.other, { cost: true })] : []),
    line("Session profit", sm.profit, { bold: true }),
    line(`${rateLabel} of profit`, sm.gross),
    line("Admin fee (5% of profit)", sm.admin, { cost: true }),
    line("Phillip's share", sm.share, { bold: true }),
  ];
  const last = body.length - 1;
  return {
    stack: [
      { columns: [{ text: heading, font: "Wave", bold: true, fontSize: 11.5, width: "*" }, { text: `${rateLabel} · ${sm.n} session${sm.n === 1 ? "" : "s"}`, fontSize: 7.5, color: "#444444", alignment: "right", width: "auto", margin: [0, 3, 0, 0] }], margin: [0, 0, 0, 4] },
      {
        table: { widths: ["*", 62, 62], body },
        layout: {
          hLineWidth: (i) => (i === 1 ? 0.9 : i === last ? 1.2 : i === 0 || i === body.length ? 0 : 0.4),
          hLineColor: (i) => (i === 1 || i === last ? INK : RULE),
          vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: (i) => (i === 2 ? 0 : 4),
        },
      },
    ],
  };
};

const card = (k, v, s, dark) => ({
  table: { widths: ["*"], body: [[{
    stack: [
      { text: k.toUpperCase(), fontSize: 7, bold: true, color: dark ? "#BBBBBB" : MUTED, characterSpacing: 0.6 },
      { text: v, font: "Wave", bold: true, fontSize: 16, margin: [0, 3, 0, 1], color: dark ? "#FFFFFF" : INK },
      { text: s, fontSize: 7.5, color: dark ? "#BBBBBB" : MUTED },
    ],
    fillColor: dark ? INK : null, margin: [8, 7, 8, 7],
  }]] },
  layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => (dark ? INK : "#D6D6D6"), vLineColor: () => (dark ? INK : "#D6D6D6") },
});

const shareSessionTable = (heading, rows) => {
  const players = sum(rows, "players"), gross = sum(rows, "gross"), cost = rows.reduce((t, x) => t + costOf(x), 0);
  const body = [
    [th("Date"), th("Session", "left", "location"), th("Players", "right"), th("Gross revenue", "right", "billed"), th("Costs", "right", "coach + facility"), th("Net revenue", "right", "gross – costs"), th("Collected", "right", "bills paid")],
    ...[...rows].sort((a, b) => a.date.localeCompare(b.date)).map((x) => {
      const c = costOf(x);
      return [
        cell(when(x.date, x.dateOnly)),
        { stack: [{ text: x.title, fontSize: 8.3 }, ...(x.facility && x.facility !== "—" ? [{ text: x.facility, fontSize: 7.3, color: FAINT }] : [])], margin: [0, 3.5, 0, 3.5] },
        cell(String(x.players || 0), { alignment: "right" }),
        cell(money(x.gross), { alignment: "right" }),
        cell(c ? `– ${money(c)}` : money(0), { alignment: "right", color: MUTED }),
        cell(money(x.gross - c), { alignment: "right", bold: true }),
        cell(money(x.collected), { alignment: "right" }),
      ];
    }),
    [cell("Total", { bold: true, colSpan: 2 }), {}, cell(String(players), { bold: true, alignment: "right" }), cell(money(gross), { bold: true, alignment: "right" }),
      cell(`– ${money(cost)}`, { bold: true, alignment: "right" }), cell(money(gross - cost), { bold: true, alignment: "right" }), cell(money(sum(rows, "collected")), { bold: true, alignment: "right" })],
  ];
  return [
    { text: [{ text: heading, font: "Wave", bold: true, fontSize: 12 }, { text: `   ${rows.length} sessions · ${players} player check-ins`, fontSize: 8.5, color: MUTED }], margin: [0, 0, 0, 6] },
    { table: { headerRows: 1, dontBreakRows: true, widths: [86, "*", 40, 56, 56, 56, 54], body }, layout: listLayout(), margin: [0, 0, 0, 16] },
  ];
};

export function shareReport(s, prepared) {
  const t = shareTotals(s);
  const content = [
    header("Session Share Report", prepared), rule(),
    ...title(s.coach, monthLabel(s.month)),
    {
      columns: [
        card("Expected share", money(t.expected), "if every bill is paid"),
        card("Collected share", money(t.collected), "from bills paid to date", true),
        card("Still to collect", money(t.expected - t.collected), `${s.sessions.length} sessions · ${t.att.length} attended, ${t.miss.length} not`),
      ],
      columnGap: 8, margin: [0, 0, 0, 16],
    },
    { columns: [summaryBlock("Sessions attended", "50%", t.a), summaryBlock("Sessions not attended", "30%", t.m)], columnGap: 14 },
  ];
  if ((s.deductions || []).length) {
    content.push(
      { text: "DEDUCTIONS", fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.6, margin: [0, 18, 0, 2] },
      { table: { widths: [82, "*", 110, 70], body: deductionRows(s.deductions) }, layout: listLayout(false) },
      rule(1.5, INK, 10, 0),
      { columns: [{ text: "Share after deductions", font: "Wave", bold: true, fontSize: 13 }, { text: money(t.total), font: "Wave", bold: true, fontSize: 13, alignment: "right" }], margin: [0, 7, 0, 0] },
      { text: `Expected once every bill is paid: ${money(t.expectedTotal)}`, fontSize: 8.5, color: MUTED, margin: [0, 2, 0, 0] },
    );
  }
  content.push({ text: "", pageBreak: "after" });
  content.push(...shareSessionTable("Sessions attended · 50%", t.att), ...shareSessionTable("Sessions not attended · 30%", t.miss));
  content.push({ text: `Figures as of ${prepared}.`, fontSize: 7.5, color: FAINT });
  return render(content);
}
