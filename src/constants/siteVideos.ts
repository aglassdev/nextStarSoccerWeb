import type { VideoSource } from '../hooks/useAdaptiveVideo';

// The site's videos, streamed from Appwrite (bucket "videos").
//
// Each file in the bucket has an Appwrite Videos copy: an adaptive stream
// (360p up to the source's size, H.264) that starts fast at a low quality
// and moves up or down with the viewer's connection and screen. The file
// itself stays the fallback, for browsers that can't play the stream or a
// video whose stream isn't encoded yet. See hooks/useAdaptiveVideo.
//
// These files are the web-ready copies (playback index at the front), not the
// originals that sit in the same bucket. To replace a video, upload it under
// a new file ID, create a video from it (Appwrite Console → Videos, or
// POST /v1/videos with its bucketId and fileId) with read("any"), encode it
// as CMAF with the profiles up to its own size (16:9: 360p/480p/720p/1080p;
// 4:3 sources such as Marco's first reel: "360p 4:3"/"480p 4:3"), and put
// both IDs here.

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID || '68577380002195dec512';
const BUCKET = '69f691c700097947a134';

/** Storage file ID → Appwrite Videos ID. */
const STREAMS: Record<string, string> = {
  'site-hero-1080': '6b04e7457226da940de7',
  'site-fundamentals': '6b04e747bf1a8bb8f47c',
  'coach-paul-torres-1': '6b04e74a9b30d3dff7f7',
  'coach-paul-torres-2': '6b04e74c6a471fd2e031',
  'coach-patrick-mullins-1': '6b04e64e2ed8acdbd91b',
  'coach-patrick-mullins-2': '6b04e74e648b16e8b467',
  'coach-chris-pontius-1': '6b04e7505a453c3a8c4c',
  'coach-chris-pontius-2': '6b04e7525cdc39d1f8ad',
  'coach-marco-etcheverry-1': '6b04e7566c9f41d38ed7',
  'coach-marco-etcheverry-2': '6b04e7543f590a2f3144',
};

const fileUrl = (fileId: string) =>
  `${ENDPOINT}/storage/buckets/${BUCKET}/files/${fileId}/view?project=${PROJECT}`;

export const siteVideo = (fileId: string): VideoSource => ({ videoId: STREAMS[fileId], file: fileUrl(fileId) });

/** The hero, which plays at 1080p on every screen (see topQuality in hooks/useAdaptiveVideo). */
export const HERO_VIDEO = siteVideo('site-hero-1080');
export const FUNDAMENTALS_VIDEO = siteVideo('site-fundamentals');

/** A coach's numbered highlight reel, e.g. coachVideo('paul-torres', 1). */
export const coachVideo = (slug: string, n: number) => siteVideo(`coach-${slug}-${n}`);
