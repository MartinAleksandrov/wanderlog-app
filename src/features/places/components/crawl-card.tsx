import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openRouteDirections } from '@/lib/directions';
import { formatDistance, formatMinutes } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { Coordinates } from '@convex/schema';
import { FootprintsIcon, RouteIcon } from 'lucide-react-native';
import { Fragment } from 'react';
import { View } from 'react-native';
import { planCrawl, type Crawl, type CrawlSpot } from '../crawl';
import type { PlaceMode } from '../place-modes';

type CrawlCardProps = {
  // Sights, sweet spots or restaurants: the card's title, button and colours
  mode: PlaceMode;
  // The saved places to pick from
  spots: CrawlSpot[];
  // The phone, when it's in the city: the crawl starts near it, and Google Maps routes from it
  start: Coordinates | null;
};

// The crawl above the saved places ("Sightseeing walk", "Sweet-spot crawl", "Food crawl"): the
// 3–4 saved places that make the best walk together (crawl.ts), in walking order, and one button
// that opens the whole walk in Google Maps as a single route with stops on the way (Maps URLs, so
// it costs nothing). Shown once at least two saved places are close enough for one walk.
export function CrawlCard({ mode, spots, start }: CrawlCardProps) {
  const crawl = planCrawl(spots, start);
  if (crawl === null) return null;
  const { stops } = crawl;

  return (
    <View className={cn('gap-3 rounded-3xl border-2 bg-card p-4', mode.cardBorder)}>
      <View className="flex-row items-center gap-3">
        <View className={cn('size-11 items-center justify-center rounded-2xl', mode.bannerIcon)}>
          <Icon as={RouteIcon} className="size-5 text-white" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold">{mode.crawl.title}</Text>
          <Text variant="muted" className="text-xs">
            {summary(crawl)}
          </Text>
        </View>
      </View>

      <View className="px-1">
        {stops.map((stop, index) => (
          <Fragment key={stop.key}>
            {/* A dotted path between the numbered stops */}
            {index > 0 ? (
              <View className={cn('ml-[11px] h-3 border-l-2 border-dotted', mode.crawl.path)} />
            ) : null}
            <View className="flex-row items-center gap-3">
              <View
                className={cn('size-6 items-center justify-center rounded-full', mode.bannerIcon)}
              >
                <Text className="text-xs font-bold text-white">{index + 1}</Text>
              </View>
              <Text className="flex-1 font-medium" numberOfLines={1}>
                {stop.name}
              </Text>
              {stop.rating ? (
                <Text className="text-xs text-muted-foreground">
                  <Text className="text-xs text-orange-500">★</Text> {stop.rating.toFixed(1)}
                </Text>
              ) : null}
            </View>
          </Fragment>
        ))}
      </View>

      <Button
        className={mode.addButton}
        onPress={() => openRouteDirections(stops, { startAtFirst: start === null })}
      >
        <Icon as={FootprintsIcon} className="size-4 text-white" />
        <Text className="text-white">{mode.crawl.button}</Text>
      </Button>
    </View>
  );
}

// "4 stops · 1.2 km · ~15 min walk · first stop 350 m from you"
function summary({ stops, walk, fromMe }: Crawl): string {
  const parts = [
    `${stops.length} stops`,
    formatDistance(walk.meters),
    `~${formatMinutes(Math.max(1, walk.minutes))} walk`,
  ];
  if (fromMe !== undefined) parts.push(`first stop ${formatDistance(fromMe)} from you`);
  return parts.join(' · ');
}
