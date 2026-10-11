export type EventType = "fake_virus_popup" | "remote_access_site" | "tamper" | "setup_test";
export type Result = "pending" | "scam_stopped" | "false_alarm";

export interface AlertRecord {
  id: string;
  ts: string;
  event_type: EventType;
  url?: string;
  page_title?: string;
  parent_name: string;
  child_name: string;
  risk: string;
  summary: string;
  ai_used: boolean;
  telegram_sent: boolean;
  result: Result;
}

interface Store {
  alerts: AlertRecord[];
}

const g = globalThis as unknown as { __holdonStore?: Store };
const store: Store = (g.__holdonStore ??= { alerts: [] });

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function addAlert(a: AlertRecord) {
  store.alerts.push(a);
}

export function resetStore() {
  store.alerts.length = 0;
}

export function resolveAlert(id: string, result: Exclude<Result, "pending">): boolean {
  const a = store.alerts.find((x) => x.id === id);
  if (!a) return false;
  a.result = result;
  return true;
}

export function getStats() {
  // setup_test pings are not real alerts
  const real = store.alerts.filter((a) => a.event_type !== "setup_test");
  return {
    alerts: real.length,
    scams_stopped: real.filter((a) => a.result === "scam_stopped").length,
    false_alarms: real.filter((a) => a.result === "false_alarm").length,
    recent: real.slice(-20).reverse(),
  };
}
