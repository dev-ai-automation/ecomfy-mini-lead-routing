"use client";

import React, { useEffect, useState, useTransition } from "react";

import { getLeadDetail, resetDemo, returnLead, seedLeads, submitLead } from "../actions";
import {
  Badge,
  Button,
  BuyersProvider,
  Icon,
  Kpi,
  Spinner,
  StatusBadge,
  Switch,
  Th,
  ToastProvider,
  WebhookBadge,
  fmtDateTime,
  fmtMoney,
  fmtTime,
  severityMeta,
  titleCase,
  useBuyerName,
  useSort,
  useToast,
} from "./ui";

/* Real backend domains — keep submitted leads routable against the seeded buyers. */
const STATES = ["FL", "TX", "CA", "NY", "GA", "WA"];
const VERTICALS = ["life_insurance", "auto_insurance", "health_insurance", "final_expense"];
const SOURCES = ["web_form", "landing_page", "referral"];
const RETURN_REASONS = ["wrong_number", "duplicate", "not_interested", "out_of_area", "invalid_data"];

function freshContact() {
  const n = Date.now().toString();
  return { phone: "30555" + n.slice(-5), email: `lead.${n.slice(-8)}@example.com` };
}
const sumLatency = (attempts: any[]) => (attempts || []).reduce((s, a) => s + (a.latency_ms || 0), 0);

/* ============================================================ Shell */
const NAV = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "leads", label: "Leads", icon: "users" },
  { id: "buyers", label: "Buyers", icon: "building" },
  { id: "ledger", label: "Ledger", icon: "receipt" },
  { id: "alerts", label: "Alerts", icon: "bell" },
];

