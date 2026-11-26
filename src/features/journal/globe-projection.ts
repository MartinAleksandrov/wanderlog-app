import type { MultiPolygon, Polygon, Position } from 'geojson';

// Draws the spinning globe's shapes as SVG paths, fast enough to redraw many times a second.
//
// The globe is an orthographic projection: the earth as seen from far away, so only the half
// facing the viewer shows. d3-geo can draw it, but it works out every point with trigonometry
// (sine, cosine, arctangent) on every frame, which took 50-70 ms per frame on the phone. Here each
// point is turned into a 3D direction (a unit vector) once, and a frame only rotates it: about ten
// multiplications per point. Countries entirely round the back are skipped in one check.
//
// The rotation matches d3-geo's `rotate([lambda, phi])`: the point at longitude -lambda,
// latitude -phi faces the viewer.

// A ring of points: x, y, z of each one after the other (the ring's closing point, a copy of
// its first, is left out)
type Ring = Float64Array;

type Shape = {
  rings: Ring[];
  // A direction near the middle of the shape, and the largest angle from it to any of its points:
  // the shape lies within this cap of the sphere, so it can be skipped when the cap is round
  // the back
  center: [number, number, number];
  spread: number;
};

export type GlobeView = {
  // d3-geo's rotation, in degrees
  lambda: number;
  phi: number;
  // The globe's middle and radius on screen (dp)
  cx: number;
  cy: number;
  radius: number;
};

const RADIANS = Math.PI / 180;

function toVector([longitude = 0, latitude = 0]: Position): [number, number, number] {
  const lon = longitude * RADIANS;
  const lat = latitude * RADIANS;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

function toRing(points: Position[]): Ring {
  const first = points[0];
  const last = points.at(-1);
  const closed = first && last && first[0] === last[0] && first[1] === last[1];
  const count = closed ? points.length - 1 : points.length;
  const ring = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) ring.set(toVector(points[i] ?? []), i * 3);
  return ring;
}

// The country outlines, ready to draw: one shape per polygon (a country on several islands has
// several). Done once, when the globe first shows.
export function toShapes(geometries: (Polygon | MultiPolygon)[]): Shape[] {
  const polygons = geometries.flatMap((geometry) =>
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
  );
  return polygons.map((polygon) => {
    const rings = polygon.map(toRing);
    let x = 0;
    let y = 0;
    let z = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 3) {
        x += ring[i]!;
        y += ring[i + 1]!;
        z += ring[i + 2]!;
      }
    }
    const length = Math.hypot(x, y, z) || 1;
    const center: [number, number, number] = [x / length, y / length, z / length];
    let spread = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 3) {
        const dot = center[0] * ring[i]! + center[1] * ring[i + 1]! + center[2] * ring[i + 2]!;
        spread = Math.max(spread, Math.acos(Math.min(1, Math.max(-1, dot))));
      }
    }
    return { rings, center, spread };
  });
}

// Lines (the grid of meridians and parallels), as rings that aren't closed
export function toLines(lines: Position[][]): Ring[] {
  return lines.map((line) => {
    const ring = new Float64Array(line.length * 3);
    line.forEach((point, i) => ring.set(toVector(point), i * 3));
    return ring;
  });
}

// Rotates points for one frame and turns them into screen positions
class Projector {
  private readonly cosLambda: number;
  private readonly sinLambda: number;
  private readonly cosPhi: number;
  private readonly sinPhi: number;

  // The last ring's points after rotating: depth (> 0 faces the viewer), right, up
  depth = new Float64Array(0);
  right = new Float64Array(0);
  up = new Float64Array(0);

  readonly view: GlobeView;

  constructor(view: GlobeView) {
    this.view = view;
    this.cosLambda = Math.cos(view.lambda * RADIANS);
    this.sinLambda = Math.sin(view.lambda * RADIANS);
    this.cosPhi = Math.cos(view.phi * RADIANS);
    this.sinPhi = Math.sin(view.phi * RADIANS);
  }

  // How much a direction faces the viewer: 1 straight at them, 0 on the rim, < 0 round the back
  facing(a: number, b: number, c: number): number {
    const x = a * this.cosLambda - b * this.sinLambda;
    return x * this.cosPhi - c * this.sinPhi;
  }

