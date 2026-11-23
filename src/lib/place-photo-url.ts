import { env } from '@/lib/env';

// URL of a Google place photo through our backend's photo route (convex/http.ts), which adds
// the API key on the server. `width` is in pixels: ask for about 3x the size on screen.
export function placePhotoUrl(photoName: string, width: number): string {
  return `${env.convexSiteUrl}/place-photo?name=${encodeURIComponent(photoName)}&width=${width}`;
}
