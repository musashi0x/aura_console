import { apiClient } from "@/lib/api-client";

// The health status must reflect the current state on every request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await apiClient.dbHealth();

  return (
    <main>
      <h1>Aura Console</h1>
      <p className="subtitle">Monorepo scaffold — web, API, and Postgres.</p>

      <section className="card">
        {result.ok ? (
          <>
            <div className="status">
              <span className="dot dot--ok" />
              <span>Database healthy</span>
            </div>
            <p className="detail">
              <code>GET /health/db</code> round-tripped in {result.data.latencyMs} ms.
            </p>
          </>
        ) : (
          <>
            <div className="status">
              <span className="dot dot--bad" />
              <span>
                {result.error.code === "unreachable"
                  ? "API unreachable"
                  : "Database unhealthy"}
              </span>
            </div>
            <p className="detail">
              {result.error.code === "unreachable"
                ? "The API is not responding. Start it with pnpm dev."
                : "The API is up but cannot reach Postgres. Check docker compose and migrations."}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
