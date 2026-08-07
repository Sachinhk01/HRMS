/**
 * Content Service - Deprecated client-side mock stores.
 * Celebration posts, announcements, and events are now fully managed
 * by the backend Notification APIs via notificationService.js.
 */

export const announcementStore = {
  all: () => [],
  create: () => { throw new Error('Announcements are managed via the backend Notification API.'); },
  remove: () => {},
};

export const eventStore = {
  all: () => [],
  create: () => { throw new Error('Events are managed via the backend Notification API.'); },
  remove: () => {},
};

export const postStore = {
  all: () => [],
  create: () => { throw new Error('Celebration posts are managed via the backend Notification API.'); },
  remove: () => {},
  toggleLike: () => {},
  addComment: () => {},
  togglePin: () => {},
};

export function ensureAutomaticCelebrations() {
  return [];
}