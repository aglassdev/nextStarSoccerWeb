/**
 * Extracts and structures all SquadLocker products from the scraped data.
 * Groups color variants into unified products, fetches sizes per variant.
 *
 * Usage:  node scripts/extract-squadlocker.cjs
 * Output: scripts/squadlocker-clean.json
 *         scripts/squadlocker-clean.ts   (ready to import in the React app)
 */

const fs = require('fs');
const path = require('path');

const RAW_FILE  = path.join(__dirname, 'squadlocker-products.json');
const JSON_OUT  = path.join(__dirname, 'squadlocker-clean.json');
const TS_OUT    = path.join(__dirname, 'squadlocker-clean.ts');

const BASE       = 'https://teamlocker.squadlocker.com';
const LOCKER_ID  = 306692;
const LOCKER_SLUG = 'next-star-soccer';

// ─── Load raw data ─────────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
const lockerInfo = raw.raw_api_responses['locker_info'];
const colorCatalog = raw.raw_api_responses['colors'] || [];

// Build a hex-code lookup: colorCode → hex
const hexByCode = {};
for (const c of colorCatalog) {
  hexByCode[c.code] = c.hexValue ?? null;
}

// ─── Fetch sizes for a colored style ──────────────────────────────────────
async function fetchSizes(coloredStyleId) {
  const urls = [
    `${BASE}/api/v2/colored-styles/${coloredStyleId}/sizes`,
    `${BASE}/api/v2/locker-items/${coloredStyleId}/sizes`,
    `${BASE}/api/v1/colored-styles/${coloredStyleId}/sizes`,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      // data might be an array of size objects or { sizes: [...] }
      const arr = Array.isArray(data) ? data : (data.sizes ?? data.data ?? []);
      if (arr.length > 0) {
        return arr.map(s => s.label ?? s.name ?? s.size ?? String(s));
      }
    } catch (_) {}
  }
  return [];
}

// ─── Group color variants into base products ──────────────────────────────
function groupProducts(variants) {
  const byStyleId = new Map();

  for (const v of variants) {
    if (!v.available) continue; // skip unavailable

    const key = v.styleId;
    if (!byStyleId.has(key)) {
      byStyleId.set(key, {
        styleId:     v.styleId,
        name:        v.name,
        description: v.description ?? '',
        category:    v.category?.name ?? '',
        brandName:   v.brandName ?? '',
        brandLogoUrl: v.brandImageUrl ?? '',
        sizeGroups:  v.sizeGroups ?? [],
        colors:      [],
      });
    }

    const product = byStyleId.get(key);

    // Price: stored in cents (985 = $9.85)
    const priceCents = v.priceRange?.[0] ?? v.rawPriceRange?.[0] ?? null;
    const price = priceCents != null ? (priceCents / 100).toFixed(2) : null;

    product.colors.push({
      coloredStyleId: v.coloredStyleId,
      colorGroup:     v.colorGroup ?? '',
      floodColor:     v.floodColor ?? '',
      hex:            hexByCode[v.floodColor] ?? hexByCode[v.colorGroup] ?? null,
      price:          price ? parseFloat(price) : null,
      images: {
        front: v.images?.front ?? '',
        back:  v.images?.back  ?? '',
      },
      code:  v.code ?? '',
      sizes: [], // filled in below if size fetch is enabled
    });
  }

  return [...byStyleId.values()];
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Grouping products...');
  const variants  = lockerInfo.nonessentialColoredStyles ?? [];
  const essential = lockerInfo.essentialColoredStyles    ?? [];
  const all       = [...essential, ...variants];
  console.log(`  Total variants: ${all.length}`);

  const products = groupProducts(all);
  console.log(`  Unique products (styles): ${products.length}`);

  // Sample one product to discover the sizes endpoint
  console.log('\nProbing sizes API with first product...');
  if (products.length > 0 && products[0].colors.length > 0) {
    const sample = products[0].colors[0];
    const sizes = await fetchSizes(sample.coloredStyleId);
    console.log(`  coloredStyleId=${sample.coloredStyleId} → sizes: ${JSON.stringify(sizes)}`);

    if (sizes.length > 0) {
      console.log('\nFetching sizes for all color variants (this may take a few minutes)...');
      let done = 0;
      const total = products.reduce((acc, p) => acc + p.colors.length, 0);

      for (const product of products) {
        for (const color of product.colors) {
          color.sizes = await fetchSizes(color.coloredStyleId);
          done++;
          if (done % 50 === 0) {
            process.stdout.write(`  ${done}/${total} variants sized\r`);
          }
          await new Promise(r => setTimeout(r, 50)); // be polite
        }
      }
      console.log(`\n  Done sizing ${done} variants.`);
    } else {
      console.log('  Size endpoint not found — skipping per-variant sizes.');
      console.log('  (sizeGroups field still indicates Men/Women/Youth/etc.)');
    }
  }

  // Add squadlocker URL to each product
  for (const p of products) {
    p.lockerUrl = `${BASE}/#/lockers/${LOCKER_SLUG}`;
    // SquadLocker product URLs use styleId
    p.productUrl = `${BASE}/#/lockers/${LOCKER_SLUG}/products/${p.styleId}`;
  }

  // Save JSON
  const output = {
    generated_at:  new Date().toISOString(),
    locker_id:     LOCKER_ID,
    locker_slug:   LOCKER_SLUG,
    product_count: products.length,
    products,
  };

  fs.writeFileSync(JSON_OUT, JSON.stringify(output, null, 2));
  console.log(`\n✓ JSON saved: ${JSON_OUT}`);

  // Save TypeScript module
  const ts = generateTS(products);
  fs.writeFileSync(TS_OUT, ts);
  console.log(`✓ TypeScript saved: ${TS_OUT}`);

  // Print category breakdown
  const categories = {};
  for (const p of products) {
    categories[p.category] = (categories[p.category] ?? 0) + 1;
  }
  console.log('\nProducts by category:');
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat || '(none)'}: ${count}`);
  }
}

// ─── TypeScript code generation ────────────────────────────────────────────
function generateTS(products) {
  return `// Auto-generated by scripts/extract-squadlocker.cjs
// Do not edit manually — re-run the script to regenerate.

export interface SquadLockerColor {
  coloredStyleId: number;
  colorGroup: string;
  floodColor: string;
  hex: string | null;
  price: number | null;
  images: { front: string; back: string };
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
].sort();
`;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
