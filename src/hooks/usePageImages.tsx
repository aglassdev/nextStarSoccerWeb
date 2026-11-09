import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useParams, type Params } from 'react-router-dom';
import LoadingScreen from '../components/common/LoadingScreen';
import { isImageLoaded, preloadImage } from '../utils/imagePreload';

type Src = string | null | undefined;

// A page that hasn't got its first-screen photos yet would show empty black
// tiles that fill in one by one, so it shows the loading screen (the one the
// Alumni page uses) until they're in. Photos already fetched, by an earlier
// page or the background preload, are ready at once and skip the loader.
// A slow or broken photo never holds a page longer than TIMEOUT_MS.
const TIMEOUT_MS = 6000;

/**
 * True once `first` (the photos on a page's first screen) have loaded. `more`
 * (the page's other photos) start right after, so they're in by the time
 * they're scrolled to.
 */
export function usePageImages(first: Src[], more: Src[] = []): boolean {
  const list = first.filter((s): s is string => !!s);
  const key = list.join('|');
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const moreRef = useRef(more);
  moreRef.current = more;

  useEffect(() => {
    let live = true;
    let started = false;
    const loadMore = () => {
      if (started) return;
      started = true;
      moreRef.current.forEach((s) => s && preloadImage(s));
    };
    const finish = () => {
      if (live) setDoneKey(key);
      loadMore();
    };
    if (list.every(isImageLoaded)) {
      finish();
      return () => { live = false; };
    }
    const timer = setTimeout(finish, TIMEOUT_MS);
    Promise.all(list.map((s) => preloadImage(s, 'high', true))).then(() => {
      clearTimeout(timer);
      finish();
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `key` stands for `list`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return doneKey === key || list.every(isImageLoaded);
}

/**
 * Wrap a page so it shows the loading screen until its first-screen photos
 * are in. `pick` gets the route params (for detail pages) and names them.
 * The page itself mounts only once they're ready, so its own effects run
 * against the real content.
 */
export function withPageImages<P extends object>(
  Page: ComponentType<P>,
  pick: (params: Readonly<Params<string>>) => { first: Src[]; more?: Src[] },
) {
  const Gated = (props: P) => {
    const { first, more } = pick(useParams());
    const ready = usePageImages(first, more);
    return ready ? <Page {...props} /> : <LoadingScreen />;
  };
  Gated.displayName = `withPageImages(${Page.displayName || Page.name || 'Page'})`;
  return Gated;
}
