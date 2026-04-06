import { useState } from 'react';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { squadLockerProducts, type SquadLockerProduct, type SquadLockerColor } from '../constants/squadlocker-clean';

const LOCKER_URL = 'https://teamlocker.squadlocker.com/#/lockers/next-star-soccer';
const MAX_SWATCHES = 6;

const EXCLUDED_CATEGORIES = new Set([
  'Infant & Toddler',
  'Home Goods',
  'Clearance',
  'Footwear',
]);

const EXCLUDED_PRODUCTS = new Set([
  'Boxercraft Ladies Harley Flannel Pant',
  'Boxercraft Men\'s Harley Flannel Pant',
  'Port & Company Core Fleece Sweatshirt Blanket',
  'Designer Throw Pillow - 16" x 16"',
  'Mink Touch Fleece Blanket - 50" x 60"',
  'Pacific Headwear Trucker Flexfit',
  'Pacific Headwear TRUCKER FLEXFIT® CAP',
  'Pacific Headwear M2 Performance Flexfit Hat',
  'Pacific Headwear M2 Performance Hook-and-Loop, Youth',
  'ISlide Mantra Core Slides',
  'ISlide Motive Slides',
  'Port Authority Stadium Seat',
  'Port Authority Essential Tote',
  'Pacific Headwear Trucker Snapback',
  'Port Authority Value Beach Towel',
  'Port Authority® Grommeted Microfiber Golf Towel',
  'Chug 16oz. Pint Glass',
  'Gossip 15oz. Stemless Wine Glass',
  'ISlide Custom Athletic Socks',
  'Sipper 16oz. Glass Tumbler with Straw',
  'High Five Athletic Sock',
  'Adidas Copa Zone Cushion IV OTC Sock',
  'Rabbit Skins™ Infant Contrast Trim Terry Bib',
]);

const CATALOG = squadLockerProducts.filter(
  p => !EXCLUDED_CATEGORIES.has(p.category) && !EXCLUDED_PRODUCTS.has(p.name)
);

const CATALOG_CATEGORIES = [...new Set(CATALOG.map(p => p.category).filter(Boolean))].sort();

// ── Helpers ──────────────────────────────────────────────────────────────────

function startingPrice(colors: SquadLockerColor[]): number | null {
  const prices = colors.map(c => c.price).filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices) : null;
}

function productUrl(color: SquadLockerColor): string {
  return color.itemId
    ? `https://teamlocker.squadlocker.com/#/lockers/next-star-soccer/styles/${color.itemId}`
    : LOCKER_URL;
}

// Per-category logo overlay placement.
// Coordinates are % of the image element (which has p-3 padding / white bg).
// width: logo width as % of image. left/top: anchor point. transform always centers on that point.
const LOGO_PLACEMENT: Record<string, { width: string; left: string; top: string }> = {
  'Performance Tees':  { width: '30%', left: '50%', top: '40%' },
  'Casual Tees':       { width: '30%', left: '50%', top: '40%' },
  'Hoodies':           { width: '28%', left: '50%', top: '43%' },
  'Pullovers':         { width: '28%', left: '50%', top: '41%' },
  'Warm-ups':          { width: '18%', left: '37%', top: '36%' },
  'Outerwear':         { width: '17%', left: '37%', top: '36%' },
  'Polos':             { width: '16%', left: '37%', top: '35%' },
  'Pants':             { width: '16%', left: '38%', top: '57%' },
  'Shorts':            { width: '15%', left: '38%', top: '52%' },
  'Compression':       { width: '15%', left: '38%', top: '54%' },
  'Bags':              { width: '30%', left: '50%', top: '50%' },
  'Headwear':          { width: '28%', left: '50%', top: '50%' },
  'Accessories':       { width: '26%', left: '50%', top: '48%' },
};
const DEFAULT_LOGO_PLACEMENT = { width: '28%', left: '50%', top: '40%' };

// ── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: SquadLockerProduct }) {
  // Default to the first color that has a pre-composited logo so it shows immediately
  const [colorIdx, setColorIdx] = useState(() => {
    const i = product.colors.findIndex(c => c.cachedImage);
    return i >= 0 ? i : 0;
  });
  const [hovered, setHovered] = useState(false);

  const color = product.colors[colorIdx] ?? product.colors[0];
  const price = color.price ?? startingPrice(product.colors);
  const hasCachedLogo = !!color.cachedImage;
  const primaryImg = color.cachedImage || color.images.front;
  const backImg = color.images.back;
  const validBack = backImg && !backImg.endsWith('/.png') && !backImg.endsWith('//.png') && backImg !== color.images.front;
  const showingBack = hovered && !!validBack;
  const displayImg = showingBack ? backImg : primaryImg;
  const showLogoOverlay = !hasCachedLogo && !showingBack && !!primaryImg;
  const logoPlacement = LOGO_PLACEMENT[product.category] ?? DEFAULT_LOGO_PLACEMENT;

  const visibleSwatches = product.colors.slice(0, MAX_SWATCHES);
  const extraColors = product.colors.length - MAX_SWATCHES;

  const allSizes = [...new Set(product.colors.flatMap(c => c.sizes))];

  return (
    <div className="flex flex-col bg-gray-900 rounded-2xl overflow-hidden border border-white/5 hover:border-white/15 transition-all duration-300 group">

      {/* Image */}
      <a
        href={productUrl(color)}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative bg-white aspect-square overflow-hidden"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {primaryImg ? (
          <img
            src={displayImg || primaryImg}
            alt={product.name}
            className="w-full h-full object-contain p-3 transition-opacity duration-200"
            loading="lazy"
            decoding="async"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <span className="text-gray-500 text-sm">No image</span>
          </div>
        )}

        {/* NSS logo overlay — used when SquadLocker hasn't pre-composited this color */}
        {showLogoOverlay && (
          <img
            src="/assets/images/NextStarLogo.png"
            aria-hidden="true"
            className="absolute pointer-events-none object-contain"
            style={{ width: logoPlacement.width, left: logoPlacement.left, top: logoPlacement.top, transform: 'translate(-50%, -50%)' }}
          />
        )}

        {/* Brand logo */}
        {product.brandLogoUrl && (
          <img
            src={product.brandLogoUrl}
            alt={product.brandName}
            className="absolute bottom-2 right-2 h-5 object-contain opacity-60"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </a>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3 flex-1">

        {/* Name + price row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-white text-sm font-medium leading-snug line-clamp-2 flex-1">
            {product.name}
          </p>
          {price !== null && (
            <span className="text-green-400 text-sm font-semibold whitespace-nowrap">
              ${price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Color swatches */}
        {product.colors.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            {visibleSwatches.map((c, i) => (
              <button
                key={c.coloredStyleId}
                title={c.colorGroup}
                onClick={() => setColorIdx(i)}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 flex-shrink-0 ${
                  i === colorIdx
                    ? 'border-white scale-110'
                    : 'border-transparent hover:border-white/60'
                }`}
                style={{
                  backgroundColor: c.hex ?? '#888',
                  outline: i === colorIdx ? '1px solid rgba(255,255,255,0.3)' : 'none',
                  outlineOffset: '1px',
                }}
              />
            ))}
            {extraColors > 0 && (
              <span className="text-gray-500 text-xs ml-0.5">+{extraColors}</span>
            )}
          </div>
        )}

        {/* Sizes */}
        {allSizes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {allSizes.slice(0, 8).map(s => (
              <span
                key={s}
                className="text-gray-400 text-[10px] border border-gray-700 rounded px-1 py-0.5 leading-none"
              >
                {s}
              </span>
            ))}
            {allSizes.length > 8 && (
              <span className="text-gray-500 text-[10px]">+{allSizes.length - 8}</span>
            )}
          </div>
        )}

        {/* CTA */}
        <a
          href={productUrl(color)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto pt-2 text-center text-xs font-semibold text-white bg-blue-800 hover:bg-blue-700 rounded-lg py-2 transition-colors duration-150"
        >
          Shop on SquadLocker
        </a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', ...CATALOG_CATEGORIES];

export default function StorePage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? CATALOG
    : CATALOG.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />

      <div className="pt-24 px-4 pb-16 flex-1">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white font-lt-wave mb-2">Store</h1>
            <p className="text-gray-500 text-xs">
              Some items may display faulty logos, but do show properly on SquadLocker and in checkout.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-8 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border ${
                  activeCategory === cat
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white'
                }`}
              >
                {cat}
                {cat !== 'All' && (
                  <span className="ml-1.5 text-xs opacity-60">
                    {CATALOG.filter(p => p.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(product => (
              <ProductCard key={product.styleId} product={product} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-24">No items in this category.</p>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
}
