import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { fetchGoogle, PLACES_API } from './googlePlaces';

// Plain HTTP endpoints, served at https://<deployment>.convex.site/<path>
const http = httpRouter();

// Only Google photo names ("places/<id>/photos/<id>"), so the route can't fetch anything else
const PHOTO_NAME = /^places\/[\w-]+\/photos\/[\w-]+$/;

// GET /place-photo?name=places/…/photos/…&width=400
// The app's <Image> needs a URL, and a Google photo URL needs our API key. This route adds the
// key here on the server, asks Google where the image is, and redirects the app there, so the
// key never reaches the phone.
http.route({
  path: '/place-photo',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    const params = new URL(request.url).searchParams;
    const name = params.get('name') ?? '';
    const width = Math.min(Math.max(Number(params.get('width')) || 400, 50), 1600);
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || !PHOTO_NAME.test(name)) return new Response('Not found', { status: 404 });

    let response: Response;
    try {
      response = await fetchGoogle(
        `${PLACES_API}/${name}/media?maxWidthPx=${width}&skipHttpRedirect=true&key=${key}`,
      );
    } catch {
      // Google didn't answer in time; the app shows the place's icon instead
      return new Response('Photo service timed out', { status: 504 });
    }
    if (!response.ok) return new Response('Photo unavailable', { status: 404 });
    const { photoUri } = (await response.json()) as { photoUri: string };

    return new Response(null, {
      status: 302,
      headers: { Location: photoUri, 'Cache-Control': 'public, max-age=3600' },
    });
  }),
});

export default http;
