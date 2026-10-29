import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { AppSymbol, icons, type AppSymbolName } from "@/components/Symbol";
import { colors, radius, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";

// Shared Uber-grammar building blocks (docs/ui-critique.md §4). Screens are
// assembled from these so spacing, hierarchy and affordances stay identical
// everywhere: NavHeader on pushed screens, SectionHeader for sections,
// ListRow / GroupedCard for lists, SelectableRow for option lists, and
// StickyFooter for the one pinned CTA.

type SymbolDef = AppSymbolName & { fallback: string };

/** ← + centered title (+ optional trailing action), like Uber "Plan your trip". */
export function NavHeader({
  title,
  onBack,
  right,
  testID,
}: {
  title?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  right?: ReactNode;
  testID?: string;
}) {
  const router = useRouter();
  return (
    <View style={styles.nav} testID={testID}>
      <Pressable
        style={({ pressed }) => [styles.navSide, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        testID="nav-back"
        hitSlop={8}
        onPress={onBack ?? (() => router.back())}
      >
        <AppSymbol name={icons.back} fallback={icons.back.fallback} size={24} tintColor={colors.text} />
      </Pressable>
      <Text style={[ts.navTitle, styles.navTitle]} numberOfLines={1} accessibilityRole="header">
        {title ?? ""}
      </Text>
      <View style={[styles.navSide, styles.navRight]}>{right}</View>
    </View>
  );
}

/** Bold sentence-case section head with an optional circular arrow ("For you →"). */
export function SectionHeader({
  title,
  onMore,
  moreLabel,
  style,
}: {
  title: string;
  onMore?: () => void;
  moreLabel?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text style={ts.section} accessibilityRole="header">
        {title}
      </Text>
      {onMore && (
        <Pressable
          style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={moreLabel ?? `See all ${title}`}
          hitSlop={8}
          onPress={onMore}
        >
          <AppSymbol
            name={icons.arrowForward}
            fallback={icons.arrowForward.fallback}
            size={20}
            tintColor={colors.text}
          />
        </Pressable>
      )}
    </View>
  );
}

/** Filled rounded icon tile (Uber's clock / home / work squares). */
export function IconTile({
  icon,
  round,
  tint,
  children,
}: {
  icon?: SymbolDef;
  round?: boolean;
  tint?: string;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.tile, round && styles.tileRound]}>
      {children ??
        (icon ? (
          <AppSymbol name={icon} fallback={icon.fallback} size={20} tintColor={tint ?? colors.text} />
        ) : null)}
    </View>
  );
}

/**
 * The one list row: leading tile (or custom node), title + sub, trailing
 * value / chevron / node. `divider` draws an inset hairline under the text
 * column, the way rows inside an Uber group separate.
 */
export function ListRow({
  title,
  sub,
  icon,
  leading,
  trailing,
  value,
  chevron,
  divider,
  onPress,
  onLongPress,
  a11yLabel,
  a11yHint,
  testID,
  destructive,
}: {
  title: string;
  sub?: string | null;
  icon?: SymbolDef;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: string | null;
  chevron?: boolean;
  divider?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  a11yLabel?: string;
  a11yHint?: string;
  testID?: string;
  destructive?: boolean;
}) {
  const body = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} /> : null)}
      <View style={[styles.rowText, divider && styles.rowDivider]}>
        <View style={styles.rowTextInner}>
          <Text
            style={[ts.rowTitle, destructive && styles.destructive]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {sub ? (
            <Text style={ts.rowSub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        {value ? <Text style={ts.value}>{value}</Text> : null}
        {trailing}
        {chevron && (
          <AppSymbol
            name={icons.chevron}
            fallback={icons.chevron.fallback}
            size={20}
            tintColor={colors.textDim}
          />
        )}
      </View>
    </>
  );
  if (!onPress && !onLongPress) {
    return (
      <View style={styles.row} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? (sub ? `${title}, ${sub}` : title)}
      accessibilityHint={a11yHint}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {body}
    </Pressable>
  );
}

/** Rounded group holding rows (Uber's recents card). */
export function GroupedCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/**
 * Uber ride-option row: art left, name (+ badge) and meta, the deciding value
 * right. Selected = 2px white border; the border is always laid out
 * (transparent when idle) so selection never shifts the list.
 */
export function SelectableRow({
  title,
  meta,
  value,
  badge,
  leading,
  selected,
  onPress,
  a11yLabel,
  a11yHint,
  testID,
}: {
  title: string;
  meta?: string | null;
  value?: string | null;
  badge?: string | null;
  leading?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  a11yLabel?: string;
  a11yHint?: string;
  testID?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && onPress && styles.rowPressed,
      ]}
      disabled={!onPress}
      accessibilityRole={onPress ? "radio" : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      accessibilityLabel={a11yLabel ?? title}
      accessibilityHint={a11yHint}
      testID={testID}
      onPress={onPress}
    >
      {leading}
      <View style={styles.optionBody}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.optionTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={ts.rowSub} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[ts.value, styles.optionValue]}>{value}</Text> : null}
    </Pressable>
  );
}

/**
 * The one pinned CTA area at the bottom of a screen (Uber "Choose Auto"):
 * an optional summary line, then the action(s). Sits below the scroll view
 * in normal flow, so it can never scroll away or be pushed off-screen.
 */
export function StickyFooter({ summary, children }: { summary?: string | null; children: ReactNode }) {
  return (
    <View style={styles.footer}>
      {summary ? (
        <Text style={[ts.meta, styles.footerSummary]} numberOfLines={1}>
          {summary}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Spacer that keeps scroll content clear of the floating tab bar. */
export function TabBarClearance() {
  return <View style={styles.tabClearance} />;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  nav: { flexDirection: "row", alignItems: "center", height: 56, marginBottom: space.sm },
  navSide: { width: 44, height: 44, justifyContent: "center" },
  navRight: { alignItems: "flex-end" },
  navTitle: { flex: 1, textAlign: "center" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    marginBottom: space.md,
  },
  moreBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  tileRound: { borderRadius: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64 },
  rowPressed: { opacity: 0.7 },
  rowText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    paddingVertical: 12,
  },
  rowTextInner: { flex: 1, flexShrink: 1, gap: 2 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  destructive: { color: colors.danger },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionSelected: { borderColor: colors.text },
  optionBody: { flex: 1, flexShrink: 1, gap: 2 },
  optionTitle: { ...ts.rowTitle, fontSize: 18 },
  optionValue: { marginLeft: 8 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  badgeText: { color: colors.text, fontSize: 12, fontFamily: ts.meta.fontFamily },
  footer: {
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerSummary: { textAlign: "center", marginTop: space.xs },
  tabClearance: { height: 110 },
});
