import type { MessageKey } from "@/i18n/config";

/**
 * The four destinations, shared by the desktop header nav and the phone tab
 * bar so the two can never drift apart. Both render every item; which one is
 * visible is decided in CSS, not in JavaScript, so the server and the client
 * always agree.
 */
export interface NavItem {
  /**
   * `null` means the href is resolved per request — the campaign link points
   * at one concrete campaign, chosen server-side in AppShell.
   */
  href: string | null;
  /**
   * Path prefix that marks the item current. Separate from `href` because the
   * campaign link lands on a single campaign while every campaign page should
   * light it up.
   */
  match: string;
  key: MessageKey;
  manageOnly?: boolean;
  /** Single-path outline glyph on a 24×24 canvas, stroked rather than filled. */
  icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    match: "/",
    key: "nav.dashboard",
    icon: "M4 13h7V4H4v9Zm9 7h7v-9h-7v9ZM4 20h7v-4H4v4Zm9-11h7V4h-7v5Z",
  },
  {
    href: null,
    match: "/campaigns",
    key: "nav.campaign",
    icon: "M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  },
  {
    href: "/history",
    match: "/history",
    key: "nav.history",
    icon: "M12 8v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4",
  },
  {
    href: "/rules",
    match: "/rules",
    key: "nav.rules",
    icon: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Zm0 15A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h6",
  },
  {
    href: "/manage",
    match: "/manage",
    key: "nav.management",
    manageOnly: true,
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2-1.2L14.6 3H9.4L9 5.7a7.5 7.5 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2 1.2l.4 2.7h5.2l.4-2.7a7.5 7.5 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z",
  },
];

/** The dashboard is the only exact match; everything else matches by prefix. */
export function isNavActive(pathname: string, match: string): boolean {
  return match === "/" ? pathname === "/" : pathname.startsWith(match);
}

export function visibleNavItems(canManage: boolean): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.manageOnly || canManage);
}