  rotateRing(ring: Ring): number {
    const count = ring.length / 3;
    if (this.depth.length < count) {
      this.depth = new Float64Array(count * 2);
      this.right = new Float64Array(count * 2);
      this.up = new Float64Array(count * 2);
    }
    for (let i = 0; i < count; i++) {
      const a = ring[i * 3]!;
      const b = ring[i * 3 + 1]!;
      const c = ring[i * 3 + 2]!;
      const x = a * this.cosLambda - b * this.sinLambda;
      this.right[i] = b * this.cosLambda + a * this.sinLambda;
      this.depth[i] = x * this.cosPhi - c * this.sinPhi;
      this.up[i] = c * this.cosPhi + x * this.sinPhi;
    }
    return count;
  }

  // Screen position of rotated point i
  x(i: number): number {
    return this.view.cx + this.view.radius * this.right[i]!;
  }
  y(i: number): number {
    return this.view.cy - this.view.radius * this.up[i]!;
  }

  // Where the line from point i (in front) to point j (behind) crosses the rim: its screen
  // position, and its angle around the rim (clockwise on screen, from the right)
  rimPoint(i: number, j: number): { x: number; y: number; angle: number } {
    const t = this.depth[i]! / (this.depth[i]! - this.depth[j]!);
    const right = this.right[i]! + t * (this.right[j]! - this.right[i]!);
    const up = this.up[i]! + t * (this.up[j]! - this.up[i]!);
    const length = Math.hypot(right, up) || 1;
    const { cx, cy, radius } = this.view;
    return {
      x: cx + (radius * right) / length,
      y: cy - (radius * up) / length,
      angle: Math.atan2(-up, right),
    };
  }
}

// A coordinate with one decimal: finer than a pixel, and a short string
function n(value: number): number {
  return Math.round(value * 10) / 10;
}

// One stretch of a ring that's in front: it enters over the rim, runs along the ring, and leaves
// over the rim again
type Point = { x: number; y: number };
type Stretch = {
  points: string;
  // Angles round the rim where it comes in and goes out, and where it comes in on screen
  entry: number;
  exit: number;
  entryAt: Point;
  // Twice its area so far (the shoelace formula), and its last point
  area: number;
  last: Point;
};

const FULL_TURN = 2 * Math.PI;
// A stretch smaller than this (dp²) that goes out within SLIVER_GAP (dp) of where it came in
// isn't drawn
const MIN_STRETCH_AREA = 1;
const SLIVER_GAP = 3;
// Room for rounding when checking how far a shape can run along the rim (radians, about 3°)
const RIM_SLACK = 0.05;

function addPoint(stretch: Stretch, point: Point) {
  stretch.area += stretch.last.x * point.y - point.x * stretch.last.y;
  stretch.last = point;
  if (point !== stretch.entryAt) stretch.points += `L${n(point.x)},${n(point.y)}`;
}

