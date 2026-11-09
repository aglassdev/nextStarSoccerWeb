// Shared image loading. Pages ask for their photos through here, and so does
// the background preload that runs once the site has opened, so a photo is
// fetched once and a page can tell straight away whether its photos are ready.

export type ImagePriority = 'high' | 'low' | 'auto';

const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** True once `src` has been downloaded (by a page or the background preload). */
export const isImageLoaded = (src: string) => loaded.has(src);

/**
 * Fetch an image into the browser cache. Resolves when it's there (and, with
 * `decode`, ready to paint), or when it fails: a broken photo never holds
 * anything up.
 */
export function preloadImage(src: string, priority: ImagePriority = 'auto', decode = false): Promise<void> {
  if (!src || loaded.has(src)) return Promise.resolve();
  const inFlight = pending.get(src);
  if (inFlight) return inFlight;

  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.setAttribute('fetchpriority', priority);
    const done = () => {
      loaded.add(src);
      pending.delete(src);
      resolve();
    };
    img.onload = () => {
      // Decoding first means the photo paints the moment the page shows. Some
      // browsers hold decode() back (a hidden tab, for one), so it gets a
      // quarter of a second at most.
      if (decode && typeof img.decode === 'function') {
        Promise.race([img.decode(), new Promise((r) => setTimeout(r, 250))]).then(done, done);
      } else done();
    };
    img.onerror = () => {
      pending.delete(src);
      resolve();
    };
    img.src = src;
  });
  pending.set(src, p);
  return p;
}

/** Fetch a list in order, a few at a time, at low priority. */
export async function preloadQueue(srcs: (string | null | undefined)[], concurrency = 3): Promise<void> {
  const queue = [...new Set(srcs.filter((s): s is string => !!s && !loaded.has(s)))];
  const worker = async () => {
    while (queue.length) await preloadImage(queue.shift()!, 'low');
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}
