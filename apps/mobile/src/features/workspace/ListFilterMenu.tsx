import { GlassView } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";
import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { ControlPillMenu } from "../../components/ControlPillMenu";
import type { ControlPillMenuProps } from "../../components/ControlPillMenu.types";
import { cn } from "../../lib/cn";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../../native/native-glass";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";

const FilterGlass = withUniwind(GlassView, {
  style: { fromClassName: "className" },
  tintColor: { fromClassName: "tintColorClassName", styleProperty: "accentColor" },
});

const PILL = "h-8 flex-row items-center gap-1.5 rounded-full px-3";

/** A visible filter with a native menu containing only that filter's choices. */
export function ListFilterMenu(props: {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly active?: boolean;
  readonly icon?: boolean;
  readonly actions: ControlPillMenuProps["actions"];
  readonly onSelect: (id: string) => void;
}) {
  const content = (
    <>
      {props.icon ? (
        <SymbolView
          name="line.3.horizontal.decrease"
          size={15}
          tintColorClassName={props.active ? "accent-primary-foreground" : "accent-icon-muted"}
        />
      ) : null}
      <Text
        numberOfLines={1}
        className={cn(
          "max-w-[180px] text-sm font-t3-medium",
          props.active ? "text-primary-foreground" : "text-foreground-muted",
        )}
      >
        {props.label}
      </Text>
      {!props.icon ? (
        <SymbolView
          name="chevron.down"
          size={11}
          tintColorClassName={props.active ? "accent-primary-foreground" : "accent-icon-muted"}
        />
      ) : null}
    </>
  );
  return (
    <ControlPillMenu
      title={props.accessibilityLabel}
      actions={props.actions}
      onPressAction={({ nativeEvent }) => props.onSelect(nativeEvent.event)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        hitSlop={6}
      >
        <PillSurface active={props.active}>{content}</PillSurface>
      </Pressable>
    </ControlPillMenu>
  );
}

function PillSurface(props: { readonly active?: boolean; readonly children: ReactNode }) {
  const { themeAppearance } = useAppearancePreferences();
  return NATIVE_LIQUID_GLASS_SUPPORTED ? (
    <FilterGlass
      isInteractive
      colorScheme={themeAppearance}
      tintColorClassName={props.active ? "accent-primary" : undefined}
      className={PILL}
    >
      {props.children}
    </FilterGlass>
  ) : (
    <View className={cn(PILL, props.active ? "bg-primary" : "bg-subtle")}>{props.children}</View>
  );
}

/** A one-tap filter chip styled like ListFilterMenu, with an optional needs-you dot. */
export function ListFilterPill(props: {
  readonly label: string;
  readonly active: boolean;
  readonly needsUser?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.needsUser ? `${props.label}, needs you` : props.label}
      accessibilityState={{ selected: props.active }}
      hitSlop={6}
      onPress={props.onPress}
    >
      <PillSurface active={props.active}>
        <Text
          numberOfLines={1}
          className={cn(
            "max-w-[180px] text-sm font-t3-medium",
            props.active ? "text-primary-foreground" : "text-foreground-muted",
          )}
        >
          {props.label}
        </Text>
        {props.needsUser ? <View className="size-1.5 rounded-full bg-warning-foreground" /> : null}
      </PillSurface>
    </Pressable>
  );
}
