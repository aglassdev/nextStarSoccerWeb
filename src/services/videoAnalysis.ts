import { ExecutionMethod, ID, Query } from 'appwrite';
import { databases, databaseId, functions, storage } from './appwrite';
import type { ClinicPlayerRef, GuestRegistration } from './clinicRegistration';

// Online video analysis: buying (register-clinic verifies the Stripe payment),
// uploading film, and everything the coach workspace reads and writes.

export const ANALYSES_COLLECTION = 'video_analyses';
export const FILM_BUCKET = 'game-film';
const VIDEO_ANALYSIS_FUNCTION = 'video-analysis';
const REGISTER_FUNCTION = 'register-clinic';

export type AnalysisStatus = 'awaiting_upload' | 'submitted' | 'in_review' | 'completed';

export interface VideoAnalysis {
  $id: string;
  orderId: string;
  purchaserUserId: string;
  purchaserEmail: string;
  purchaserName: string;
  playerKind: 'self' | 'proxy' | 'real' | 'guest';
  playerId: string;
  playerName: string;
  preferredCoach: string;
  coachUserId: string;
  coachName: string;
  status: AnalysisStatus;
  filmFileId?: string;
  filmName?: string;
  filmSize?: number;
  filmUploadedAt?: string;
  thumbFileId?: string;
  playerNotes?: string;
  dueAt?: string;
  annotations?: string;
  recordingFileId?: string;
  summary?: string;
  completedAt?: string;
  purchasedAt?: string;
}

export interface Annotation {
  id: string;
  /** Seconds into the film. */
  t: number;
  kind: 'comment' | 'note';
  text: string;
  createdAt: string;
  author?: string;
}

export const STATUS_LABEL: Record<AnalysisStatus, string> = {
  awaiting_upload: 'Upload your film',
  submitted: 'With your coach',
  in_review: 'In review',
  completed: 'Ready',
};

async function execute<T = any>(functionId: string, payload: Record<string, any>): Promise<T> {
  const execution = await functions.createExecution(
    functionId,
    JSON.stringify(payload),
    false,
    '/',
    ExecutionMethod.POST,
    { 'Content-Type': 'application/json' },
  );
  let body: any = {};
  try {
    body = JSON.parse(execution.responseBody || '{}');
  } catch {
    // fall through to the status check
  }
  if (execution.responseStatusCode !== 200 || !body.success) {
    throw new Error(body.error || `Request failed (${execution.responseStatusCode})`);
  }
  return body;
}

/** Turn a paid PaymentIntent into analyses (signed in: players per item; guest: guest details). */
export const registerVideoAnalysis = (payload: {
  paymentIntentId: string;
  items: { player?: ClinicPlayerRef; coach: string }[];
  guest?: GuestRegistration;
}) => execute<{ players?: string[]; emailed?: boolean }>(REGISTER_FUNCTION, { product: 'video-analysis', ...payload });

const action = <T = any>(name: string, payload: Record<string, any> = {}) =>
  execute<T>(VIDEO_ANALYSIS_FUNCTION, { action: name, ...payload });

/** Analyses bought as a guest with this account's email become theirs. */
export const claimGuestAnalyses = () => action<{ claimed: number }>('claim');

export const attachFilm = (payload: {
  analysisId: string;
  fileId: string;
  thumbFileId?: string;
  notes?: string;
  player?: ClinicPlayerRef;
}) => action<{ analysis: VideoAnalysis }>('attachFilm', payload);

export const completeAnalysis = (analysisId: string, recordingFileId?: string) =>
  action<{ analysis: VideoAnalysis; emailed: boolean }>('complete', { analysisId, recordingFileId });

export const ensureCoachRole = () => action<{ isCoach: boolean; isAdmin: boolean }>('ensureRole');

export type AnalysisUrls = Record<string, { thumb?: string; film?: string; recording?: string }>;

/** Signed links (they work in <video>/<img> without a session). `full: false` = thumbnails only. */
export const getAnalysisUrls = async (analysisIds: string[], full = true): Promise<AnalysisUrls> => {
  if (analysisIds.length === 0) return {};
  return (await action<{ urls: AnalysisUrls }>('urls', { analysisIds, full })).urls;
};

export async function listMyAnalyses(userId: string): Promise<VideoAnalysis[]> {
  const r = await databases.listDocuments(databaseId, ANALYSES_COLLECTION, [
    Query.equal('purchaserUserId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return r.documents as any;
}

/** Coaches see what's assigned to them; admins (coachUserId omitted) see everything. */
export async function listAnalysesForStaff(coachUserId?: string): Promise<VideoAnalysis[]> {
  const r = await databases.listDocuments(databaseId, ANALYSES_COLLECTION, [
    ...(coachUserId ? [Query.equal('coachUserId', coachUserId)] : []),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return r.documents as any;
}

export const getAnalysis = async (id: string) =>
  (await databases.getDocument(databaseId, ANALYSES_COLLECTION, id)) as unknown as VideoAnalysis;

export const updateAnalysis = async (id: string, data: Partial<Omit<VideoAnalysis, '$id'>>) =>
  (await databases.updateDocument(databaseId, ANALYSES_COLLECTION, id, data)) as unknown as VideoAnalysis;

/** Upload into the film bucket (chunked automatically for large files). */
export const uploadToFilmBucket = (
  file: File,
  onProgress?: (fraction: number) => void,
  permissions?: string[],
) =>
  storage.createFile(FILM_BUCKET, ID.unique(), file, permissions, (p) =>
    onProgress?.(Math.min(1, p.progress / 100)),
  );

/** A JPEG of the film's opening frame, made in the browser; null if it can't be decoded here. */
export function captureThumbnail(file: File, atSeconds = 1): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const finish = (out: File | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(out);
    };
    const timer = window.setTimeout(() => finish(null), 15000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    video.onerror = () => { clearTimeout(timer); finish(null); };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, (video.duration || 0) / 2));
    };
    video.onseeked = () => {
      const w = 640;
      const h = Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * w) || 360;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          clearTimeout(timer);
          finish(blob ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null);
        },
        'image/jpeg',
        0.85,
      );
    };
  });
}

export function parseAnnotations(raw?: string): Annotation[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((a) => typeof a?.t === 'number').sort((a, b) => a.t - b.t) : [];
  } catch {
    return [];
  }
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatTimestamp(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export const formatDueDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '';

export const formatBytes = (n?: number) =>
  !n ? '' : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`;
