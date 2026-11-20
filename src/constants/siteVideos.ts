// The site's videos, streamed from Appwrite Storage (bucket "videos").
//
// They used to ship inside the site, but every deploy then carried ~570 MB of
// video, and Appwrite Sites can't serve part of a file (no Range requests),
// which Safari needs to play video at all. Storage does serve ranges.
//
// These are the web-ready copies (playback index at the front, so a reel
// starts as soon as its first part arrives), not the originals that sit in
// the same bucket. To replace a video, upload it under a new file ID and
// change the ID here, so browsers don't keep the old copy.

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID || '68577380002195dec512';
const BUCKET = '69f691c700097947a134';

export const siteVideo = (fileId: string) =>
  `${ENDPOINT}/storage/buckets/${BUCKET}/files/${fileId}/view?project=${PROJECT}`;

export const HERO_VIDEO = siteVideo('site-hero-1080');
export const HERO_VIDEO_MOBILE = siteVideo('site-hero-720');
export const FUNDAMENTALS_VIDEO = siteVideo('site-fundamentals');

/** A coach's numbered highlight reel, e.g. coachVideo('paul-torres', 1). */
export const coachVideo = (slug: string, n: number) => siteVideo(`coach-${slug}-${n}`);
