"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

/**
 * WICHTIG:
 * - Dieses Beispiel nutzt den React-Component `Chat` aus @openai/chatkit.
 * - Env-Vars:
 *    NEXT_PUBLIC_CHATKIT_PUBLIC_KEY   -> Public Key aus "Add Domain → Generate key"
 *    NEXT_PUBLIC_CHATKIT_WORKFLOW_ID  -> wf_… (dein Workflow/Agent)
 */
import { Chat } from "@openai/chatkit"; // falls dein Starter eine andere Pfad-Signatur nutzt, hier anpassen

const PUBLIC_KEY = process.env.NEXT_PUBLIC_CHATKIT_PUBLIC_KEY!;
const WORKFLOW_ID = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID!;

type CreateSessionResponse = {
  client_secret: string | null;
  expires_after: string | null;
};

export default function Page() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * 1) Besuch-Audit auf der Startseite (einmalig)
   */
  useEffect(() => {
    void fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "visit" }),
    }).catch(() => {});
  }, []);

  /**
   * 2) Session vom Server anfordern
   *    - Dein Server triggert bereits "session_created" (wir haben route.ts erweitert)
   */
  const createSession = useCallback(async (): Promise<CreateSessionResponse> => {
    const res = await fetch("/api/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Optional: File-Upload hier aktivieren/deaktivieren
      body: JSON.stringify({
        chatkit_configuration: { file_upload: { enabled: true } },
        workflowId: WORKFLOW_ID,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Create session failed: ${res.status} ${txt}`);
    }
    return (await res.json()) as CreateSessionResponse;
  }, []);

  /**
   * 3) Init – Session holen
   */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await createSession();
        if (!mounted) return;
        if (!data.client_secret) {
          throw new Error("No client_secret returned from /api/create-session");
        }
        setClientSecret(data.client_secret);
        setErrorMsg(null);
      } catch (e: any) {
        console.error(e);
        if (mounted) setErrorMsg(e?.message ?? "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [createSession]);

  /**
   * 4) Message-Audit Helper
   */
  const audit = useCallback(async (event: "message_sent" | "error", data?: Record<string, any>) => {
    try {
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, data }),
      });
    } catch {
      /* nie blockieren */
    }
  }, []);

  /**
   * 5) ChatKit-Event-Handler (Client)
   *    - Viele Starter-Templates geben Callbacks wie onMessageSent o.ä. frei.
   *    - Falls dein `Chat` andere Props nutzt, hänge `audit("message_sent")` an deine Send-Logik.
   */
  const handleMessageSent = useCallback(async (payload: { text?: string; length?: number }) => {
    await audit("message_sent", {
      length: typeof payload?.length === "number" ? payload.length : (payload?.text?.length ?? 0),
    });
  }, [audit]);

  const disabled = useMemo(() => {
    return loading || !clientSecret || !PUBLIC_KEY || !WORKFLOW_ID;
  }, [loading, clientSecret]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-start p-6 gap-6">
      <header className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold">FM Leadership Coach (Beta)</h1>
        <p className="text-sm opacity-70">
          Testversion – keine personenbezogenen Daten eingeben. Antworten können zu Trainingszwecken geloggt werden.
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
          {/* 
            Der Chat-Komponent erhält:
            - publicKey (clientseitig)
            - clientSecret (vom Server geholt)
            - workflowId
            - optionale Config (Uploads etc.)
            - onMessageSent -> Audit-Hook
          */}
          <Chat
            publicKey={PUBLIC_KEY}
            clientSecret={clientSecret}
            workflowId={WORKFLOW_ID}
            config={{
              file_upload: { enabled: true },
            }}
            // Dieser Callback-Name kann je nach Starter etwas anders heißen (z.B. onUserMessage / onSend)
            onMessageSent={(msg: { text?: string }) =>
              handleMessageSent({ text: msg?.text, length: msg?.text?.length })
            }
            // Defensive: Fehler im UI auch auditieren (optional)
            onError={(err: unknown) => audit("error", { message: String(err) })}
          />
        </section>
      )}
    </main>
  );
}
