import { Icon } from '@/components/ui/icon';
import type { Coordinates } from '@convex/schema';
import { geoGraticule10, geoOrthographic } from 'd3-geo';
import { useIsFocused } from 'expo-router';
import { ZoomOutIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import { linesPath, shapesPath, toLines, toShapes, type GlobeView } from '../globe-projection';
import { worldCountries, type Country } from '../world';

// How the globe moves
const SPIN_DEG_PER_SEC = 7; // the slow turn when nobody touches it
const INTRO_MS = 2600; // the first spin, which ends on the newest trip's city
const INTRO_TURN_DEG = 240;
const INTRO_START_ZOOM = 0.8;
const ZOOM_IN_MS = 600; // the flight to a double-tapped spot
const ZOOM_OUT_MS = 500; // back to the whole globe, from the zoom-out button
const MAX_ZOOM = 6; // the outlines are coarse (see world.ts): closer, they'd look jagged
// Above this the globe counts as zoomed in: it stops turning by itself (the country would slide
// away) and the zoom-out button shows
const ZOOMED_IN = 1.05;
// Redraws per second: fewer for the slow turn, where 20 a second still moves less than a pixel
// each time; more for flights and flicks, which move faster
const SLOW_FRAME_MS = 1000 / 20;
const FAST_FRAME_MS = 1000 / 30;
const MAX_TILT_DEG = 70; // how far up or down it can tip: enough to reach Norway or Iceland
const MAX_FLING_DEG_PER_SEC = 720;
const GLOW = 14; // the atmosphere's width around the globe (dp)

// A pale sea and white land, so the visited countries' strong blue stands out from both
const COLORS = {
  light: {
    oceanCenter: '#f0f9ff',
    oceanEdge: '#bae6fd',
    grid: 'rgba(14,165,233,0.14)',
    land: '#ffffff',
    border: '#bfdbfe',
    visited: '#2563eb',
    visitedBorder: '#1e3a8a',
    glow: '#7dd3fc',
    // The shadow round the edge: lighter than at night, where a pale sea would turn it grey
    shade: 0.14,
  },
  dark: {
    oceanCenter: '#172340',
    oceanEdge: '#070d1c',
    grid: 'rgba(148,163,184,0.14)',
    land: '#334155',
    border: '#1e293b',
    visited: '#3b82f6',
    visitedBorder: '#bfdbfe',
    glow: '#3b82f6',
    shade: 0.28,
  },
};

// Where the globe is turned: d3-geo's rotation (the point [-lambda, -phi] faces the viewer) and
// how close it is (1 = the whole globe; smaller during the intro, bigger when zoomed in)
type Spin = { lambda: number; phi: number; zoom: number };

// A move animated from one Spin to another (the intro, a double tap, the zoom-out button).
// `start` is set on its first frame.
type Flight = { from: Spin; to: Spin; ms: number; start?: number };

type VisitedGlobeProps = {
  countries: ReadonlySet<Country>;
  // The newest trip's city, which the intro ends on
  home?: Coordinates;
  // Width and height (dp)
  size: number;
  accessibilityLabel: string;
};

// The account tab's globe: the countries of the user's past trips filled in blue. It opens with
// a spin that ends on the newest trip's city, then turns slowly. A sideways drag spins it (a
// flick keeps it going for a moment), and moving the finger up or down while dragging tips it.
// Pinching zooms in and out (moving both fingers moves the view), and a double tap flies to the
// tapped spot and zooms in on it.
//
// An orthographic projection is the globe as seen from far away; globe-projection.ts turns the
// country outlines into SVG paths for it, cut off where they go round the back. Zooming draws a
// bigger globe seen through a round "lens" the size of the whole one, so the globe keeps its
// place on the page and only its surface comes closer. All the countries share one path and
// the visited ones another, so each frame redraws a handful of SVG elements, not 177. The frames
// come from requestAnimationFrame on the JS thread; they run only while the account tab is on
// screen and something moves (a still globe, zoomed in or with reduce motion, asks for none).
// The phone's "reduce motion" setting turns the spin and the flights off (dragging and zooming
// still work).
export function VisitedGlobe({ countries, home, size, accessibilityLabel }: VisitedGlobeProps) {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();

  const center = size / 2;
  const radius = size / 2 - GLOW;
  // A drag across the globe's whole width turns it by about 115° (less when zoomed in): the
  // surface follows the finger
  const degreesPerDp = 180 / (Math.PI * radius);

  // The newest trip's city faces the viewer when the intro ends. Without trips: Europe, tipped
  // to show the north, where most trips go.
  const [homeSpin] = useState<Spin>(() =>
    home
      ? { lambda: -home.longitude, phi: clamp(-home.latitude, MAX_TILT_DEG), zoom: 1 }
      : { lambda: -15, phi: -30, zoom: 1 },
  );
  const [view, setView] = useState<Spin>(() =>
    reduceMotion
      ? homeSpin
      : { lambda: homeSpin.lambda - INTRO_TURN_DEG, phi: homeSpin.phi, zoom: INTRO_START_ZOOM },
  );

  // The animation's live state, changed every frame and by the gestures. Kept in refs, not
  // state: only the copy handed to setView makes React draw.
  const current = useRef<Spin>({ ...view });
  const flight = useRef<Flight | null>(
    reduceMotion ? null : { from: { ...view }, to: homeSpin, ms: INTRO_MS },
  );
  const spinSpeed = useRef(0); // degrees per second
  const isDragging = useRef(false);
  const isPinching = useRef(false);
  // Where the pinching fingers' middle was on the last update, to move the view with it
  const lastFocal = useRef<{ x: number; y: number } | null>(null);
  // Restarts the frames after they stopped (see below); set by the effect
  const wake = useRef(() => {});

  useEffect(() => {
    if (!isFocused) return;
    let frame = 0;
    let running = true;
    let last: number | undefined;
    let lastDrawn = 0;

    function tick(now: number) {
      const seconds = last === undefined ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      const next = current.current;
      const touching = isDragging.current || isPinching.current;
      let moved = touching;
      // A flight's last frame is always drawn: nothing may move after it (zoomed in, the globe
      // stays still)
      let mustDraw = false;

      const move = flight.current;
      if (move !== null) {
        // Not `??=`: React Compiler can't read it, and would leave the whole globe uncompiled
        if (move.start === undefined) move.start = now;
        const progress = move.ms <= 0 ? 1 : Math.min((now - move.start) / move.ms, 1);
        const eased = 1 - (1 - progress) ** 3; // fast at first, settling at the end
        next.lambda = move.from.lambda + (move.to.lambda - move.from.lambda) * eased;
        next.phi = move.from.phi + (move.to.phi - move.from.phi) * eased;
        next.zoom = move.from.zoom + (move.to.zoom - move.from.zoom) * eased;
        if (progress === 1) {
          flight.current = null;
          mustDraw = true;
        }
        moved = true;
      }
      // After a flick the speed eases back to the slow turn, or to a stop when zoomed in or with
      // reduce motion
      const target = reduceMotion || next.zoom > ZOOMED_IN ? 0 : SPIN_DEG_PER_SEC;
      if (move === null && !touching) {
        spinSpeed.current += (target - spinSpeed.current) * (1 - Math.exp(-seconds * 1.5));
        next.lambda = (next.lambda + spinSpeed.current * seconds) % 360;
        moved = Math.abs(spinSpeed.current) > 0.05;
      }

      // Nothing moves and nothing will until a finger or a button moves it: the frames stop
      // (and the JS thread rests) after drawing where it came to a stop
      const settled = !touching && flight.current === null && target === 0 && !moved && !mustDraw;
      if (settled) spinSpeed.current = 0;

      const fast = flight.current !== null || Math.abs(spinSpeed.current) > 2 * SPIN_DEG_PER_SEC;
      const frameMs = fast ? FAST_FRAME_MS : SLOW_FRAME_MS;
      if (settled || mustDraw || (moved && (touching || now - lastDrawn >= frameMs))) {
        lastDrawn = now;
        setView({ ...next });
      }
      if (settled) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    wake.current = () => {
      if (running) return;
      running = true;
      last = undefined;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      wake.current = () => {};
    };
  }, [isFocused, reduceMotion]);

  // A finger on the globe takes over from whatever was moving it. The intro may be stopped while
  // still zoomed out a little: it jumps to the whole globe.
  function takeOver() {
    flight.current = null;
    spinSpeed.current = 0;
    current.current.zoom = Math.max(current.current.zoom, 1);
    wake.current();
  }

  function flyTo(to: Spin, ms: number) {
    spinSpeed.current = 0;
    flight.current = { from: { ...current.current }, to, ms: reduceMotion ? 0 : ms };
    wake.current();
  }

  // A double tap at (x, y): that spot comes to the middle, twice as close
  function zoomInAt(x: number, y: number) {
    const at = current.current;
    // Off the globe (the corners around it) there's nothing to zoom in on. Checked here: d3-geo
    // would answer with the nearest point on the rim.
    if (Math.hypot(x - center, y - center) > radius * Math.min(at.zoom, 1)) return;
    const projection = geoOrthographic()
      .rotate([at.lambda, at.phi])
      .translate([center, center])
      .scale(radius * at.zoom);
    const point = projection.invert?.([x, y]);
    if (!point) return;
    const [longitude, latitude] = point;
    // The shorter way round: from 170° to -170° is 20° east, not 340° west
    const turn = ((((-longitude - at.lambda) % 360) + 540) % 360) - 180;
    flyTo(
      {
        lambda: at.lambda + turn,
        phi: clamp(-latitude, MAX_TILT_DEG),
        zoom: Math.min(Math.max(at.zoom, 1) * 2, MAX_ZOOM),
      },
      ZOOM_IN_MS,
    );
  }

  // Sideways drags spin the globe; up-and-down ones are left to the page, which scrolls. One
  // finger only: a second one makes it a pinch. runOnJS: the callbacks change the refs above,
  // which live on the JS thread.
  const drag = usePanGesture({
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    maxPointers: 1,
    runOnJS: true,
    onActivate: () => {
      isDragging.current = true;
      takeOver();
    },
    onUpdate: (event) => {
      const next = current.current;
      const perDp = degreesPerDp / next.zoom;
      next.lambda += event.changeX * perDp;
      next.phi = clamp(next.phi - event.changeY * perDp, MAX_TILT_DEG);
    },
    onDeactivate: (event) => {
      isDragging.current = false;
      const perDp = degreesPerDp / current.current.zoom;
      spinSpeed.current = clamp(event.velocityX * perDp, MAX_FLING_DEG_PER_SEC);
    },
  });

  // Fingers apart to zoom in, together to zoom out; moving both moves the view
  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: (event) => {
      isPinching.current = true;
      takeOver();
      lastFocal.current = { x: event.focalX, y: event.focalY };
    },
    onUpdate: (event) => {
      const next = current.current;
      const focal = lastFocal.current ?? { x: event.focalX, y: event.focalY };
      const perDp = degreesPerDp / next.zoom;
      next.lambda += (event.focalX - focal.x) * perDp;
      next.phi = clamp(next.phi - (event.focalY - focal.y) * perDp, MAX_TILT_DEG);
      // scaleChange: how much the fingers' spread changed since the last update (1.1 = 10% wider)
      next.zoom = Math.min(Math.max(next.zoom * event.scaleChange, 1), MAX_ZOOM);
      lastFocal.current = { x: event.focalX, y: event.focalY };
    },
    onDeactivate: () => {
      isPinching.current = false;
      lastFocal.current = null;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    runOnJS: true,
    onActivate: (event) => zoomInAt(event.x, event.y),
  });

  // All three at once: a pinch can start while a drag is under way, and the double tap fails by
  // itself as soon as a finger moves
  const gestures = useSimultaneousGestures(drag, pinch, doubleTap);

  const zoomedIn = view.zoom > ZOOMED_IN;

  return (
    <View style={{ width: size, height: size }}>
      <GestureDetector gesture={gestures}>
        <View
          style={{ width: size, height: size }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        >
          <GlobeArt countries={countries} view={view} size={size} radius={radius} />
        </View>
      </GestureDetector>

      {/* Next to the globe, not inside its gesture detector, so a tap on it is only a tap */}
      {zoomedIn ? (
        <Pressable
          onPress={() => flyTo({ ...current.current, zoom: 1 }, ZOOM_OUT_MS)}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          hitSlop={8}
          className="absolute top-2 right-2 size-10 items-center justify-center rounded-full border border-border bg-card shadow-sm active:bg-accent"
        >
          <Icon as={ZoomOutIcon} className="size-5 text-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}

// The globe itself, drawn as it is turned and zoomed in `view`. Its radius at full size
// (zoom 1) is `radius`, inside a `size` square.
function GlobeArt({
  countries,
  view,
  size,
  radius,
}: {
  countries: ReadonlySet<Country>;
  view: Spin;
  size: number;
  radius: number;
}) {
  const { theme } = useUniwind();
  const colors = COLORS[theme === 'dark' ? 'dark' : 'light'];
  const center = size / 2;

  // The outlines, turned into 3D points once (see globe-projection.ts); each frame only rotates
  // them. The countries that weren't visited share one path, the visited ones another. useMemo
  // spells out what must not happen every frame (React Compiler would likely keep it anyway).
  const { otherShapes, visitedShapes } = useMemo(
    () => ({
      otherShapes: toShapes(
        worldCountries()
          .filter((country) => !countries.has(country))
          .map((country) => country.geometry),
      ),
      visitedShapes: toShapes([...countries].map((country) => country.geometry)),
    }),
    [countries],
  );
  const [gridLines] = useState(() => toLines(geoGraticule10().coordinates));

  const globeView: GlobeView = {
    lambda: view.lambda,
    phi: view.phi,
    cx: center,
    cy: center,
    radius: radius * view.zoom,
  };
  const gridShape = linesPath(gridLines, globeView);
  const landShape = shapesPath(otherShapes, globeView);
  const visitedShape = shapesPath(visitedShapes, globeView);
  // The round window the globe is seen through: the whole globe's size, or the globe itself
  // while it's smaller (the intro)
  const lensRadius = radius * Math.min(view.zoom, 1);

  return (
    <Svg width={size} height={size}>
      <Defs>
        {/* The atmosphere: a soft blue ring that fades out around the edge */}
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop
            offset={lensRadius / (lensRadius + GLOW)}
            stopColor={colors.glow}
            stopOpacity={0.45}
          />
          <Stop offset={1} stopColor={colors.glow} stopOpacity={0} />
        </RadialGradient>
        {/* The sea, lit from the top left */}
        <RadialGradient id="ocean" cx="38%" cy="32%" r="75%">
          <Stop offset={0} stopColor={colors.oceanCenter} />
          <Stop offset={1} stopColor={colors.oceanEdge} />
        </RadialGradient>
        {/* A shine on the top left and a shadow round the edge make it look round */}
        <RadialGradient id="shine" cx="35%" cy="30%" r="45%">
          <Stop offset={0} stopColor="#ffffff" stopOpacity={0.35} />
          <Stop offset={1} stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="shade" cx="50%" cy="50%" r="50%">
          <Stop offset={0.7} stopColor="#000000" stopOpacity={0} />
          <Stop offset={1} stopColor="#000000" stopOpacity={colors.shade} />
        </RadialGradient>
        <ClipPath id="lens">
          <Circle cx={center} cy={center} r={lensRadius} />
        </ClipPath>
      </Defs>

      <Circle cx={center} cy={center} r={lensRadius + GLOW} fill="url(#glow)" />
      <G clipPath="url(#lens)">
        <Circle cx={center} cy={center} r={lensRadius} fill="url(#ocean)" />
        <Path d={gridShape} fill="none" stroke={colors.grid} strokeWidth={0.6} />
        <Path d={landShape} fill={colors.land} stroke={colors.border} strokeWidth={0.5} />
        <Path
          d={visitedShape}
          fill={colors.visited}
          stroke={colors.visitedBorder}
          strokeWidth={0.8}
        />
      </G>
      <Circle cx={center} cy={center} r={lensRadius} fill="url(#shine)" />
      <Circle cx={center} cy={center} r={lensRadius} fill="url(#shade)" />
    </Svg>
  );
}

// `value` kept within -limit…limit
function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
