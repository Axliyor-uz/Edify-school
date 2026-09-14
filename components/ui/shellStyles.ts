/**
 * Sidebar style recipes for the teacher shell — each side variant of
 * App_shell_navigation is pure data: container/background, text colors, and
 * which animated indicator it uses. Consumed by app/teacher/layout.tsx (the
 * real shell) and by /theme-check-teacher (static previews), so what the
 * gallery shows is exactly what the shell renders.
 *
 * `rail` and `floating` reuse the 'sidebar' recipe — their difference is the
 * container, handled in the shell markup.
 */
export type SideVariant = "sidebar" | "classic" | "tonal" | "inverse" | "gradient" | "minimal";
export type Indicator = "pill" | "bar" | "dot";

export interface SideStyle {
  /** Panel background (also used by the mobile drawer). */
  bg: string;
  /** Extra border for the fixed desktop aside only. */
  asideBorder: string;
  brandBox: string;
  brandTitle: string;
  brandAccent: string;
  brandSub: string;
  divider: string;
  /** Item radius when expanded (collapsed items are always rounded-m3-md). */
  itemShape: string;
  idle: string;
  active: string;
  /** Static background painted on the active row itself (classic look). */
  activeRowBg: string;
  iconActive: string;
  indicator: Indicator;
  indicatorCls: string;
  footerBorder: string;
  name: string;
  email: string;
  /** true → classic footer: user card + separate logout button. */
  classicFooter: boolean;
}

export const SIDE_STYLES: Record<SideVariant, SideStyle> = {
  sidebar: {
    bg: "bg-surface-container-lowest",
    asideBorder: "border-r border-outline-variant",
    brandBox: "bg-primary text-on-primary",
    brandTitle: "text-on-surface",
    brandAccent: "text-primary",
    brandSub: "text-on-surface-variant",
    divider: "bg-outline-variant",
    itemShape: "rounded-full",
    idle: "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
    active: "text-on-secondary-container",
    activeRowBg: "",
    iconActive: "text-primary",
    indicator: "pill",
    indicatorCls: "bg-secondary-container",
    footerBorder: "border-outline-variant",
    name: "text-on-surface",
    email: "text-on-surface-variant",
    classicFooter: false,
  },
  classic: {
    bg: "bg-surface-container-lowest",
    asideBorder: "border-r border-outline-variant",
    brandBox: "bg-primary text-on-primary",
    brandTitle: "text-on-surface",
    brandAccent: "text-primary",
    brandSub: "text-on-surface-variant",
    divider: "bg-outline-variant",
    itemShape: "rounded-m3-md",
    idle: "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
    active: "text-primary",
    activeRowBg: "bg-t-primary-soft",
    iconActive: "text-primary",
    indicator: "bar",
    indicatorCls: "bg-primary",
    footerBorder: "border-outline-variant",
    name: "text-on-surface",
    email: "text-on-surface-variant",
    classicFooter: true,
  },
  tonal: {
    bg: "bg-secondary-container",
    asideBorder: "",
    brandBox: "bg-surface-container-lowest text-primary",
    brandTitle: "text-on-secondary-container",
    brandAccent: "text-primary",
    brandSub: "text-on-secondary-container opacity-70",
    divider: "bg-t-glass-border",
    itemShape: "rounded-full",
    idle: "text-on-secondary-container opacity-70 hover:opacity-100",
    active: "text-primary",
    activeRowBg: "",
    iconActive: "text-primary",
    indicator: "pill",
    indicatorCls: "bg-surface-container-lowest shadow-elev-1",
    footerBorder: "border-t-glass-border",
    name: "text-on-secondary-container",
    email: "text-on-secondary-container opacity-70",
    classicFooter: false,
  },
  inverse: {
    bg: "bg-inverse-surface",
    asideBorder: "",
    brandBox: "bg-primary text-on-primary",
    brandTitle: "text-inverse-on-surface",
    brandAccent: "text-inverse-primary",
    brandSub: "text-inverse-on-surface opacity-60",
    divider: "bg-t-glass-border",
    itemShape: "rounded-full",
    idle: "text-inverse-on-surface opacity-65 hover:opacity-100",
    active: "text-primary",
    activeRowBg: "",
    iconActive: "text-primary",
    indicator: "pill",
    indicatorCls: "bg-surface shadow-elev-2",
    footerBorder: "border-t-glass-border",
    name: "text-inverse-on-surface",
    email: "text-inverse-on-surface opacity-60",
    classicFooter: false,
  },
  gradient: {
    bg: "t-gradient",
    asideBorder: "",
    brandBox: "bg-surface text-primary shadow-elev-1",
    brandTitle: "text-on-primary",
    brandAccent: "text-on-primary",
    brandSub: "text-on-primary opacity-75",
    divider: "bg-t-glass-border",
    itemShape: "rounded-full",
    idle: "text-on-primary opacity-75 hover:opacity-100",
    active: "text-primary",
    activeRowBg: "",
    iconActive: "text-primary",
    indicator: "pill",
    indicatorCls: "bg-surface shadow-elev-2",
    footerBorder: "border-t-glass-border",
    name: "text-on-primary",
    email: "text-on-primary opacity-75",
    classicFooter: false,
  },
  minimal: {
    bg: "bg-transparent",
    asideBorder: "",
    brandBox: "bg-primary text-on-primary",
    brandTitle: "text-on-surface",
    brandAccent: "text-primary",
    brandSub: "text-on-surface-variant",
    divider: "bg-outline-variant",
    itemShape: "rounded-full",
    idle: "text-on-surface-variant hover:text-on-surface",
    active: "text-primary",
    activeRowBg: "",
    iconActive: "text-primary",
    indicator: "dot",
    indicatorCls: "bg-primary",
    footerBorder: "border-transparent",
    name: "text-on-surface",
    email: "text-on-surface-variant",
    classicFooter: false,
  },
};

/** Maps any App_shell_navigation value to its side recipe (top shells and
 *  rail/floating fall back to 'sidebar'). */
export function resolveSideStyle(shell: string): SideStyle {
  return SIDE_STYLES[(shell as SideVariant)] || SIDE_STYLES.sidebar;
}
