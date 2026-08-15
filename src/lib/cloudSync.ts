const SUPABASE_URL = "https://xkrurlzpyymczqpfnuop.supabase.co";
const SUPABASE_KEY = "sb_publishable_c7BvSUJ-sZ3Tz1H41p0Sbg_WcdkFulS";

export interface SyncRow {
  sync_code: string;
  data: unknown;
  updated_at: string;
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export async function fetchRemote(code: string): Promise<SyncRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/financas_sync?sync_code=eq.${encodeURIComponent(code)}&select=*`,
    { headers },
  );
  if (!res.ok) throw new Error(`Falha ao buscar dados (${res.status})`);
  const rows = (await res.json()) as SyncRow[];
  return rows[0] ?? null;
}

export async function pushRemote(code: string, data: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/financas_sync`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      sync_code: code,
      data,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar dados (${res.status})`);
}

export function generateSyncCode(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}