function Sidebar({ view, setView, counts }: any) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="gitBranch" size={15} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">Ecomfy</div>
          <div className="brand-sub">Lead Routing Engine</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-label">Operations</div>
        {NAV.map((n) => (
          <div key={n.id} className={"nav-item" + (view === n.id ? " active" : "")} onClick={() => setView(n.id)} title={n.label}>
            <Icon name={n.icon} size={17} />
            <span className="nav-item-label">{n.label}</span>
            {counts[n.id] != null && <span className="nav-count">{counts[n.id]}</span>}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">OP</div>
          <div style={{ minWidth: 0 }} className="nav-item-label">
            <div style={{ fontSize: 13, fontWeight: 500 }}>Ops Console</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Routing live</div>
          </div>
          <span className="sev-dot sev-info" style={{ marginLeft: "auto" }} />
        </div>
      </div>
    </aside>
  );
}

const VIEW_TITLE: Record<string, string> = { overview: "Overview", leads: "Leads", buyers: "Buyers", ledger: "Ledger", alerts: "Alerts" };

function Topbar({ view, setCollapsed, density, setDensity, aiOn, setAiOn, onSeed, onReset, busy }: any) {
  return (
    <header className="topbar">
      <Button variant="ghost" size="sm" icon="panelLeft" onClick={() => setCollapsed((c: boolean) => !c)} title="Toggle sidebar" />
      <div className="crumbs">
        <span className="crumb-muted">Routing</span>
        <Icon className="crumb-sep" name="chevronRight" size={14} />
        <span style={{ fontWeight: 500 }}>{VIEW_TITLE[view]}</span>
      </div>
      <div className="topbar-spacer" />
      {view === "overview" && (
        <label className="row" style={{ gap: 8, cursor: "pointer", userSelect: "none" }} title="Toggle AI summary">
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>AI summary</span>
          <Switch on={aiOn} onChange={() => setAiOn((v: boolean) => !v)} />
        </label>
      )}
      <div className="segment" title="Row density">
        <button className={density === "comfortable" ? "on" : ""} onClick={() => setDensity("comfortable")}>Comfortable</button>
        <button className={density === "compact" ? "on" : ""} onClick={() => setDensity("compact")}>Compact</button>
      </div>
      <Button variant="outline" size="sm" icon="refresh" onClick={onSeed} disabled={busy}>Seed</Button>
      <Button variant="destructive" size="sm" icon="rotate" onClick={onReset} disabled={busy}>Reset</Button>
    </header>
  );
}

/* ============================================================ Overview */
function StatusDonut({ summary }: any) {
  const segs = [
    { key: "sold", label: "Sold", value: summary.sold_leads, color: "var(--status-sold)" },
    { key: "unsold", label: "Unsold", value: summary.unsold_leads, color: "var(--status-unsold)" },
    { key: "rejected", label: "Rejected", value: summary.rejected_leads, color: "var(--status-rejected)" },
    { key: "returned", label: "Returned", value: summary.returned_leads, color: "var(--status-returned)" },
    { key: "pending", label: "Pending", value: summary.pending_leads, color: "var(--status-pending)" },
  ].filter((s) => s.value > 0);
  const total = summary.total_leads_received || 1;
  const R = 52,
    C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="row" style={{ gap: 24, alignItems: "center" }}>
      <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
        <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="66" cy="66" r={R} fill="none" stroke="var(--muted)" strokeWidth="14" />
          {segs.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle key={s.key} cx="66" cy="66" r={R} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>{summary.total_leads_received}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>Leads</div>
          </div>
        </div>
      </div>
      <div className="legend" style={{ flex: 1 }}>
        {segs.map((s) => (
          <div className="legend-item" key={s.key}>
            <span className="legend-sw" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="legend-val">{s.value} · {Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
        {segs.length === 0 && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No leads yet — submit or seed.</div>}
      </div>
    </div>
  );
}

function AiSummaryCard({ ai }: any) {
  const [tab, setTab] = useState("summary");
  if (!ai) return null;
  return (
    <div className="card" style={{ borderColor: "oklch(0.62 0.19 264 / 38%)" }}>
      <div className="card-head">
        <span style={{ color: "var(--primary)", display: "inline-flex" }}>
          <Icon name="sparkles" size={18} />
        </span>
        <div className="section-title">AI summary</div>
        <div className="card-head-actions">
          <Badge tone="primary">Generated</Badge>
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div className="tabs">
          {[["summary", "Summary"], ["problems", "Problems"], ["actions", "Recommended actions"]].map(([k, l]) => (
            <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
              {l}
              {k !== "summary" && (
                <span style={{ marginLeft: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint-foreground)" }}>
                  {k === "problems" ? (ai.problems || []).length : (ai.recommended_actions || []).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="card-pad" style={{ paddingTop: 16 }}>
        {tab === "summary" && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>{ai.summary}</p>}
        {tab === "problems" && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {(ai.problems || []).map((p: string, i: number) => (
              <li key={i} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: "var(--sev-warning)", marginTop: 1, flexShrink: 0 }}>
                  <Icon name="triangle" size={15} />
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>{p}</span>
              </li>
            ))}
          </ul>
        )}
        {tab === "actions" && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {(ai.recommended_actions || []).map((p: string, i: number) => (
              <li key={i} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: "var(--primary)", marginTop: 1, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>{p}</span>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--faint-foreground)", fontFamily: "var(--font-mono)" }}>
          generated_by: {ai.generated_by}
        </div>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts, onViewAll }: any) {
  return (
    <div className="card">
      <div className="card-head">
        <span style={{ display: "inline-flex", color: "var(--muted-foreground)" }}>
          <Icon name="bell" size={17} />
        </span>
        <div className="section-title">Alerts</div>
        <div className="card-head-actions">
          <Badge tone="rejected" dot>{alerts.filter((a: any) => a.severity === "critical").length} critical</Badge>
          <Button variant="ghost" size="sm" iconRight="arrowRight" onClick={onViewAll}>View all</Button>
        </div>
      </div>
      <div>
        {alerts.slice(0, 5).map((a: any) => {
          const m = severityMeta(a.severity);
          return (
            <div className="alert-item" key={a.id}>
              <span className={"sev-dot " + m.dot} style={{ marginTop: 5 }} />
              <div className="alert-body">
                <div className="alert-msg">{a.message}</div>
                <div className="alert-action">
                  <Icon name="arrowRight" size={12} />
                  {a.suggested_action}
                </div>
              </div>
              <span className="alert-time">{fmtTime(a.created_at)}</span>
            </div>
          );
        })}
        {alerts.length === 0 && <div className="empty" style={{ padding: 28 }}><Icon name="bell" size={24} />No alerts yet.</div>}
      </div>
    </div>
  );
}

function Watchlists({ summary, buyers }: any) {
  const byId = new Map(buyers.map((b: any) => [b.buyer_id, b]));
  const maxRej = Math.max(...summary.top_rejection_reasons.map((r: any) => r.count), 1);
  const tb = summary.top_buyer_by_spend && byId.get(summary.top_buyer_by_spend.buyer_id);
  return (
    <div className="grid-3">
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Low balance buyers</div>
        {summary.buyers_low_balance.length === 0 && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>All buyers funded.</div>}
        {summary.buyers_low_balance.map((b: any) => (
          <div className="mini-row" key={b.buyer_id}>
            <span className="sev-dot sev-critical" />
            <span className="grow cell-strong">{(byId.get(b.buyer_id) as any)?.buyer_name || b.buyer_id}</span>
            <span className="money money-neg">{fmtMoney(b.balance)}</span>
          </div>
        ))}
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Top buyer by spend</div>
        {tb ? (
          <div>
            <div className="row" style={{ gap: 10, marginBottom: 6 }}>
              <span className="avatar" style={{ background: "var(--primary-soft)", color: "oklch(0.8 0.13 264)" }}>{tb.buyer_name.slice(0, 2).toUpperCase()}</span>
              <span className="cell-strong">{tb.buyer_name}</span>
            </div>
            <div className="tnum" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", fontFamily: "var(--font-mono)" }}>{fmtMoney(summary.top_buyer_by_spend.spend)}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>spend today · {tb.leads_received_today} leads</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No sales yet.</div>
        )}
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Top rejection reasons</div>
        {summary.top_rejection_reasons.slice(0, 4).map((r: any) => (
          <div className="hbar-row" key={r.reason}>
            <div className="hbar-top">
              <span>{titleCase(r.reason)}</span>
              <span className="c">{r.count}</span>
            </div>
            <div className="hbar-track"><i style={{ width: `${(r.count / maxRej) * 100}%` }} /></div>
          </div>
        ))}
        {summary.top_rejection_reasons.length === 0 && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No rejections today.</div>}
      </div>
    </div>
  );
}

function OverviewView({ summary, ai, alerts, aiOn, buyers, setView }: any) {
  const sellThrough = summary.total_leads_received ? Math.round((summary.sold_leads / summary.total_leads_received) * 100) : 0;
  return (
    <div className="stack">
      <div className="kpi-grid">
        <Kpi icon="inbox" label="Leads received" value={summary.total_leads_received} sub="today" />
        <Kpi icon="circleCheck" label="Sold" value={summary.sold_leads} sub={`${sellThrough}% sell-through`} subTone="up" />
        <Kpi icon="dollar" label="Net revenue" value={fmtMoney(summary.net_revenue)} sub={`${fmtMoney(summary.gross_revenue)} gross · ${fmtMoney(summary.refunds)} refunds`} accent />
        <Kpi icon="zap" label="Avg latency" value={summary.average_routing_latency_ms} unit="ms" sub="routing time" />
        <Kpi icon="ban" label="Rejected" value={summary.rejected_leads} sub={`${summary.unsold_leads} unsold · ${summary.returned_leads} returned`} />
      </div>
      <div className="grid-2">
        <div className="stack">
          {aiOn ? (
            <AiSummaryCard ai={ai} />
          ) : (
            <div className="card card-pad">
              <div className="empty" style={{ padding: "28px 20px" }}>
                <Icon name="sparkles" size={26} />
                <div style={{ fontSize: 13 }}>AI summary is off. Enable it from the topbar toggle.</div>
              </div>
            </div>
          )}
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 16 }}>Lead status breakdown</div>
            <StatusDonut summary={summary} />
          </div>
        </div>
        <AlertsPanel alerts={alerts} onViewAll={() => setView("alerts")} />
      </div>
      <Watchlists summary={summary} buyers={buyers} />
    </div>
  );
}

/* ============================================================ Leads */
function SubmitLeadForm({ onResult }: any) {
  const toast = useToast();
  const buyerName = useBuyerName();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    first_name: "Maria",
    last_name: "Gonzalez",
    phone: "",
    email: "",
    state: "FL",
    vertical: "life_insurance",
    source: "web_form",
    trusted_form_cert_url: "https://cert.trustedform.com/demo",
  });
  // Unique phone/email generated client-side (avoids SSR hydration mismatch + dedup collisions).
  useEffect(() => setForm((f) => ({ ...f, ...freshContact() })), []);
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: any) => {
    e.preventDefault();
    start(async () => {
      const { result, detail } = await submitLead(form);
      const buyer = result.assigned_buyer_id ? buyerName(result.assigned_buyer_id) : "";
      if (result.status === "sold")
        toast({ tone: "success", title: `Lead sold to ${buyer}`, sub: `${result.lead_id} · ${fmtMoney(result.sold_price)}` });
      else if (result.status === "rejected")
        toast({ tone: "error", title: "Lead rejected", sub: `${result.lead_id} · ${result.rejection_reason}` });
      else toast({ tone: "warning", title: "Lead unsold", sub: `${result.lead_id} · all buyers declined` });
      onResult(detail, result);
      setForm((f) => ({ ...f, ...freshContact() })); // keep next submit unique (dedup-safe)
    });
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head">
        <span style={{ display: "inline-flex", color: "var(--primary)" }}><Icon name="plus" size={17} /></span>
        <div className="section-title">Submit lead</div>
      </div>
      <div className="card-pad stack" style={{ gap: 14 }}>
        <div className="field-row">
          <div className="field"><label className="label">First name</label><input className="input" value={form.first_name} onChange={set("first_name")} /></div>
          <div className="field"><label className="label">Last name</label><input className="input" value={form.last_name} onChange={set("last_name")} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label className="label">Phone</label><input className="input" value={form.phone} onChange={set("phone")} /></div>
          <div className="field"><label className="label">Email</label><input className="input" value={form.email} onChange={set("email")} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label">State</label>
            <select className="select" value={form.state} onChange={set("state")}>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="field">
            <label className="label">Vertical</label>
            <select className="select" value={form.vertical} onChange={set("vertical")}>{VERTICALS.map((v) => <option key={v} value={v}>{titleCase(v)}</option>)}</select>
          </div>
        </div>
        <div className="field">
          <label className="label">Source</label>
          <select className="select" value={form.source} onChange={set("source")}>{SOURCES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
        </div>
        <div className="field">
          <label className="label">TrustedForm cert URL</label>
          <input className="input" value={form.trusted_form_cert_url} onChange={set("trusted_form_cert_url")} />
        </div>
        <Button variant="primary" type="submit" icon={pending ? undefined : "gitBranch"} disabled={pending} style={{ width: "100%", height: 38 }}>
          {pending ? <Spinner /> : "Route lead"}
        </Button>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--faint-foreground)", lineHeight: 1.5 }}>
          Posts to <span className="mono">POST /leads</span> · returns the routing trace (evaluations + ping-tree attempts).
        </p>
      </div>
    </form>
  );
}

function LeadsTable({ leads, dense, onOpen, selectedId, query }: any) {
  const buyerName = useBuyerName();
  const { sort, toggle, sorted } = useSort("created_at", "desc");
  const filtered = leads.filter((l: any) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [l.lead_id, l.first_name, l.last_name, l.state, l.vertical, l.source, l.status, l.assigned_buyer_id].join(" ").toLowerCase().includes(q);
  });
  const rows = sorted(filtered, {
    name: (l: any) => `${l.first_name} ${l.last_name}`,
    created_at: (l: any) => new Date(l.created_at).getTime(),
    sold_price: (l: any) => Number(l.sold_price) || 0,
  });
  return (
    <div className="table-wrap">
      <table className={"tbl" + (dense ? " dense" : "")}>
        <thead>
          <tr>
            <Th label="Lead ID" sortKey="lead_id" sort={sort} toggle={toggle} />
            <Th label="Name" sortKey="name" sort={sort} toggle={toggle} />
            <Th label="State" sortKey="state" sort={sort} toggle={toggle} />
            <Th label="Vertical" sortKey="vertical" sort={sort} toggle={toggle} />
            <Th label="Source" sortKey="source" sort={sort} toggle={toggle} />
            <Th label="Status" sortKey="status" sort={sort} toggle={toggle} />
            <Th label="Buyer" sortKey="assigned_buyer_id" sort={sort} toggle={toggle} />
            <Th label="Price" sortKey="sold_price" sort={sort} toggle={toggle} num />
            <Th label="Time" sortKey="created_at" sort={sort} toggle={toggle} num />
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l: any) => (
            <tr key={l.lead_id} className={"clickable" + (selectedId === l.lead_id ? " row-selected" : "")} onClick={() => onOpen(l)}>
              <td className="cell-id">{l.lead_id}</td>
              <td className="cell-strong">{l.first_name} {l.last_name}</td>
              <td><span className="chip">{l.state}</span></td>
              <td className="cell-muted">{titleCase(l.vertical)}</td>
              <td className="cell-muted">{titleCase(l.source)}</td>
              <td><StatusBadge status={l.status} /></td>
              <td className="cell-muted">{l.assigned_buyer_id ? buyerName(l.assigned_buyer_id) : "—"}</td>
              <td className="num money">{l.sold_price ? fmtMoney(l.sold_price) : <span className="cell-muted">—</span>}</td>
              <td className="num cell-muted mono" style={{ fontSize: 12 }}>{fmtTime(l.created_at)}</td>
              <td><Icon name="chevronRight" size={15} className="cell-muted" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty"><Icon name="search" size={26} />No leads match “{query}”.</div>}
    </div>
  );
}

function LeadsView({ leads, dense, onOpen, selectedId }: any) {
  const [query, setQuery] = useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }} className="leads-layout">
      <SubmitLeadForm onResult={onOpen ? (detail: any) => onOpen(detail?.lead, detail) : undefined} />
      <div className="card">
        <div className="card-head">
          <div className="section-title">Leads</div>
          <span className="cell-muted" style={{ fontSize: 12.5 }}>{leads.length} total</span>
          <div className="card-head-actions">
            <div className="search-box" style={{ width: 220 }}>
              <Icon name="search" size={15} />
              <input className="input" placeholder="Search leads…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <LeadsTable leads={leads} dense={dense} onOpen={(l: any) => onOpen(l)} selectedId={selectedId} query={query} />
      </div>
    </div>
  );
}

/* ============================================================ Buyers */
function CapMeter({ used, cap }: any) {
  const pct = Math.min(100, (used / (cap || 1)) * 100);
  const cls = pct >= 100 ? "meter full" : pct >= 80 ? "meter warn" : "meter";
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className={cls}><i style={{ width: pct + "%" }} /></span>
      <span className="mono cell-muted" style={{ fontSize: 12 }}>{used}/{cap}</span>
    </span>
  );
}

function BuyersView({ buyers, dense }: any) {
  const [query, setQuery] = useState("");
  const { sort, toggle, sorted } = useSort("priority", "asc");
  const filtered = buyers.filter(
    (b: any) => !query || `${b.buyer_name} ${b.buyer_id} ${b.allowed_verticals.join(" ")} ${b.allowed_states.join(" ")}`.toLowerCase().includes(query.toLowerCase())
  );
  const rows = sorted(filtered, { leads: (b: any) => b.leads_received_today });
  return (
    <div className="card">
      <div className="card-head">
        <div className="section-title">Buyers</div>
        <span className="cell-muted" style={{ fontSize: 12.5 }}>{buyers.filter((b: any) => b.status === "active").length} active · {buyers.length} total</span>
        <div className="card-head-actions">
          <div className="search-box" style={{ width: 220 }}>
            <Icon name="search" size={15} />
            <input className="input" placeholder="Search buyers…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className={"tbl" + (dense ? " dense" : "")}>
          <thead>
            <tr>
              <Th label="Buyer" sortKey="buyer_name" sort={sort} toggle={toggle} />
              <Th label="Status" sortKey="status" sort={sort} toggle={toggle} />
              <Th label="Balance" sortKey="balance" sort={sort} toggle={toggle} num />
              <Th label="Today / cap" sortKey="leads" sort={sort} toggle={toggle} />
              <Th label="Price" sortKey="price_per_lead" sort={sort} toggle={toggle} num />
              <Th label="Prio" sortKey="priority" sort={sort} toggle={toggle} num />
              <Th label="Targeting" sort={sort} toggle={toggle} />
              <Th label="Webhook" sortKey="webhook_behavior" sort={sort} toggle={toggle} />
              <Th label="Campaign" sortKey="campaign_active" sort={sort} toggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {rows.map((b: any) => {
              const low = Number(b.balance) < Number(b.price_per_lead) * 5;
              return (
                <tr key={b.buyer_id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="avatar" style={{ background: "var(--muted)", fontSize: 10 }}>{b.buyer_name.slice(0, 2).toUpperCase()}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-strong">{b.buyer_name}</div>
                        <div className="cell-id">{b.buyer_id}</div>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={b.status === "active" ? "active" : "paused"} dot>{titleCase(b.status)}</Badge></td>
                  <td className={"num money" + (low ? " money-neg" : "")}>{fmtMoney(b.balance)}</td>
                  <td><CapMeter used={b.leads_received_today} cap={b.daily_cap} /></td>
                  <td className="num money">{fmtMoney(b.price_per_lead)}</td>
                  <td className="num mono cell-muted">P{b.priority}</td>
                  <td>
                    <div className="chips">
                      {b.allowed_verticals.map((v: string) => (
                        <span className="chip" key={v} style={{ color: "oklch(0.78 0.13 264)", background: "var(--primary-soft)" }}>{titleCase(v)}</span>
                      ))}
                      <span className="chip" title={b.allowed_states.join(", ")}>{b.allowed_states.length} states</span>
                    </div>
                  </td>
                  <td><WebhookBadge behavior={b.webhook_behavior} /></td>
                  <td>{b.campaign_active ? <Badge tone="active" dot>Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================ Ledger */
function LedgerView({ ledger, dense }: any) {
  const buyerName = useBuyerName();
  const [type, setType] = useState("all");
  const { sort, toggle, sorted } = useSort("created_at", "desc");
  const isSale = (e: any) => e.type === "debit";
  const filtered = ledger.filter((e: any) => type === "all" || (type === "sale" ? isSale(e) : e.type === "refund"));
  const rows = sorted(filtered, { created_at: (e: any) => new Date(e.created_at).getTime() });
  const saleTotal = ledger.filter(isSale).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const refundTotal = ledger.filter((e: any) => e.type === "refund").reduce((s: number, e: any) => s + Number(e.amount), 0);
  return (
    <div className="stack">
      <div className="kpi-grid">
        <Kpi icon="receipt" label="Entries" value={ledger.length} sub="today" />
        <Kpi icon="trendingUp" label="Sale debits" value={fmtMoney(saleTotal)} sub={`${ledger.filter(isSale).length} sales`} subTone="up" />
        <Kpi icon="trendingDown" label="Refund credits" value={fmtMoney(refundTotal)} sub={`${ledger.filter((e: any) => e.type === "refund").length} returns`} subTone="down" />
        <Kpi icon="dollar" label="Net to platform" value={fmtMoney(saleTotal - refundTotal)} accent />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="section-title">Ledger</div>
          <span className="cell-muted" style={{ fontSize: 12.5 }}>buyer balance movements</span>
          <div className="card-head-actions">
            <div className="segment">
              {[["all", "All"], ["sale", "Sales"], ["refund", "Refunds"]].map(([k, l]) => (
                <button key={k} className={type === k ? "on" : ""} onClick={() => setType(k)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className={"tbl" + (dense ? " dense" : "")}>
            <thead>
              <tr>
                <Th label="Time" sortKey="created_at" sort={sort} toggle={toggle} />
                <Th label="Type" sortKey="type" sort={sort} toggle={toggle} />
                <Th label="Lead" sortKey="lead_id" sort={sort} toggle={toggle} />
                <Th label="Buyer" sortKey="buyer_id" sort={sort} toggle={toggle} />
                <Th label="Note" sort={sort} toggle={toggle} />
                <Th label="Amount" sortKey="amount" sort={sort} toggle={toggle} num />
                <Th label="Balance after" sortKey="balance_after" sort={sort} toggle={toggle} num />
              </tr>
            </thead>
            <tbody>
              {rows.map((e: any) => {
                const sale = isSale(e);
                return (
                  <tr key={e.transaction_id}>
                    <td className="cell-muted mono" style={{ fontSize: 12 }}>{fmtDateTime(e.created_at)}</td>
                    <td><Badge tone={sale ? "primary" : "returned"} dot>{sale ? "Sale" : "Refund"}</Badge></td>
                    <td className="cell-id">{e.lead_id}</td>
                    <td className="cell-strong">{buyerName(e.buyer_id)}</td>
                    <td className="cell-muted">{e.notes}</td>
                    <td className={"num money " + (sale ? "money-pos" : "money-neg")}>{sale ? "+" : "−"}{fmtMoney(e.amount)}</td>
                    <td className="num money">{fmtMoney(e.balance_after)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty"><Icon name="receipt" size={26} />No {type} entries yet.</div>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ Alerts */
function AlertsView({ alerts, dense }: any) {
  const [sev, setSev] = useState("all");
  const filtered = alerts.filter((a: any) => sev === "all" || a.severity === sev);
  const counts = {
    critical: alerts.filter((a: any) => a.severity === "critical").length,
    warning: alerts.filter((a: any) => a.severity === "warning").length,
    info: alerts.filter((a: any) => a.severity === "info").length,
  };
  return (
    <div className="stack">
      <div className="kpi-grid">
        <Kpi icon="circleAlert" label="Critical" value={counts.critical} sub="needs action" />
        <Kpi icon="triangle" label="Warning" value={counts.warning} sub="monitor" />
        <Kpi icon="info" label="Info" value={counts.info} sub="fyi" />
        <Kpi icon="bell" label="Total alerts" value={alerts.length} sub="today" />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="section-title">Alerts</div>
          <div className="card-head-actions">
            <div className="segment">
              {[["all", "All"], ["critical", "Critical"], ["warning", "Warning"], ["info", "Info"]].map(([k, l]) => (
                <button key={k} className={sev === k ? "on" : ""} onClick={() => setSev(k)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className={"tbl" + (dense ? " dense" : "")}>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Type</th>
                <th>Entity</th>
                <th>Message</th>
                <th>Suggested action</th>
                <th className="num">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: any) => {
                const m = severityMeta(a.severity);
                return (
                  <tr key={a.id}>
                    <td><span className={"sev-dot " + m.dot} style={{ margin: "0 auto" }} /></td>
                    <td className="cell-strong">{titleCase(a.alert_type)}</td>
                    <td className="cell-id">{a.entity_id}</td>
                    <td style={{ whiteSpace: "normal", maxWidth: 360 }}>{a.message}</td>
                    <td className="cell-muted" style={{ whiteSpace: "normal", maxWidth: 240 }}>{a.suggested_action}</td>
                    <td className="num cell-muted mono" style={{ fontSize: 12 }}>{fmtDateTime(a.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><Icon name="bell" size={26} />No {sev} alerts.</div>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ Trace drawer */
const OUTCOME: Record<string, any> = {
  sold: { color: "var(--status-sold)", icon: "circleCheck", title: "Lead sold", bg: "oklch(0.72 0.17 152 / 7%)", border: "oklch(0.72 0.17 152 / 38%)" },
  rejected: { color: "var(--status-rejected)", icon: "ban", title: "Lead rejected", bg: "oklch(0.64 0.21 25 / 7%)", border: "oklch(0.64 0.21 25 / 38%)" },
  unsold: { color: "var(--status-unsold)", icon: "triangle", title: "Lead unsold", bg: "oklch(0.80 0.16 85 / 7%)", border: "oklch(0.80 0.16 85 / 38%)" },
  returned: { color: "var(--status-returned)", icon: "rotate", title: "Lead returned", bg: "oklch(0.70 0.16 255 / 7%)", border: "oklch(0.70 0.16 255 / 38%)" },
};

function TraceDrawer({ detail, open, loading, onClose, onReturn }: any) {
  const buyerName = useBuyerName();
  useEffect(() => {
    const onKey = (e: any) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lead = detail?.lead;
  const evaluations = detail?.evaluations || [];
  const attempts = detail?.attempts || [];
  const totalLatency = sumLatency(attempts);
  const m = (lead && OUTCOME[lead.status]) || OUTCOME.unsold;
  const eligibleCount = evaluations.filter((e: any) => e.eligible).length;
  const sortedEvals = [...evaluations].sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.priority - b.priority);

  return (
    <>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} />
      <div className={"drawer" + (open ? " open" : "")} role="dialog" aria-label="Routing trace">
        {loading || !lead ? (
          <div className="drawer-body"><div className="empty"><Spinner />{loading ? "Loading trace…" : "Select a lead."}</div></div>
        ) : (
          <>
            <div className="drawer-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{lead.lead_id}</span>
                  <StatusBadge status={lead.status} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 6 }}>{lead.first_name} {lead.last_name}</div>
              </div>
              <Button variant="ghost" size="sm" icon="x" onClick={onClose} title="Close (Esc)" />
            </div>
            <div className="drawer-body">
              <div className="trace-banner" style={{ borderColor: m.border, background: m.bg }}>
                <span style={{ color: m.color, display: "inline-flex" }}><Icon name={m.icon} size={24} /></span>
                <div style={{ flex: 1 }}>
                  <div className="big" style={{ color: m.color }}>{m.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
                    {lead.status === "sold" || lead.status === "returned"
                      ? <>Assigned to {buyerName(lead.assigned_buyer_id)} · {fmtMoney(lead.sold_price)}</>
                      : <>Reason: {titleCase(lead.rejection_reason || "—")}</>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono tnum" style={{ fontSize: 17, fontWeight: 600 }}>{totalLatency}<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>ms</span></div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>total latency</div>
                </div>
              </div>

              <dl className="kv" style={{ marginBottom: 22 }}>
                <dt>Contact</dt><dd>{lead.phone} · {lead.email}</dd>
                <dt>State / Vertical</dt><dd><span className="chip">{lead.state}</span> · {titleCase(lead.vertical)}</dd>
                <dt>Source</dt><dd>{titleCase(lead.source)}</dd>
                <dt>Created</dt><dd className="mono" style={{ fontSize: 12.5 }}>{fmtDateTime(lead.created_at)}</dd>
                {lead.return_reason && <><dt>Return reason</dt><dd>{titleCase(lead.return_reason)}</dd></>}
              </dl>

              <div className="trace-section-label"><Icon name="filter" size={13} /> Eligibility <span className="count">{eligibleCount}/{evaluations.length} eligible</span></div>
              <div style={{ marginBottom: 22 }}>
                {sortedEvals.map((ev: any) => (
                  <div className={"eval-row" + (ev.eligible ? " elig" : "")} key={ev.buyer_id}>
                    <span className={"ev-ic " + (ev.eligible ? "ok" : "no")}><Icon name={ev.eligible ? "circleCheck" : "x"} size={15} /></span>
                    <span className="ev-name">{buyerName(ev.buyer_id)}</span>
                    <span className="ev-prio">P{ev.priority}</span>
                    <span className="ev-reason">{ev.eligible ? "Eligible" : ev.reason_if_not_eligible}</span>
                  </div>
                ))}
              </div>

              <div className="trace-section-label"><Icon name="layers" size={13} /> Ping tree <span className="count">{attempts.length} attempt{attempts.length !== 1 ? "s" : ""}</span></div>
              {attempts.length === 0 && (
                <div className="empty" style={{ padding: 20, border: "1px dashed var(--border)", borderRadius: "var(--r-md)" }}>
                  <Icon name="ban" size={22} />
                  <div style={{ fontSize: 13 }}>No buyers eligible — lead never entered the ping tree.</div>
                </div>
              )}
              <div className="waterfall">
                {[...attempts].sort((a, b) => a.attempt_order - b.attempt_order).map((a: any) => (
                  <div className="attempt" key={a.attempt_order}>
                    <span className={"attempt-node " + (a.accepted ? "accept" : "fail")}>
                      {a.accepted ? <Icon name="check" size={10} style={{ color: "var(--status-sold)" }} /> : <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--faint-foreground)" }} />}
                    </span>
                    <div className={"attempt-card" + (a.accepted ? " accepted" : "")}>
                      <div className="attempt-row1">
                        <span className="mono" style={{ fontSize: 11, color: "var(--faint-foreground)" }}>#{a.attempt_order}</span>
                        <span className="attempt-name">{buyerName(a.buyer_id)}</span>
                        <span className="attempt-latency">{a.latency_ms} ms</span>
                      </div>
                      <div className="attempt-meta row" style={{ gap: 8 }}>
                        <Badge tone={a.accepted ? "accept" : a.status === "timeout" ? "timeout" : a.status === "error" ? "error" : "reject_duplicate"}>{titleCase(a.status)}</Badge>
                        {a.rejection_reason && <span>{titleCase(a.rejection_reason)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="drawer-foot">
              {lead.status === "sold" && <Button variant="destructive" icon="rotate" onClick={() => onReturn(lead)}>Return lead</Button>}
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ReturnDialog({ lead, onCancel, onConfirm, busy }: any) {
  const buyerName = useBuyerName();
  const [reason, setReason] = useState("wrong_number");
  if (!lead) return null;
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head" style={{ borderBottom: "1px solid var(--border)" }}>
          <span style={{ color: "var(--status-rejected)", display: "inline-flex" }}><Icon name="rotate" size={17} /></span>
          <div className="section-title">Return lead</div>
        </div>
        <div className="card-pad stack" style={{ gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
            Returning <span className="mono" style={{ color: "var(--foreground)" }}>{lead.lead_id}</span> credits {fmtMoney(lead.sold_price)} back to {buyerName(lead.assigned_buyer_id)}.
          </p>
          <div className="field">
            <label className="label">Return reason</label>
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {RETURN_REASONS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
            </select>
          </div>
        </div>
        <div className="drawer-foot" style={{ borderTop: "1px solid var(--border)" }}>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" icon="rotate" disabled={busy} onClick={() => onConfirm(lead, reason)}>{busy ? <Spinner /> : "Confirm return"}</Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ App root */
function App({ initial }: { initial: any }) {
  const { report, buyers, leads, alerts, ledger } = initial;
  const toast = useToast();
  const buyerName = useBuyerName();
  const [pending, start] = useTransition();

  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [aiOn, setAiOn] = useState(true);
  const [drawer, setDrawer] = useState<{ open: boolean; loading: boolean; detail: any }>({ open: false, loading: false, detail: null });
  const [returnTarget, setReturnTarget] = useState<any>(null);

  const dense = density === "compact";

  const openLead = async (lead: any, detail?: any) => {
    if (detail) {
      setDrawer({ open: true, loading: false, detail });
      return;
    }
    if (!lead) return;
    setDrawer({ open: true, loading: true, detail: null });
    try {
      const d = await getLeadDetail(lead.lead_id);
      setDrawer({ open: true, loading: false, detail: d });
    } catch {
      setDrawer({ open: true, loading: false, detail: { lead, evaluations: [], attempts: [] } });
    }
  };
  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }));

  const doReturn = (lead: any, reason: string) =>
    start(async () => {
      const res = await returnLead(lead.lead_id, reason);
      setReturnTarget(null);
      if (res && res.refund_amount != null) {
        toast({ tone: "info", title: "Refund issued", sub: `${fmtMoney(res.refund_amount)} to ${buyerName(res.assigned_buyer_id)}` });
        try {
          const d = await getLeadDetail(lead.lead_id);
          setDrawer({ open: true, loading: false, detail: d });
        } catch {
          /* keep drawer */
        }
      } else {
        toast({ tone: "error", title: "Return failed", sub: res?.detail || "Lead is not in a returnable state." });
      }
    });

  const onSeed = () =>
    start(async () => {
      const r = await seedLeads();
      toast({ tone: "success", title: `Seeded ${r?.ingested ?? ""} leads`, sub: "routing recomputed" });
    });
  const onReset = () =>
    start(async () => {
      await resetDemo();
      setDrawer({ open: false, loading: false, detail: null });
      toast({ tone: "warning", title: "Demo reset", sub: "fresh buyers · data cleared" });
    });

  const counts = { leads: leads.length, buyers: buyers.length, alerts: alerts.length };
  const selectedId = drawer.open && drawer.detail?.lead ? drawer.detail.lead.lead_id : null;

  return (
    <div className={"app" + (collapsed ? " collapsed" : "")}>
      <Sidebar view={view} setView={setView} counts={counts} />
      <div className="main">
        <Topbar view={view} setCollapsed={setCollapsed} density={density} setDensity={setDensity} aiOn={aiOn} setAiOn={setAiOn} onSeed={onSeed} onReset={onReset} busy={pending} />
        <div className="content">
          <div className="content-inner">
            {view === "overview" && <OverviewView summary={report} ai={report.ai_summary} alerts={alerts} aiOn={aiOn} buyers={buyers} setView={setView} />}
            {view === "leads" && <LeadsView leads={leads} dense={dense} onOpen={openLead} selectedId={selectedId} />}
            {view === "buyers" && <BuyersView buyers={buyers} dense={dense} />}
            {view === "ledger" && <LedgerView ledger={ledger} dense={dense} />}
            {view === "alerts" && <AlertsView alerts={alerts} dense={dense} />}
          </div>
        </div>
      </div>
      <TraceDrawer detail={drawer.detail} open={drawer.open} loading={drawer.loading} onClose={closeDrawer} onReturn={setReturnTarget} />
      <ReturnDialog lead={returnTarget} busy={pending} onCancel={() => setReturnTarget(null)} onConfirm={doReturn} />
    </div>
  );
}

export default function Dashboard({ initial }: { initial: any }) {
  return (
    <BuyersProvider buyers={initial.buyers || []}>
      <ToastProvider>
        <App initial={initial} />
      </ToastProvider>
    </BuyersProvider>
  );
}