// The SVG path of shapes on the globe: the parts facing the viewer. A shape cut by the rim is
// closed by following the rim, clockwise, from where it leaves to where it next comes back (the
// outlines go clockwise round each country, so the country is always on the inside of that turn).
export function shapesPath(shapes: Shape[], view: GlobeView): string {
  const projector = new Projector(view);
  const parts: string[] = [];

  for (const shape of shapes) {
    const [a, b, c] = shape.center;
    // The cap's nearest point is round the back: nothing of it shows
    const facing = projector.facing(a, b, c);
    if (Math.acos(Math.min(1, Math.max(-1, facing))) - shape.spread > Math.PI / 2) continue;

    const stretches: Stretch[] = [];
    for (const ring of shape.rings) {
      const count = projector.rotateRing(ring);
      let inFront = 0;
      for (let i = 0; i < count; i++) if (projector.depth[i]! > 0) inFront++;
      if (inFront === 0) continue;

      if (inFront === count) {
        let path = `M${n(projector.x(0))},${n(projector.y(0))}`;
        for (let i = 1; i < count; i++) path += `L${n(projector.x(i))},${n(projector.y(i))}`;
        parts.push(`${path}Z`);
        continue;
      }

      // Start where the ring comes round to the front, so every stretch is whole
      let start = 0;
      while (!(projector.depth[start]! > 0 && projector.depth[(start + count - 1) % count]! <= 0)) {
        start++;
      }
      let stretch: Stretch | null = null;
      for (let k = 0; k < count; k++) {
        const i = (start + k) % count;
        const previous = (i + count - 1) % count;
        const next = (i + 1) % count;
        if (projector.depth[i]! <= 0) continue;
        if (projector.depth[previous]! <= 0) {
          const rim = projector.rimPoint(i, previous);
          // Points without the command letter: the joining below puts M or L in front
          stretch = {
            points: `${n(rim.x)},${n(rim.y)}`,
            entry: rim.angle,
            entryAt: rim,
            exit: 0,
            area: 0,
            last: rim,
          };
        }
        if (stretch === null) continue;
        const point = { x: projector.x(i), y: projector.y(i) };
        addPoint(stretch, point);
        if (projector.depth[next]! <= 0) {
          const rim = projector.rimPoint(i, next);
          addPoint(stretch, rim);
          stretch.exit = rim.angle;
          // A sliver at the rim, too small to see: it goes out where it came in, and closed
          // straight back it has (almost) no area. Dropped: its way in and out can come in the
          // wrong order round the rim (rounding), which would make the rim-following below go
          // the whole way round. (A thin stretch that comes in and goes out far apart isn't a
          // sliver: the rim between those points closes a real area, like Antarctica's.)
          addPoint(stretch, stretch.entryAt);
          const gap = Math.hypot(rim.x - stretch.entryAt.x, rim.y - stretch.entryAt.y);
          if (Math.abs(stretch.area) / 2 >= MIN_STRETCH_AREA || gap >= SLIVER_GAP) {
            stretches.push(stretch);
          }
          stretch = null;
        }
      }
    }

    // Join the stretches round the rim into closed outlines
    const unused = new Set(stretches);
    for (const first of stretches) {
      if (!unused.has(first)) continue;
      unused.delete(first);
      let path = `M${first.points}`;
      let current = first;
      for (;;) {
        // The next entry clockwise round the rim from where this stretch leaves
        let nextStretch = first;
        let turn = clockwise(current.exit, first.entry);
        for (const candidate of unused) {
          const candidateTurn = clockwise(current.exit, candidate.entry);
          if (candidateTurn < turn) {
            nextStretch = candidate;
            turn = candidateTurn;
          }
        }
        // A shape lies within a cap `spread` wide, so it can only run along the rim for twice
        // that. A longer turn comes from a sliver hugging the rim, where the straight lines
        // between its points don't follow the curve closely enough: close it straight instead.
        if (turn > 2 * shape.spread + RIM_SLACK) {
          path += 'Z';
          break;
        }
        const r = n(view.radius);
        const large = turn > Math.PI ? 1 : 0;
        const { x, y } = nextStretch.entryAt;
        path += `A${r},${r} 0 ${large} 1 ${n(x)},${n(y)}`;
        if (nextStretch === first) break;
        unused.delete(nextStretch);
        path += `L${nextStretch.points}`;
        current = nextStretch;
      }
      parts.push(`${path}Z`);
    }
  }
  return parts.join('');
}

// The angle from `from` to `to` going clockwise round the rim, 0 to a full turn
function clockwise(from: number, to: number): number {
  return (((to - from) % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

// The SVG path of lines on the globe, cut where they go round the back
export function linesPath(lines: Ring[], view: GlobeView): string {
  const projector = new Projector(view);
  const parts: string[] = [];
  for (const line of lines) {
    const count = projector.rotateRing(line);
    for (let i = 0; i < count; i++) {
      const inFront = projector.depth[i]! > 0;
      const previousInFront = i > 0 && projector.depth[i - 1]! > 0;
      if (inFront && previousInFront) {
        parts.push(`L${n(projector.x(i))},${n(projector.y(i))}`);
      } else if (inFront) {
        const from =
          i > 0 ? projector.rimPoint(i, i - 1) : { x: projector.x(i), y: projector.y(i) };
        parts.push(`M${n(from.x)},${n(from.y)}L${n(projector.x(i))},${n(projector.y(i))}`);
      } else if (previousInFront) {
        const rim = projector.rimPoint(i - 1, i);
        parts.push(`L${n(rim.x)},${n(rim.y)}`);
      }
    }
  }
  return parts.join('');
}
