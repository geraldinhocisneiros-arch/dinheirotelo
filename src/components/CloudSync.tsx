import { useEffect, useRef, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { fetchRemote, pushRemote, generateSyncCode } from "@/lib/cloudSync";
import { Button, Input, Label } from "@/components/ui";
import {
  Cloud,
  CloudOff,
  Loader2,
  AlertTriangle,
  X,
  Copy,
  Check,
} from "lucide-react";

const STORAGE_KEY = "financas-sync-code";

function getSyncableState() {
  const s = useFinanceStore.getState();
  return {
    categories: s.categories,
    transactions: s.transactions,
    recurringTemplates: s.recurringTemplates,
    budgets: s.budgets,
    faturaPayments: s.faturaPayments,
  };
}

function applyRemoteState(data: Record<string, unknown> | null | undefined) {
  useFinanceStore.setState({
    categories: (data?.categories as never) ?? [],
    transactions: (data?.transactions as never) ?? [],
    recurringTemplates: (data?.recurringTemplates as never) ?? [],
    budgets: (data?.budgets as never) ?? [],
    faturaPayments: (data?.faturaPayments as never) ?? [],
  });
}

type Status = "local" | "syncing" | "synced" | "error";
type PanelMode = "menu" | "create" | "join" | "settings";

export function CloudSync() {
  const [code, setCode] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const [status, setStatus] = useState<Status>(code ? "syncing" : "local");
  const [showPanel, setShowPanel] = useState(!code);
  const [mode, setMode] = useState<PanelMode>("menu");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<{
    code: string;
    remoteData: Record<string, unknown>;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const skipNextPush = useRef(false);
  const pushTimer = useRef<number | null>(null);
  const readyRef = useRef(false);

  // Boot: se ja existe codigo salvo, tenta puxar (ou empurrar se ainda nao
  // existe na nuvem). Depois disso (com ou sem sync), libera os recorrentes
  // automaticos - assim eles rodam em cima do estado ja sincronizado.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (code) {
        setStatus("syncing");
        try {
          const remote = await fetchRemote(code);
          if (cancelled) return;
          if (remote) {
            skipNextPush.current = true;
            applyRemoteState(remote.data as Record<string, unknown>);
          } else {
            await pushRemote(code, getSyncableState());
          }
          setStatus("synced");
        } catch {
          if (!cancelled) setStatus("error");
        }
      }
      useFinanceStore.getState().autoLaunchRecurring();
      readyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Envia mudancas locais pra nuvem (com debounce), quando ha um codigo ativo.
  useEffect(() => {
    if (!code) return;
    const unsub = useFinanceStore.subscribe(() => {
      if (!readyRef.current) return;
      if (skipNextPush.current) {
        skipNextPush.current = false;
        return;
      }
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(async () => {
        setStatus("syncing");
        try {
          await pushRemote(code, getSyncableState());
          setStatus("synced");
        } catch {
          setStatus("error");
        }
      }, 1500);
    });
    return unsub;
  }, [code]);

  // Busca mudancas vindas de outro aparelho: periodicamente e ao voltar o foco.
  useEffect(() => {
    if (!code) return;
    async function pull() {
      try {
        const remote = await fetchRemote(code!);
        if (remote) {
          skipNextPush.current = true;
          applyRemoteState(remote.data as Record<string, unknown>);
        }
        setStatus("synced");
      } catch {
        setStatus("error");
      }
    }
    const interval = window.setInterval(pull, 10000);
    window.addEventListener("focus", pull);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", pull);
    };
  }, [code]);

  function openPanel() {
    setMode(code ? "settings" : "menu");
    setJoinInput("");
    setJoinError(null);
    setShowPanel(true);
  }

  function handleStartCreate() {
    setCreatedCode(generateSyncCode());
    setMode("create");
  }

  async function handleConfirmCreate() {
    if (!createdCode) return;
    localStorage.setItem(STORAGE_KEY, createdCode);
    setStatus("syncing");
    try {
      await pushRemote(createdCode, getSyncableState());
      setStatus("synced");
    } catch {
      setStatus("error");
    }
    setCode(createdCode);
    setShowPanel(false);
  }

  async function handleJoinSubmit() {
    const trimmed = joinInput.trim();
    if (!trimmed) return;
    setJoinError(null);
    setStatus("syncing");
    try {
      const remote = await fetchRemote(trimmed);
      if (!remote) {
        setJoinError(
          "Não encontrei esse código na nuvem. Confira se digitou certo.",
        );
        setStatus(code ? "synced" : "local");
        return;
      }
      const localHasData = useFinanceStore.getState().transactions.length > 0;
      if (localHasData) {
        setConfirmOverwrite({
          code: trimmed,
          remoteData: remote.data as Record<string, unknown>,
        });
      } else {
        finishJoin(trimmed, remote.data as Record<string, unknown>);
      }
    } catch {
      setJoinError("Não consegui conectar agora. Tente de novo.");
      setStatus(code ? "error" : "local");
    }
  }

  function finishJoin(newCode: string, remoteData: Record<string, unknown>) {
    localStorage.setItem(STORAGE_KEY, newCode);
    skipNextPush.current = true;
    applyRemoteState(remoteData);
    setCode(newCode);
    setStatus("synced");
    setShowPanel(false);
    setConfirmOverwrite(null);
  }

  function handleCopyCode(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleUnlink() {
    localStorage.removeItem(STORAGE_KEY);
    setCode(null);
    setStatus("local");
    setShowPanel(false);
  }

  return (
    <>
      <button
        onClick={openPanel}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium shadow-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
      >
        {status === "syncing" && <Loader2 size={14} className="animate-spin" />}
        {status === "synced" && <Cloud size={14} className="text-[var(--income)]" />}
        {status === "error" && <AlertTriangle size={14} className="text-[var(--expense)]" />}
        {status === "local" && <CloudOff size={14} className="text-[var(--text-muted)]" />}
        {status === "syncing" && "Sincronizando..."}
        {status === "synced" && "Sincronizado"}
        {status === "error" && "Erro de sincronização"}
        {status === "local" && "Não sincronizado"}
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Sincronização entre aparelhos</h2>
              <button onClick={() => setShowPanel(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            {mode === "menu" && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Cadastre um código de sincronização pra ver os mesmos dados
                  no celular e no computador.
                </p>
                <Button className="w-full" onClick={handleStartCreate}>
                  Criar código novo (primeiro aparelho)
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setMode("join")}
                >
                  Já tenho um código
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowPanel(false)}
                >
                  Usar só neste aparelho por agora
                </Button>
              </div>
            )}

            {mode === "create" && createdCode && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Guarde esse código — você vai digitá-lo no outro aparelho em
                  "Já tenho um código".
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm font-mono break-all">
                    {createdCode}
                  </code>
                  <button
                    onClick={() => handleCopyCode(createdCode)}
                    aria-label="Copiar código"
                    className="p-2 rounded-lg border border-[var(--border)]"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <Button className="w-full" onClick={handleConfirmCreate}>
                  Já guardei, continuar
                </Button>
              </div>
            )}

            {mode === "join" && (
              <div className="space-y-3">
                <div>
                  <Label>Código de sincronização</Label>
                  <Input
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Cole o código do outro aparelho"
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-[var(--expense)]">{joinError}</p>
                )}
                <Button className="w-full" onClick={handleJoinSubmit}>
                  Conectar
                </Button>
              </div>
            )}

            {mode === "settings" && code && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Este aparelho está sincronizado com o código:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm font-mono break-all">
                    {code}
                  </code>
                  <button
                    onClick={() => handleCopyCode(code)}
                    aria-label="Copiar código"
                    className="p-2 rounded-lg border border-[var(--border)]"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <Button variant="danger" className="w-full" onClick={handleUnlink}>
                  Desconectar este aparelho
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--surface)] border border-[var(--expense)] rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-[var(--expense)] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-medium mb-1">Substituir dados deste aparelho?</h2>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Este aparelho já tem lançamentos guardados. Conectar a esse
                  código vai substituí-los pelos dados da nuvem. Não dá pra
                  desfazer.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmOverwrite(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      finishJoin(confirmOverwrite.code, confirmOverwrite.remoteData)
                    }
                  >
                    Substituir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
