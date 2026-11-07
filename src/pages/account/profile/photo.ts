import { ID } from 'appwrite';
import { storage } from '@/services/appwrite';

// Profile photos, as in the app's services/profilePhotoService.ts: the
// "profile-photos" bucket (public read, signed-in users write), the file id
// stored on the profile as profilePhotoId, and the previous file deleted after
// a successful upload.

export const PROFILE_PHOTOS_BUCKET_ID = 'profile-photos';
const MAX_BYTES = 5 * 1024 * 1024; // the bucket's limit
const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

export const profilePhotoUrl = (fileId?: string | null) =>
  fileId ? String(storage.getFileView(PROFILE_PHOTOS_BUCKET_ID, fileId)) : '';

/**
 * The app crops to a square (aspect 1:1) at 80% quality before uploading; do
 * the same with a canvas. Formats the browser can't draw (e.g. HEIC outside
 * Safari) are uploaded as they are.
 */
async function squareJpeg(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(side, 1080);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx || !side) return file;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return blob ? new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload a new profile photo and return its file id. */
export async function uploadProfilePhoto(file: File, previousFileId?: string | null): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!file.type.startsWith('image/') && !ALLOWED.includes(ext)) {
    throw new Error('Please choose a JPG, PNG, WebP or HEIC image.');
  }
  const prepared = await squareJpeg(file);
  if (prepared.size > MAX_BYTES) throw new Error('That photo is too large — please choose one under 5 MB.');

  const created = await storage.createFile(PROFILE_PHOTOS_BUCKET_ID, ID.unique(), prepared);
  if (previousFileId) {
    try {
      await storage.deleteFile(PROFILE_PHOTOS_BUCKET_ID, previousFileId);
    } catch {
      // Non-fatal: the old file may already be gone or owned differently.
    }
  }
  return created.$id;
}
