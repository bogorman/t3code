import {
  type ScopedThreadRef,
  type ThreadBadge,
  type ThreadBadgeIcon,
  type ThreadBadgeTone,
  visibleThreadBadges,
} from "@t3tools/contracts";
import {
  BellIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FlagIcon,
  LinkIcon,
  ListIcon,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent } from "react";

import { useOpenLink } from "../browser/useOpenLink";
import { useNowMinute } from "../hooks/useNowMinute";
import { cn } from "../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

const ICONS: Record<ThreadBadgeIcon, LucideIcon> = {
  list: ListIcon,
  check: CircleCheckIcon,
  alert: CircleAlertIcon,
  bell: BellIcon,
  flag: FlagIcon,
  link: LinkIcon,
};

const TONES: Record<ThreadBadgeTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

/**
 * Badges outside tools put on a thread (t3_thread_badge_set), shown beside the
 * pull request badge. Each links out; one marked "needs you" takes the warning
 * colour and says why. Settled threads keep their badges but drop the needs-you
 * mark: the user already said they're done.
 */
export function ThreadBadges({
  badges,
  threadRef,
  settled,
}: {
  badges: ReadonlyArray<ThreadBadge>;
  threadRef: ScopedThreadRef;
  settled: boolean;
}) {
  const openLink = useOpenLink(threadRef);
  // Re-checked each minute, so an expired badge drops off without other updates.
  // useNowMinute is UTC without a zone ("2026-10-10T12:00"); say so, or it parses as local time.
  const visible = visibleThreadBadges(badges, Date.parse(`${useNowMinute()}:00Z`));
  if (visible.length === 0) return null;
  return (
    <>
      {visible.map((badge) => {
        const needsYou = !settled && badge.needsYou !== undefined;
        const Icon = ICONS[badge.icon ?? (needsYou ? "bell" : "list")];
        const text = badge.count !== undefined ? String(badge.count) : badge.label;
        const onClick = (event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          if (badge.url !== undefined) void openLink(badge.url, { event, threadRef });
        };
        return (
          <Tooltip key={badge.key}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  data-testid={`thread-badge-${badge.key}`}
                  aria-label={[badge.label, text, badge.needsYou, badge.source]
                    .filter(Boolean)
                    .join(", ")}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={onClick}
                  disabled={badge.url === undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 font-normal text-xs tabular-nums",
                    needsYou ? "text-warning" : TONES[badge.tone ?? "neutral"],
                    badge.url !== undefined && "cursor-pointer hover:opacity-80",
                  )}
                />
              }
            >
              <Icon aria-hidden className="size-3 shrink-0" />
              {text !== undefined ? <span>{text}</span> : null}
            </TooltipTrigger>
            <TooltipPopup side="top" sideOffset={0} variant="glass" className="max-w-72 text-left">
              {needsYou ? <div className="font-medium">Needs you: {badge.needsYou}</div> : null}
              {badge.tooltip !== undefined ? <div>{badge.tooltip}</div> : null}
              <div className="text-muted-foreground">From {badge.source}</div>
            </TooltipPopup>
          </Tooltip>
        );
      })}
    </>
  );
}
