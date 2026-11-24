import { RefObject, useEffect, useRef } from 'react';
import type HlsType from 'hls.js';

// Plays an Appwrite Videos stream (adaptive CMAF/HLS: the player picks the
// quality the connection and screen can take, and moves between them as the
// connection changes) in a <video>, and falls back to the plain Storage file
// when the video has no stream yet, the stream fails, or this browser can't
// play streams. The component must not set `src` on the <video> itself.
//
// Apple devices play public streams natively. Everything else, and private
// streams everywhere (they need a JWT header, which native playback can't
// send), go through hls.js, loaded only when a stream is about to play.
//
// `topQuality` skips the adaptive part: it plays the stream's highest quality
// on its own, from the first frame, on every device.

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID || '68577380002195dec512';

/** The adaptive master playlist of an Appwrite video. */
export const streamUrl = (videoId: string) =>
  `${ENDPOINT}/videos/${videoId}/outputs/cmaf/master.m3u8?project=${PROJECT}`;

export interface VideoSource {
  /** An Appwrite Videos id: plays as an adaptive stream once it has a ready rendition. */
  videoId?: string;
  /** The plain file: what plays when there's no stream, or it can't play here. */
  file: string;
}

interface Options {
  /** Private videos: an Appwrite JWT for every request (the session cookie doesn't reach Appwrite's domain everywhere). */
  jwt?: () => Promise<string>;
  /** Fetch nothing but the playlist until the viewer presses play (the poster stands in until then). */
  lazy?: boolean;
  /** Nothing can play: the stream failed (or there was none) and so did the file. */
  onFatal?: () => void;
  /**
   * Always the highest quality (the hero and Fundamentals: 1080p), never a
   * lower one to start with or on a slow connection. It plays that quality's
   * own playlist, which leaves out a separate audio track, so it's for
   * muted videos only.
   */
  topQuality?: boolean;
}

let hlsModule: Promise<typeof HlsType> | null = null;
// The full build: Appwrite streams carry their audio as a separate track, which the light build can't play.
const loadHls = () => (hlsModule ??= import('hls.js').then((m) => m.default));

// Safari and every iOS browser: native HLS is smoother there and needs no script.
const nativeHls = (video: HTMLVideoElement) =>
  /Apple/.test(navigator.vendor) && !!video.canPlayType('application/vnd.apple.mpegurl');

/** The playlist of the stream's highest quality, read from its master playlist. */
async function topPlaylist(videoId: string, jwt?: () => Promise<string>) {
  const master = streamUrl(videoId);
  const token = await jwt?.();
  const res = await fetch(master, token ? { headers: { 'X-Appwrite-JWT': token } } : undefined);
  if (!res.ok) throw new Error(`No stream yet (${res.status})`);
  const lines = (await res.text()).split('\n').map((l) => l.trim());
  let best = '';
  let bestHeight = -1;
  lines.forEach((line, i) => {
    const height = line.startsWith('#EXT-X-STREAM-INF') ? Number(/RESOLUTION=\d+x(\d+)/.exec(line)?.[1]) : NaN;
    if (height > bestHeight && lines[i + 1] && !lines[i + 1].startsWith('#')) {
      bestHeight = height;
      best = lines[i + 1];
    }
  });
  if (!best) throw new Error('The stream has no qualities');
  return new URL(best, master).href;
}

const hasMse = () =>
  typeof window !== 'undefined' &&
  ('ManagedMediaSource' in window || ('MediaSource' in window && typeof (window as any).MediaSource?.isTypeSupported === 'function'));

export function useAdaptiveVideo(ref: RefObject<HTMLVideoElement>, source: VideoSource, options: Options = {}) {
  const opts = useRef(options);
  opts.current = options;
  const { videoId, file } = source;
  // A new link to the same file (signed links get refreshed) doesn't restart a stream.
  const fileRef = useRef(file);
  fileRef.current = file;
  const fileKey = videoId ? '' : file;
  const lazy = !!options.lazy;
  const isPrivate = !!options.jwt;
  const top = !!options.topQuality;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let hls: HlsType | null = null;
    let onFile = false;
    const cleanups: (() => void)[] = [];
    const listen = (type: string, fn: () => void, once = false) => {
      video.addEventListener(type, fn, { once });
      cleanups.push(() => video.removeEventListener(type, fn));
    };

    const playFile = () => {
      if (cancelled) return;
      if (onFile) { opts.current.onFatal?.(); return; }
      onFile = true;
      const t = video.currentTime;
      const resume = !video.paused || video.autoplay;
      hls?.destroy();
      hls = null;
      video.src = fileRef.current;
      if (t > 0) listen('loadedmetadata', () => { video.currentTime = t; }, true);
      if (resume) video.play().catch(() => {});
    };

    // The element's own errors: on a native stream, move to the file; on the file, give up.
    listen('error', () => { if (!hls) playFile(); });

    const stream = (id: string) => (top ? topPlaylist(id, opts.current.jwt) : Promise.resolve(streamUrl(id)));

    if (!videoId) {
      playFile();
    } else if (!isPrivate && nativeHls(video)) {
      stream(videoId).then((url) => { if (!cancelled) video.src = url; }, playFile);
    } else if (!hasMse()) {
      playFile();
    } else {
      Promise.all([loadHls(), stream(videoId)]).then(([Hls, url]) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { playFile(); return; }
        const instance = new Hls({
          autoStartLoad: !lazy,
          capLevelToPlayerSize: !top,
          // A stream that isn't ready answers 404: fall back to the file at once.
          manifestLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 10000,
              maxLoadTimeMs: 20000,
              timeoutRetry: { maxNumRetry: 1, retryDelayMs: 0, maxRetryDelayMs: 0 },
              errorRetry: { maxNumRetry: 0, retryDelayMs: 0, maxRetryDelayMs: 0 },
            },
          },
          // Private streams: who's watching goes with every playlist and segment
          // request (the project travels in every link the playlists carry).
          ...(isPrivate && {
            xhrSetup: async (xhr: XMLHttpRequest, url: string) => {
              const jwt = await opts.current.jwt?.();
              if (!xhr.readyState) xhr.open('GET', url, true);
              if (jwt) xhr.setRequestHeader('X-Appwrite-JWT', jwt);
            },
          }),
        });
        hls = instance;
        let recovered = false;
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true;
            instance.recoverMediaError();
            return;
          }
          playFile();
        });
        if (lazy) {
          let started = false;
          listen('play', () => {
            if (started || hls !== instance) return;
            started = true;
            instance.startLoad(video.currentTime || -1);
          });
        }
        instance.loadSource(url);
        instance.attachMedia(video);
      }).catch(() => playFile());
    }

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      hls?.destroy();
      hls = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [ref, videoId, fileKey, lazy, isPrivate, top]);
}
