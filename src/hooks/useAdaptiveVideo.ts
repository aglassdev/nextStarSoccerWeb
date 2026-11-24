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
  /** The tallest quality to step up to (e.g. 720 for the hero on phones). */
  maxHeight?: number;
}

let hlsModule: Promise<typeof HlsType> | null = null;
// The full build: Appwrite streams carry their audio as a separate track, which the light build can't play.
const loadHls = () => (hlsModule ??= import('hls.js').then((m) => m.default));

// Safari and every iOS browser: native HLS is smoother there and needs no script.
const nativeHls = (video: HTMLVideoElement) =>
  /Apple/.test(navigator.vendor) && !!video.canPlayType('application/vnd.apple.mpegurl');

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
  const maxHeight = options.maxHeight;

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

    if (!videoId) {
      playFile();
    } else if (!isPrivate && nativeHls(video)) {
      video.src = streamUrl(videoId);
    } else if (!hasMse()) {
      playFile();
    } else {
      loadHls().then((Hls) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { playFile(); return; }
        const instance = new Hls({
          autoStartLoad: !lazy,
          capLevelToPlayerSize: true,
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
        if (maxHeight) {
          instance.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
            const allowed = data.levels.map((l, i) => (l.height <= maxHeight ? i : -1)).filter((i) => i >= 0);
            if (allowed.length) instance.autoLevelCapping = Math.max(...allowed);
          });
        }
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
        instance.loadSource(streamUrl(videoId));
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
  }, [ref, videoId, fileKey, lazy, isPrivate, maxHeight]);
}
