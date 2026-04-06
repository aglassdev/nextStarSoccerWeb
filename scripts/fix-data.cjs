/**
 * Fixes two issues in squadlocker-clean.json:
 * 1. Deduplicates color variants (same coloredStyleId appearing multiple times)
 * 2. Fetches cachedImage (product + logo composited) for each color variant
 *
 * Usage: node scripts/fix-data.cjs
 */

const fs = require('fs');
const path = require('path');

const RAW_FILE   = path.join(__dirname, 'squadlocker-products.json');
const CLEAN_FILE = path.join(__dirname, 'squadlocker-clean.json');
const TS_OUT     = path.join(__dirname, 'squadlocker-clean.ts');

const CONCURRENCY = 15; // parallel requests at a time

async function fetchLogos(itemId) {
  const url = `https://teamlocker.squadlocker.com/api/v2/colored-style-selections/${itemId}/logos`;
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r.ok) return null;
    const data = await r.json();
    // data is an array; first item's cachedImage is the composited product+logo image
    return data?.[0]?.cachedImage ?? null;
  } catch {
    return null;
  }
}

async function runBatch(tasks, concurrency) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  const raw   = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
  const clean = JSON.parse(fs.readFileSync(CLEAN_FILE, 'utf8'));

  // ── Step 1: Re-group from raw data, deduplicating by coloredStyleId ────────
  console.log('Step 1: Rebuilding products with deduplication...');
  const variants = [
    ...(raw.raw_api_responses['locker_info'].essentialColoredStyles    ?? []),
    ...(raw.raw_api_responses['locker_info'].nonessentialColoredStyles ?? []),
  ];

  const hexByCode = {};
  for (const c of (raw.raw_api_responses['colors'] ?? [])) {
    hexByCode[c.code] = c.hexValue ?? null;
  }

  // Group by styleId, dedup colors by coloredStyleId
  const byStyleId = new Map();
  for (const v of variants) {
    if (!v.available) continue;
    const key = v.styleId;
    if (!byStyleId.has(key)) {
      byStyleId.set(key, {
        styleId:      v.styleId,
        name:         v.name,
        description:  v.description ?? '',
        category:     v.category?.name ?? '',
        brandName:    v.brandName ?? '',
        brandLogoUrl: v.brandImageUrl ?? '',
        sizeGroups:   v.sizeGroups ?? [],
        colors:       new Map(), // coloredStyleId → color obj
      });
    }
    const product = byStyleId.get(key);
    if (product.colors.has(v.coloredStyleId)) continue; // deduplicate

    const priceCents = v.priceRange?.[0] ?? v.rawPriceRange?.[0] ?? null;
    product.colors.set(v.coloredStyleId, {
      coloredStyleId: v.coloredStyleId,
      itemId:         v.id,   // the large id used in SquadLocker URLs
      colorGroup:     v.colorGroup    ?? '',
      floodColor:     v.floodColor    ?? '',
      hex:            hexByCode[v.floodColor] ?? hexByCode[v.colorGroup] ?? null,
      price:          priceCents != null ? Math.round(priceCents) / 100 : null,
      images: {
        front: v.images?.front ?? '',
        back:  v.images?.back  ?? '',
      },
      code:       v.code ?? '',
      sizes:      [],
      cachedImage: null, // filled in step 2
    });
  }

  // Carry over sizes from previous clean data (keyed by coloredStyleId)
  const prevSizes = {};
  for (const p of clean.products) {
    for (const c of p.colors) {
      prevSizes[c.coloredStyleId] = c.sizes ?? [];
    }
  }

  // Convert Map values to arrays
  const products = [...byStyleId.values()].map(p => ({
    ...p,
    colors: [...p.colors.values()].map(c => ({
      ...c,
      sizes: prevSizes[c.coloredStyleId] ?? [],
    })),
    lockerUrl:  `https://teamlocker.squadlocker.com/#/lockers/next-star-soccer`,
    productUrl: '', // set per color below
  }));

  // Set productUrl to first color's item URL
  for (const p of products) {
    const first = p.colors[0];
    p.productUrl = first?.itemId
      ? `https://teamlocker.squadlocker.com/#/lockers/next-star-soccer/styles/${first.itemId}`
      : p.lockerUrl;
  }

  const totalColors = products.reduce((s, p) => s + p.colors.length, 0);
  console.log(`  Products: ${products.length}, Color variants: ${totalColors}`);

  // ── Step 2: Fetch cachedImage for all color variants ───────────────────────
  console.log(`\nStep 2: Fetching composited images for ${totalColors} variants...`);

  // Flatten all colors into a list for batch processing
  const allColors = products.flatMap(p => p.colors);
  let done = 0;

  const tasks = allColors.map(color => async () => {
    if (!color.itemId) return;
    color.cachedImage = await fetchLogos(color.itemId);
    done++;
    if (done % 50 === 0 || done === allColors.length) {
      const withImg = allColors.filter(c => c.cachedImage).length;
      process.stdout.write(`  ${done}/${allColors.length} fetched  (${withImg} with logo image)\r`);
    }
  });

  await runBatch(tasks, CONCURRENCY);
  console.log(`\n  Done. ${allColors.filter(c => c.cachedImage).length}/${allColors.length} variants have a composited image.`);

  // ── Save ──────────────────────────────────────────────────────────────────
  const output = {
    generated_at:  new Date().toISOString(),
    locker_id:     306692,
    locker_slug:   'next-star-soccer',
    product_count: products.length,
    products,
  };

  fs.writeFileSync(CLEAN_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ JSON saved: ${CLEAN_FILE}`);

  const ts = generateTS(products);
  fs.writeFileSync(TS_OUT, ts);
  console.log(`✓ TypeScript saved: ${TS_OUT}`);
}

function generateTS(products) {
  return `// Auto-generated by scripts/fix-data.cjs — do not edit manually.
// Source: https://teamlocker.squadlocker.com/#/lockers/next-star-soccer

export interface SquadLockerColor {
  coloredStyleId: number;
  itemId: number | null;
  colorGroup: string;
  floodColor: string;
  hex: string | null;
  price: number | null;
  images: { front: string; back: string };
  cachedImage: string | null;
  code: string;
  sizes: string[];
}

export interface SquadLockerProduct {
  styleId: number;
  name: string;
  description: string;
  category: string;
  brandName: string;
  brandLogoUrl: string;
  sizeGroups: string[];
  colors: SquadLockerColor[];
  lockerUrl: string;
  productUrl: string;
}

export const squadLockerProducts: SquadLockerProduct[] = ${JSON.stringify(products, null, 2)};

export const squadLockerCategories: string[] = [
  ...new Set(squadLockerProducts.map(p => p.category).filter(Boolean))
].sort() as string[];
`;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
