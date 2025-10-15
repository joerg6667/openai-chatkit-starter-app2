"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Chat } from "@openai/chatkit";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_CHATKIT_PUBLIC_KEY!;
const WORKFLOW_ID = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID!;

type CreateSessionResponse = { client_secret: string | null; expires_after: string | null };

export default function Page() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Besuch-Audit (Client)
  useEffect(() => {
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "visit" }),
    }).catch(() => {});
  }, []);

  const createSession = useCallback(async (): Promise<CreateSessionResponse> => {
    const res = await fetch("/api/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatkit_configuration: { file_upload: { enabled: true } },
        workflowId: WORKFLOW_ID,
      }),
    });
    if (!res.ok) throw new Error(`Create session failed: ${res.status}`);
    return (await res.json()) as CreateSessionResponse;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await createSession();
        if (!mounted) return;
        if (!data.client_secret) throw new Error("No client_secret");
        setClientSecret(data.client_secret);
        setErrorMsg(null);
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [createSession]);

  const audit = useCallback(async (event: "message_sent" | "error", data?: Record<string, any>) => {
    try {
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, data }),
      });
    } catch {}
  }, []);

  const handleMessageSent = useCallback(
    async (msg: { text?: string }) => {
      await audit("message_sent", { length: msg?.text?.length ?? 0 });
    },
    [audit]
  );

  const disabled = useMemo(
    () => loading || !clientSecret || !PUBLIC_KEY || !WORKFLOW_ID,
    [loading, clientSecret]
  );

  return (
    <main className="min-h-dvh flex flex-col items-center justify-start p-6 gap-6">
      <header className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold">FM Leadership Coach (Beta)</h1>
        <p className="text-sm opacity-70">
          Testversion – keine personenbezogenen Daten eingeben.
        </p>
      </header>

      {errorMsg && (
        <div className="w-full max-w-3xl rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          <div className="font-medium">Fehler beim Initialisieren</div>
          <div className="text-sm mt-1">{errorMsg}</div>
        </div>
      )}

      {disabled ? (
        <div className="w-full max-w-3xl rounded-xl border p-6">
          <div className="text-sm">{loading ? "Initialisiere Sitzung…" : "Konfiguration unvollständig."}</div>
          {!PUBLIC_KEY && <div className="text-xs mt-2">Fehlt: NEXT_PUBLIC_CHATKIT_PUBLIC_KEY</div>}
          {!WORKFLOW_ID && <div className="text-xs">Fehlt: NEXT_PUBLIC_CHATKIT_WORKFLOW_ID</div>}
          {!clientSecret && !loading && <div className="text-xs">Kein client_secret von /api/create-session</div>}
        </div>
      ) : (
        <section className="w-full max-w-3xl">
          <Chat
            publicKey={PUBLIC_KEY}
            clientSecret={clientSecret}
            workflowId={WORKFLOW_ID}
            config={{ file_upload: { enabled: true } }}
            onMessageSent={(m: { text?: string }) => handleMessageSent(m)}
            onError={(err: unknown) => audit("error", { message: String(err) })}
          />
        </section>
      )}
    </main>
  );
}
