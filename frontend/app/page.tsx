import { API_BASE, apiGet } from "@/lib/api";
import Dashboard from "./_components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const [report, buyers, leads, alerts, ledger] = await Promise.all([
      apiGet("/reports/daily-summary?ai=true"),
      apiGet("/buyers"),
      apiGet("/leads?limit=200"),
      apiGet("/alerts"),
      apiGet("/ledger?limit=200"),
    ]);
    return <Dashboard initial={{ report, buyers, leads, alerts, ledger }} />;
  } catch {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto", padding: 24 }}>
        <div className="banner">
          No pude conectar con el backend en <span className="mono">{API_BASE}</span>.
          Levantá la API (<span className="mono">docker compose up</span> o uvicorn) y verificá que
          <span className="mono"> API_BASE_URL</span> apunte ahí.
        </div>
      </div>
    );
  }
}
