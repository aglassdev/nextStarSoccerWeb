/**
 * SquadLocker scraper — intercepts API calls and directly fetches known endpoints.
 * Discovered endpoints from initial run:
 *   /api/v2/lockers/next-star-soccer  (locker metadata, id=306692)
 *   /api/v2/colors                     (all color data)
 *
 * Usage:  node scripts/scrape-squadlocker.cjs
 * Output: scripts/squadlocker-products.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://teamlocker.squadlocker.com';
const LOCKER_SLUG = 'next-star-soccer';
const LOCKER_ID = 306692;
const OUTPUT_FILE = path.join(__dirname, 'squadlocker-products.json');

const apiResponses = {};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Direct API fetch (no browser needed for JSON endpoints) ──────────────────
async function fetchAPI(url) {
  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function tryFetch(url, label) {
  try {
    console.log(`  Fetching ${label}...`);
    const data = await fetchAPI(url);
    apiResponses[label] = data;
    console.log(`    ✓ Got ${JSON.stringify(data).slice(0, 80)}...`);
    return data;
  } catch (e) {
    console.log(`    ✗ Failed: ${e.message}`);
    return null;
  }
}

// ── Browser phase: intercept any remaining API calls ─────────────────────────
async function browserScrape() {
  console.log('\nLaunching browser to intercept additional API calls...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('squadlocker') && !url.includes('teamlocker')) return;
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('application/json')) return;

    try {
      const json = await response.json();
      const key = url.replace(/https?:\/\/[^/]+/, '');
      if (!apiResponses[key]) {
        console.log(`  [browser API] ${key}`);
        apiResponses[key] = json;
      }
    } catch (_) {}
  });

  // Navigate with a more lenient wait condition
  try {
    await page.goto(`${BASE}/#/lockers/${LOCKER_SLUG}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await sleep(5000); // wait for SPA to finish loading

    // Scroll to trigger lazy loads
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await sleep(400);
    }
    await sleep(3000);

    // Click product cards to trigger product detail API calls
    const cardSelectors = [
      '[class*="product"]',
      '[class*="item"]',
      '[class*="locker"]',
      'a[href*="product"]',
      'a[href*="item"]',
    ];

    for (const sel of cardSelectors) {
      const els = await page.$$(sel);
      if (els.length > 2) {
        console.log(`  Clicking ${els.length} elements matching "${sel}"...`);
        for (let i = 0; i < Math.min(els.length, 30); i++) {
          try {
            const href = await els[i].getAttribute('href');
            // Only click things that look like product links/cards
            if (href && (href.includes('product') || href.includes('item'))) {
              await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
              await sleep(2000);
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
              await sleep(1000);
            }
          } catch (_) {}
        }
        break;
      }
    }
  } catch (e) {
    console.log(`  Browser navigation error: ${e.message}`);
  }

  await browser.close();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== SquadLocker Scraper ===\n');

  // Phase 1: Direct API calls with known/guessed endpoints
  console.log('Phase 1: Direct API requests...');

  await tryFetch(`${BASE}/api/v2/lockers/${LOCKER_SLUG}`, 'locker_info');
  await tryFetch(`${BASE}/api/v2/colors`, 'colors');

  // Product listing endpoints (try several patterns)
  const productEndpoints = [
    `/api/v2/lockers/${LOCKER_ID}/locker-products`,
    `/api/v2/lockers/${LOCKER_ID}/products`,
    `/api/v2/lockers/${LOCKER_SLUG}/locker-products`,
    `/api/v2/lockers/${LOCKER_SLUG}/products`,
    `/api/v1/lockers/${LOCKER_SLUG}/locker-products`,
    `/api/v1/lockers/${LOCKER_ID}/locker-products`,
    `/api/v1/lockers/${LOCKER_SLUG}/products`,
    `/api/v2/locker-products?locker_id=${LOCKER_ID}`,
    `/api/v2/products?locker_id=${LOCKER_ID}`,
    `/api/v1/products?locker_id=${LOCKER_ID}`,
  ];

  for (const ep of productEndpoints) {
    await tryFetch(`${BASE}${ep}`, ep);
  }

  // Phase 2: Browser to catch anything we missed
  await browserScrape();

  // Phase 3: Parse and structure data
  console.log('\nPhase 3: Structuring product data...');
  const products = buildProductData(apiResponses);
  const colors = apiResponses['colors'] || apiResponses['/api/v2/colors'] || [];

  const output = {
    scraped_at: new Date().toISOString(),
    locker_url: `${BASE}/#/lockers/${LOCKER_SLUG}`,
    locker_id: LOCKER_ID,
    colors_catalog: colors,
    products,
    raw_api_responses: apiResponses,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\n✓ Done!`);
  console.log(`  Products found: ${products.length}`);
  console.log(`  API endpoints captured: ${Object.keys(apiResponses).length}`);
  console.log(`  Output: ${OUTPUT_FILE}`);

  if (products.length === 0) {
    console.log('\n⚠ No products were parsed. Check raw_api_responses in the output file.');
    console.log('  Captured endpoints:');
    for (const key of Object.keys(apiResponses)) {
      console.log(`    ${key}`);
    }
  }
}

// ── Parsers ───────────────────────────────────────────────────────────────────
function buildProductData(responses) {
  const products = [];

  for (const [route, data] of Object.entries(responses)) {
    const items = findItemsArray(data);
    if (!items || items.length === 0) continue;
    console.log(`  Parsing ${items.length} items from "${route}"...`);

    for (const item of items) {
      const product = extractProduct(item);
      if (product) products.push(product);
    }
  }

  // Deduplicate by id
  const seen = new Set();
  return products.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function findItemsArray(data) {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') return data;
  const keys = [
    'locker_products', 'lockerProducts', 'items', 'products', 'data',
    'results', 'lockerItems', 'locker_items',
  ];
  for (const k of keys) {
    if (Array.isArray(data?.[k]) && data[k].length > 0) return data[k];
  }
  return null;
}

function extractProduct(item) {
  if (!item || typeof item !== 'object') return null;

  const id = item.id ?? item.productId ?? item.itemId ?? item.locker_product_id ?? item.sku;
  const name = item.name ?? item.product_name ?? item.title ?? item.display_name ?? item.productName;
  if (!name) return null;

  const price = normalizePrice(
    item.price ?? item.retail_price ?? item.base_price ?? item.starting_price ??
    item.retailPrice ?? item.basePrice ?? item.startingPrice
  );

  // Images: SquadLocker often nests images inside color/style objects
  const images = extractImages(item);

  // Colors
  const colors = extractColors(item);

  // Sizes
  const sizes = extractSizes(item);

  // Category
  const category =
    item.category ?? item.category_name ?? item.type ?? item.product_type ??
    item.categoryName ?? item.productType ?? '';

  // SquadLocker locker product URL slug
  const slug =
    item.slug ?? item.url_slug ?? item.urlSlug ?? item.url ?? '';

  return {
    id: String(id ?? name),
    name,
    price,
    description: item.description ?? item.short_description ?? item.shortDescription ?? '',
    category,
    slug,
    images,
    colors,
    sizes,
    squadlocker_url: slug
      ? `${BASE}/#/lockers/${LOCKER_SLUG}/products/${slug}`
      : `${BASE}/#/lockers/${LOCKER_SLUG}`,
  };
}

function normalizePrice(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

function extractImages(item) {
  const imgs = [];
  const push = (v) => {
    if (typeof v === 'string' && v.startsWith('http')) imgs.push(v);
  };

  push(item.image_url ?? item.imageUrl ?? item.image ?? item.thumbnail);

  const nested = [
    item.images, item.imageUrls, item.product_images, item.productImages,
    item.styles, item.colors, item.variants, item.color_variants, item.colorVariants,
  ];

  for (const src of nested) {
    if (!src) continue;
    if (typeof src === 'string') { push(src); continue; }
    if (Array.isArray(src)) {
      for (const x of src) {
        if (typeof x === 'string') { push(x); continue; }
        push(x?.url ?? x?.image_url ?? x?.imageUrl ?? x?.image);
        // dig one level deeper for per-color images
        const innerImgs = x?.images ?? x?.image_urls ?? x?.imageUrls ?? [];
        if (Array.isArray(innerImgs)) innerImgs.forEach(i => push(i?.url ?? i));
      }
    }
  }

  return [...new Set(imgs.filter(Boolean))];
}

function extractColors(item) {
  const src =
    item.colors ?? item.color_options ?? item.colorOptions ??
    item.variants ?? item.color_variants ?? item.colorVariants ??
    item.styles ?? [];

  if (!Array.isArray(src)) return [];

  return src.map(c => {
    if (typeof c === 'string') return { name: c };
    return {
      name: c.name ?? c.color_name ?? c.colorName ?? c.label ?? c.color ?? '',
      hex: c.hex ?? c.hex_code ?? c.hexCode ?? c.color_code ?? null,
      image_url: c.image_url ?? c.imageUrl ?? c.image ?? c.url ?? null,
      swatch_url: c.swatch_url ?? c.swatchUrl ?? c.swatch ?? null,
      sizes: extractSizes(c), // some APIs nest sizes per color
    };
  }).filter(c => c.name);
}

function extractSizes(item) {
  const src =
    item.sizes ?? item.size_options ?? item.sizeOptions ??
    item.available_sizes ?? item.availableSizes ?? [];

  if (!Array.isArray(src)) return [];
  return src.map(s =>
    typeof s === 'string' ? s : (s?.label ?? s?.name ?? s?.size ?? String(s))
  );
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
