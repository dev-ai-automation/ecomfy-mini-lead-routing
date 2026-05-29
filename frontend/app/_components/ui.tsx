"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

/* ---------- formatters (accept ISO strings or numbers) ---------- */
export const fmtMoney = (n: any): string => {
  const num = Number(n ?? 0);
  const v = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (num < 0 ? "-$" : "$") + v;
};
export const fmtInt = (n: any): string => Number(n ?? 0).toLocaleString("en-US");
const asDate = (d: any): Date => (d instanceof Date ? d : new Date(d));
export const fmtTime = (d: any): string =>
  asDate(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
export const fmtDateTime = (d: any): string =>
  asDate(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export const titleCase = (s: any): string =>
  String(s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function severityMeta(sev: string) {
  return (
    {
      critical: { dot: "sev-critical", icon: "circleAlert", color: "var(--sev-critical)" },
      warning: { dot: "sev-warning", icon: "triangle", color: "var(--sev-warning)" },
      info: { dot: "sev-info", icon: "info", color: "var(--sev-info)" },
    } as any
  )[sev] || { dot: "sev-info", icon: "info", color: "var(--sev-info)" };
}

/* ---------- buyer name lookup (from real /buyers) ---------- */
const BuyersCtx = createContext<(id: string) => string>((id) => id);
export function BuyersProvider({ buyers, children }: { buyers: any[]; children: React.ReactNode }) {
  const map = new Map(buyers.map((b) => [b.buyer_id, b]));
  const name = (id: string) => (id && map.get(id)?.buyer_name) || id || "—";
  return <BuyersCtx.Provider value={name}>{children}</BuyersCtx.Provider>;
}
export const useBuyerName = () => useContext(BuyersCtx);

/* ---------- icons (lucide path data, 24x24) ---------- */
const ICONS: Record<string, string> = {
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  triangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  circleAlert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  panelLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  gitBranch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  dollar: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  trendingUp: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  trendingDown: '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
};

export function Icon({ name, size = 16, className = "", style }: any) {
  return (
    <svg
      className={"ic " + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }}
    />
  );
}

export function Button({ variant = "outline", size, icon, iconRight, children, className = "", ...rest }: any) {
  const cls = ["btn", "btn-" + variant];
  if (size === "sm") cls.push("btn-sm");
  if (!children && icon) cls.push("btn-icon");
  if (className) cls.push(className);
  return (
    <button className={cls.join(" ")} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

export function Badge({ tone = "neutral", dot, children }: any) {
  return (
    <span className={"badge badge-" + tone}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  sold: "sold",
  rejected: "rejected",
  unsold: "unsold",
  returned: "returned",
  pending_distribution: "pending",
};
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] || "neutral";
  const label = titleCase(status === "pending_distribution" ? "pending" : status);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function WebhookBadge({ behavior }: { behavior: string }) {
  return <Badge tone={behavior}>{titleCase(behavior)}</Badge>;
}

export function Kpi({ icon, label, value, unit, sub, subTone, accent }: any) {
  return (
    <div
      className="kpi"
      style={accent ? { borderColor: "var(--primary)", background: "linear-gradient(0deg, var(--primary-soft), transparent)" } : undefined}
    >
      <div className="kpi-top">
        {icon && (
          <span className="kpi-ic" style={accent ? { color: "var(--primary)" } : undefined}>
            <Icon name={icon} size={16} />
          </span>
        )}
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className={"kpi-sub" + (subTone ? " delta-" + subTone : "")}>{sub}</div>}
    </div>
  );
}

export function Switch({ on, onChange }: any) {
  return (
    <button
      onClick={onChange}
      aria-pressed={on}
      style={{
        width: 34,
        height: 20,
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        padding: 2,
        background: on ? "var(--primary)" : "var(--muted)",
        transition: "background 150ms ease-out",
        display: "flex",
        alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: 99, background: "#fff", display: "block", transition: "all 150ms ease-out" }} />
    </button>
  );
}

export function Spinner() {
  return (
    <span
      style={{
        width: 15,
        height: 15,
        border: "2px solid oklch(1 0 0 / 35%)",
        borderTopColor: "#fff",
        borderRadius: 99,
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

/* ---------- sortable header ---------- */
export function useSort(initialKey: string, initialDir: "asc" | "desc" = "asc") {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });
  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const sorted = (rows: any[], accessors: Record<string, (r: any) => any> = {}) => {
    const acc = accessors[sort.key] || ((r: any) => r[sort.key]);
    return [...rows].sort((a, b) => {
      let va = acc(a),
        vb = acc(b);
      if (va == null) va = "";
      if (vb == null) vb = "";
      if (typeof va === "string" && typeof vb === "string")
        return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sort.dir === "asc" ? va - vb : vb - va;
    });
  };
  return { sort, toggle, sorted };
}

export function Th({ label, sortKey, sort, toggle, num }: any) {
  const active = sort && sort.key === sortKey;
  if (!sortKey)
    return (
      <th className={num ? "num" : ""}>
        <span className="th-inner">{label}</span>
      </th>
    );
  return (
    <th className={(num ? "num " : "") + "sortable"} onClick={() => toggle(sortKey)}>
      <span className={"th-inner" + (active ? " active" : "")}>
        {label}
        <Icon className="sort-ic" name={active ? (sort.dir === "asc" ? "arrowUp" : "arrowDown") : "sort"} size={13} />
      </span>
    </th>
  );
}

/* ---------- toasts ---------- */
type Toast = { id: string; tone?: string; title: string; sub?: string; duration?: number };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, ...t }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.duration || 3800);
  }, []);
  const toneColor: Record<string, string> = {
    success: "var(--status-sold)",
    error: "var(--status-rejected)",
    warning: "var(--status-unsold)",
    info: "var(--primary)",
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toaster">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span className="bar" style={{ background: toneColor[t.tone || "info"] || "var(--primary)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast-title">{t.title}</div>
              {t.sub && <div className="toast-sub">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
