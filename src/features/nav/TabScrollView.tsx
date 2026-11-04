import type { ComponentProps } from "react";
import Animated, { makeMutable, useAnimatedScrollHandler } from "react-native-reanimated";

// Scroll-linked tab bar visibility, the iOS 26 / Uber behaviour on both
// platforms: scrolling down into content tucks the bar away, any upward
// scroll (or reaching the top) brings it back. One module-level value
// because only one tab root is focused at a time; TabBar resets it on
// every tab change so a screen never opens with the bar hidden.

/** 0 = shown, 1 = hidden. Read by TabBar, written on the UI thread. */
export const tabBarHidden = makeMutable(0);

/** Ignore jitter: a direction change must travel this far to count. */
const SLOP = 12;
/** Near the top the bar always shows (nothing to make room for). */
const TOP_ZONE = 48;

export function TabScrollView(props: ComponentProps<typeof Animated.ScrollView>) {
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (e, ctx: { anchor: number }) => {
      ctx.anchor = e.contentOffset.y;
    },
    onScroll: (e, ctx: { anchor: number }) => {
      const y = e.contentOffset.y;
      if (y <= TOP_ZONE) {
        tabBarHidden.value = 0;
        ctx.anchor = y;
        return;
      }
      const dy = y - (ctx.anchor ?? y);
      if (dy > SLOP) tabBarHidden.value = 1;
      else if (dy < -SLOP) tabBarHidden.value = 0;
      if (Math.abs(dy) > SLOP) ctx.anchor = y;
    },
  });
  return <Animated.ScrollView scrollEventThrottle={16} {...props} onScroll={onScroll} />;
}
