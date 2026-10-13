import * as Schema from "effect/Schema";

import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * A small badge an outside tool puts on a thread, such as a task tracker's
 * count of open items for that thread. It shows beside the pull request badge,
 * links out, and can mark the thread as needing the user. Plain text only.
 */
export const THREAD_BADGE_ICONS = ["list", "check", "alert", "bell", "flag", "link"] as const;
export const ThreadBadgeIcon = Schema.Literals(THREAD_BADGE_ICONS);
export type ThreadBadgeIcon = typeof ThreadBadgeIcon.Type;

export const ThreadBadgeTone = Schema.Literals(["neutral", "info", "success", "warning", "danger"]);
export type ThreadBadgeTone = typeof ThreadBadgeTone.Type;

/** Most badges a thread holds; setting another one past this is refused. */
export const MAX_THREAD_BADGES = 3;

const BadgeKey = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z0-9][a-z0-9._-]*$/),
);
const BadgeText = (max: number) => TrimmedNonEmptyString.check(Schema.isMaxLength(max));

/** http(s) or a t3code:// link; nothing else opens from a badge. */
export const ThreadBadgeUrl = TrimmedNonEmptyString.check(
  Schema.isMaxLength(2000),
  Schema.isPattern(/^(https?|t3code(-dev)?):\/\/\S+$/i),
);

/** What a tool sends. The server adds who set it and when. */
export const ThreadBadgeInput = Schema.Struct({
  /** One badge per key per thread; setting the same key replaces it. */
  key: BadgeKey,
  label: Schema.optional(BadgeText(24)),
  /** 0 hides the badge. */
  count: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 9999 }))),
  icon: Schema.optional(ThreadBadgeIcon),
  tone: Schema.optional(ThreadBadgeTone),
  tooltip: Schema.optional(BadgeText(200)),
  url: Schema.optional(ThreadBadgeUrl),
  /** Marks the thread as needing the user, with a short reason. */
  needsYou: Schema.optional(BadgeText(80)),
  expiresAt: Schema.optional(IsoDateTime),
});
export type ThreadBadgeInput = typeof ThreadBadgeInput.Type;

export const ThreadBadge = Schema.Struct({
  ...ThreadBadgeInput.fields,
  /** The signed-in tool that set it, shown in the tooltip. */
  source: BadgeText(80),
  updatedAt: IsoDateTime,
});
export type ThreadBadge = typeof ThreadBadge.Type;

/** Badges worth showing now: not expired, and not a zero count. */
export function visibleThreadBadges(
  badges: ReadonlyArray<ThreadBadge> | undefined,
  nowMs: number,
): ReadonlyArray<ThreadBadge> {
  return (badges ?? []).filter(
    (badge) =>
      badge.count !== 0 && (badge.expiresAt === undefined || Date.parse(badge.expiresAt) > nowMs),
  );
}

/** The first "needs you" reason among the visible badges, with its source. */
export function threadBadgeNeedsYou(
  badges: ReadonlyArray<ThreadBadge> | undefined,
  nowMs: number,
): { readonly reason: string; readonly source: string } | null {
  const badge = visibleThreadBadges(badges, nowMs).find((item) => item.needsYou !== undefined);
  return badge?.needsYou === undefined ? null : { reason: badge.needsYou, source: badge.source };
}
