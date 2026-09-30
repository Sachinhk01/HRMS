/**
 * Shared validation + friendly error messages for the three "post" composers:
 * Announcements, Events and the Celebration Wall.
 *
 * Limits mirror the backend:
 *  - AnnouncementRequest: title <= 100, message <= 1000
 *  - B2FileStorageServiceImpl: png / jpg / jpeg / pdf only, 25 MB per file
 */

export const POST_TITLE_MAX = 100;
export const POST_MESSAGE_MAX = 1000;
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_MB = 25;
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png';

const PHOTO_EXT_RE = /\.(jpe?g|png)$/i;

/**
 * Turns any error thrown by the API layer into a short, human-friendly message.
 * Server internals (stack-trace style text, storage errors, 5xx bodies) are never shown.
 */
export function getFriendlyError(err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.status;
  const raw = String(err?.message || '').trim();

  if (/network error|failed to fetch/i.test(raw)) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }
  if (/timeout/i.test(raw)) {
    return 'The request took too long. Please try again — if you are uploading photos, try fewer or smaller ones.';
  }
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 413 || /maximum upload size|payload too large/i.test(raw)) {
    return `The selected photos are too large. Each photo must be ${MAX_PHOTO_MB} MB or smaller.`;
  }
  if (status === 415 || /unsupported (file type|media)/i.test(raw)) {
    return 'Only JPG and PNG photos can be uploaded.';
  }
  if (/file size exceeds/i.test(raw)) {
    return `Each photo must be ${MAX_PHOTO_MB} MB or smaller.`;
  }
  if (/file must not be empty/i.test(raw)) {
    return 'One of the selected photos is empty. Please choose a different file.';
  }
  // Hide server internals.
  if (status >= 500 || /backblaze|unexpected error occurred/i.test(raw)) return fallback;

  return raw || fallback;
}

/**
 * Validates the text fields. Returns an error string, or '' when everything is fine.
 * `messageLimit` lets Events / Celebrations pass a smaller limit, because their date,
 * type and tagged people are stored inside the same 1000-character message.
 */
export function validatePostText({ title, message, messageLimit = POST_MESSAGE_MAX }) {
  const cleanTitle = (title || '').trim();
  const cleanMessage = (message || '').trim();

  if (!cleanTitle) return 'Title is required.';
  if (cleanTitle.length > POST_TITLE_MAX) return `Title cannot exceed ${POST_TITLE_MAX} characters.`;
  if (!cleanMessage) return 'Message is required.';
  if (messageLimit < 1) return 'Too many people are tagged. Please remove a few tags and try again.';
  if (cleanMessage.length > messageLimit) {
    return messageLimit < POST_MESSAGE_MAX
      ? `Message cannot exceed ${messageLimit} characters (the date, type and tagged people use part of the ${POST_MESSAGE_MAX}-character limit).`
      : `Message cannot exceed ${messageLimit} characters.`;
  }
  return '';
}

/**
 * Filters a photo selection down to the files the server will accept.
 * Returns { files, error } — `error` is a message to show (or '') describing what was skipped.
 */
export function filterPhotos(selected = []) {
  const problems = [];
  const files = [];

  selected.forEach((file) => {
    if (!PHOTO_EXT_RE.test(file.name || '')) {
      problems.push(`"${file.name}" was skipped — only JPG and PNG photos are allowed.`);
    } else if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      problems.push(`"${file.name}" was skipped — each photo must be ${MAX_PHOTO_MB} MB or smaller.`);
    } else if (file.size === 0) {
      problems.push(`"${file.name}" was skipped — the file is empty.`);
    } else {
      files.push(file);
    }
  });

  if (files.length > MAX_PHOTOS) {
    problems.push(`You can upload up to ${MAX_PHOTOS} photos at a time. Only the first ${MAX_PHOTOS} were kept.`);
    files.length = MAX_PHOTOS;
  }

  return { files, error: problems[0] || '' };
}