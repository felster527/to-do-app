// Address of the backend server
export const API_URL =
  typeof window !== 'undefined' ? `http://${window.location.hostname}:3000` : 'http://localhost:3000';

export function fixPictureUrl(url: string | null | undefined): string | null {
  return url ? url.replace(/^https?:\/\/[^/]+/, API_URL) : null;
}