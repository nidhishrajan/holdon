"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

interface AlertRow {
  id: string;
  ts: string;
  event_type: string;
  parent_name: string;
  child_name: string;
  summary: string;
  risk: string;
  ai_used: boolean;
  result: "pending" | "scam_stopped" | "false_alarm";
}
interface Stats {
  alerts: number;
  scams_stopped: number;
  false_alarms: number;
  recent: AlertRow[];
}

const EVENT_LABEL: Record<string, string> = {
  fake_virus_popup: "Fake virus popup",
  remote_access_site: "Remote-access site",
  tamper: "HoldOn removed",
};
const RESULT_LABEL = {
  pending: "Waiting for your answer",
  scam_stopped: "Scam stopped",
  false_alarm: "False alarm",
} as const;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        const data = await res.json();
        if (alive) {
          setStats(data);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const child = stats?.recent[0]?.child_name || "Sarah";
  const answered = stats ? stats.scams_stopped + stats.false_alarms : 0;
  const precision = stats && answered > 0 ? `${Math.round((stats.scams_stopped / answered) * 100)}%` : "—";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{child}&rsquo;s HoldOn dashboard</h1>
        <span className={error ? styles.offline : styles.live}>{error ? "Can’t reach server" : "Live"}</span>
      </header>

      <section className={styles.tiles}>
        <Tile label="Alerts" value={stats?.alerts ?? "—"} />
        <Tile label="Scams stopped" value={stats?.scams_stopped ?? "—"} tone="good" />
        <Tile label="False alarms" value={stats?.false_alarms ?? "—"} />
        <Tile label="Precision" value={precision} hint="of answered alerts were real scams" />
      </section>

      <section>
        <h2 className={styles.sub}>Recent alerts</h2>
        {stats && stats.recent.length === 0 && <p className={styles.empty}>No alerts yet. All quiet.</p>}
        <ul className={styles.list}>
          {stats?.recent.map((a) => (
            <li key={a.id} className={styles.row}>
              <div className={styles.meta}>
                <strong>{EVENT_LABEL[a.event_type] ?? a.event_type}</strong>
                <span>{new Date(a.ts).toLocaleTimeString()}</span>
                {a.ai_used && <span className={styles.chip}>AI summary</span>}
                <span className={`${styles.result} ${styles[a.result]}`}>{RESULT_LABEL[a.result]}</span>
              </div>
              <p>{a.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "good" }) {
  return (
    <div className={styles.tile}>
      <div className={`${styles.value} ${tone === "good" ? styles.good : ""}`}>{value}</div>
      <div className={styles.label}>{label}</div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
