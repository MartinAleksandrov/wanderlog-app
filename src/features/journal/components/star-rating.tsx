import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { MAX_RATING } from '@convex/lib/limits';
import { StarIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';

// A star filling in grows from nothing and overshoots a little, like a spring; the stars of one
// tap pop one after another, left to right
const STAR_POP = ZoomIn.springify().damping(8).stiffness(280);
const STAR_STAGGER_MS = 40;
const STAR_FILL = '#fbbf24'; // amber-400

const STARS = Array.from({ length: MAX_RATING }, (_, index) => index + 1);

type StarRatingProps = {
  // 1 to 5, or undefined for no stars yet
  value?: number;
  // Without it the stars are only shown (the past-trips list)
  onChange?: (rating: number | null) => void;
  size?: 'sm' | 'lg';
};

// The journal's 1-to-5 stars. Tapping a star gives that many; tapping the current one again
// takes the stars away. Stars already filled when the screen opens don't pop
// (LayoutAnimationConfig skipEntering); only ones filled by a tap do.
export function StarRating({ value, onChange, size = 'lg' }: StarRatingProps) {
  const iconClass = size === 'sm' ? 'size-3.5' : 'size-7';

  if (onChange === undefined) {
    return (
      <View
        className="flex-row gap-0.5"
        accessible
        accessibilityLabel={value ? `${value} of ${MAX_RATING} stars` : 'Not rated'}
      >
        {STARS.map((star) => (
          <StarShape
            key={star}
            filled={value !== undefined && star <= value}
            className={iconClass}
          />
        ))}
      </View>
    );
  }

  return (
    <LayoutAnimationConfig skipEntering>
      <View className="flex-row gap-1">
        {STARS.map((star) => {
          const filled = value !== undefined && star <= value;
          return (
            <Pressable
              key={star}
              hitSlop={6}
              onPress={() => onChange(star === value ? null : star)}
              accessibilityRole="button"
              accessibilityLabel={star === 1 ? '1 star' : `${star} stars`}
              accessibilityState={{ selected: value === star }}
            >
              {/* A new key when it fills in, so the filled star mounts and pops */}
              {filled ? (
                <Animated.View key="filled" entering={STAR_POP.delay((star - 1) * STAR_STAGGER_MS)}>
                  <StarShape filled className={iconClass} />
                </Animated.View>
              ) : (
                <View key="empty">
                  <StarShape filled={false} className={iconClass} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </LayoutAnimationConfig>
  );
}

function StarShape({ filled, className }: { filled: boolean; className: string }) {
  return (
    <Icon
      as={StarIcon}
      className={cn(className, filled ? 'text-amber-400' : 'text-muted-foreground')}
      fill={filled ? STAR_FILL : 'none'}
      strokeWidth={filled ? 1.5 : 1.75}
    />
  );
}
