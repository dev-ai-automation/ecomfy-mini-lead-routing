import { apiGet, API_BASE } from "@/lib/api";
import { resetDemo, returnLead, seedLeads, submitLead } from "./actions";

export const dynamic = "force-dynamic";

function money(n: any): string {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="card metric">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ai?: string }>;
}) {
  const sp = await searchParams;
  const withAi = sp.ai === "1";

  let report: any;
  let buyers: any[] = [];
  let leads: any[] = [];
  let alerts: any[] = [];
  let connError = false;

  try {
    const reportPath = withAi
      ? "/reports/daily-summary?ai=true"
      : "/reports/daily-summary";
    [report, buyers, leads, alerts] = await Promise.all([
      apiGet(reportPath),
      apiGet("/buyers"),
      apiGet("/leads?limit=50"),
      apiGet("/alerts"),
    ]);
  } catch {
    connError = true;
  }

  return (
    <div className="container">
      <header className="top">
        <div>
          <h1>EcomfyApp · Mini Lead Routing Engine</h1>
          <div className="subtitle">
            Routing · ping tree · ledger · returns · alerts — API: <span className="mono">{API_BASE}</span>
          </div>
        </div>
        <div className="toolbar">
          <form action={seedLeads}>
            <button className="primary" type="submit">Seed 10 leads</button>
          </form>
          <form action={resetDemo}>
            <button className="danger" type="submit">Reset demo</button>
          </form>
          <a className="btn" href="/">Refresh</a>
        </div>
      </header>

      {connError && (
        <div className="banner">
          No pude conectar con el backend en <span className="mono">{API_BASE}</span>.
          Verificá que la API esté corriendo (uvicorn / docker compose) y que
          <span className="mono"> API_BASE_URL</span> apunte ahí.
        </div>
      )}

      {!connError && (
        <>
          <div className="grid cards">
            <Metric label="Total leads" value={report.total_leads_received} />
            <Metric label="Sold" value={report.sold_leads} />
            <Metric label="Rejected" value={report.rejected_leads} />
            <Metric label="Unsold" value={report.unsold_leads} />
            <Metric label="Returned" value={report.returned_leads} />
            <Metric label="Gross" value={money(report.gross_revenue)} />
            <Metric label="Refunds" value={money(report.refunds)} />
            <Metric label="Net revenue" value={money(report.net_revenue)} />
            <Metric label="Avg latency" value={`${report.average_routing_latency_ms} ms`} />
          </div>

          <div className="card section ai-box">
            <h2>AI executive summary</h2>
            {withAi && report.ai_summary ? (
              <div>
                <p>{report.ai_summary.summary}</p>
                {report.ai_summary.problems?.length > 0 && (
                  <>
                    <strong>Problems</strong>
                    <ul>
                      {report.ai_summary.problems.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                )}
                {report.ai_summary.recommended_actions?.length > 0 && (
                  <>
                    <strong>Recommended actions</strong>
                    <ul>
                      {report.ai_summary.recommended_actions.map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="muted mono">generated_by: {report.ai_summary.generated_by}</p>
              </div>
            ) : (
              <p className="muted">
                <a className="btn" href="/?ai=1">Generate AI summary</a>{" "}
                (requiere ANTHROPIC_API_KEY; degrada con gracia si no está).
              </p>
            )}
          </div>

          <div className="grid two-col section">
            <div className="card">
              <h2>Submit a lead</h2>
              <form className="lead-form" action={submitLead}>
                <div>
                  <label>First name</label>
                  <input name="first_name" defaultValue="Maria" />
                </div>
                <div>
                  <label>Last name</label>
                  <input name="last_name" defaultValue="Gonzalez" />
                </div>
                <div>
                  <label>Phone</label>
                  <input name="phone" defaultValue="3055551234" />
                </div>
                <div>
                  <label>Email</label>
                  <input name="email" defaultValue="maria@example.com" />
                </div>
                <div>
                  <label>State</label>
                  <select name="state" defaultValue="FL">
                    <option>FL</option>
                    <option>TX</option>
                    <option>CA</option>
                    <option>NY</option>
                    <option>GA</option>
                    <option>WA</option>
                  </select>
                </div>
                <div>
                  <label>Vertical</label>
                  <select name="vertical" defaultValue="life_insurance">
                    <option>life_insurance</option>
                    <option>auto_insurance</option>
                    <option>health_insurance</option>
                    <option>final_expense</option>
                  </select>
                </div>
                <div>
                  <label>Source</label>
                  <input name="source" defaultValue="web_form" />
                </div>
                <div>
                  <label>TrustedForm cert URL</label>
                  <input name="trusted_form_cert_url" defaultValue="https://cert.trustedform.com/demo" />
                </div>
                <div className="full">
                  <button className="primary" type="submit">POST /leads</button>
                </div>
              </form>
            </div>

            <div className="card">
              <h2>Buyers</h2>
              <table>
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Pri</th>
                    <th>Balance</th>
                    <th>Price</th>
                    <th>Cap</th>
                    <th>Behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b: any) => (
                    <tr key={b.buyer_id}>
                      <td>
                        {b.buyer_name}
                        <div className="muted mono">{b.buyer_id}</div>
                      </td>
                      <td>{b.priority}</td>
                      <td>{money(b.balance)}</td>
                      <td>{money(b.price_per_lead)}</td>
                      <td>
                        {b.leads_received_today}/{b.daily_cap}
                      </td>
                      <td className="mono">{b.webhook_behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card section">
            <h2>Leads ({leads.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>State / Vertical</th>
                  <th>Status</th>
                  <th>Buyer</th>
                  <th>Sold price</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l: any) => (
                  <tr key={l.lead_id}>
                    <td className="mono">{l.lead_id}</td>
                    <td>
                      {l.state} / {l.vertical}
                    </td>
                    <td>
                      <span className={`badge ${l.status}`}>{l.status}</span>
                    </td>
                    <td className="mono">{l.assigned_buyer_id || "—"}</td>
                    <td>{l.sold_price ? money(l.sold_price) : "—"}</td>
                    <td className="muted">{l.rejection_reason || l.return_reason || "—"}</td>
                    <td>
                      {l.status === "sold" ? (
                        <form className="return-form" action={returnLead}>
                          <input type="hidden" name="lead_id" value={l.lead_id} />
                          <input name="reason" placeholder="return reason" required />
                          <button type="submit">Return</button>
                        </form>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card section">
            <h2>Alerts ({alerts.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Suggested action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a: any) => (
                  <tr key={a.id}>
                    <td className={`sev-${a.severity}`}>{a.severity}</td>
                    <td className="mono">{a.alert_type}</td>
                    <td>{a.message}</td>
                    <td className="muted">{a.suggested_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
