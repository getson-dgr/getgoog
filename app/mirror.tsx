 "use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type MirrorState = { text: string; redirectUrl: string; action: "idle" | "redirect"; updatedAt: number };
const emptyState: MirrorState = { text: "", redirectUrl: "", action: "idle", updatedAt: 0 };

export default function Mirror() {
  const [text, setText] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [connected, setConnected] = useState(false);
  const [controller, setController] = useState(false);
  const [client, setClient] = useState<SupabaseClient | null>(null);

  const room = useMemo(() => {
    const segment = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean).join("-") : "home";
    return (segment || "home").slice(0, 80);
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setStatus("Setup needed: add Supabase environment variables in Vercel."); return; }
    const supabase = createClient(url, key);
    setClient(supabase);
    const channel = supabase.channel(`mirror-${room}`, { config: { broadcast: { self: true } } });
    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        const next = payload as MirrorState;
        if (typeof next.text === "string") setText(next.text);
        if (typeof next.redirectUrl === "string") setRedirectUrl(next.redirectUrl);
        if (next.action === "redirect" && next.redirectUrl) {
          // Redirect is intentionally initiated only by the sender's explicit Go action.
          // Viewers see the shared destination and can open it themselves.
        }
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") { setConnected(true); setStatus(`Live • room /${room}`); }
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") { setConnected(false); setStatus("Connection issue. Check Supabase settings."); }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [room]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setController(params.get("control") === "1");
  }, []);

  async function broadcast(payload: MirrorState) {
    if (!client) return;
    const channel = client.channel(`mirror-${room}`, { config: { broadcast: { self: true } } });
    const result = await channel.subscribe();
    if (result !== "SUBSCRIBED") { setStatus("Could not connect to the live room."); return; }
    await channel.send({ type: "broadcast", event: "state", payload });
    await client.removeChannel(channel);
  }

  async function updateText(value: string) {
    setText(value);
    await broadcast({ text: value, redirectUrl, action: "idle", updatedAt: Date.now() });
  }

  async function updateUrl(value: string) {
    setRedirectUrl(value);
    await broadcast({ text, redirectUrl: value, action: "idle", updatedAt: Date.now() });
  }

  async function go() {
    const destination = safeUrl(redirectUrl);
    if (!destination) { setStatus("Enter a valid http:// or https:// URL first."); return; }
    await broadcast({ text, redirectUrl: destination, action: "redirect", updatedAt: Date.now() });
    window.location.href = destination;
  }

  function safeUrl(value: string) {
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch { return ""; }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand" aria-label="Search Mirror">
          <span className="brand-blue">S</span><span className="brand-red">e</span><span className="brand-yellow">a</span><span className="brand-blue">r</span><span className="brand-green">c</span><span className="brand-red">h</span>
        </div>
        <div className="top-right"><span className={`dot ${connected ? "on" : ""}`} />{status}</div>
      </header>

      <section className="hero">
        <div className="logo" aria-hidden="true">
          <span className="brand-blue">S</span><span className="brand-red">e</span><span className="brand-yellow">a</span><span className="brand-blue">r</span><span className="brand-green">c</span><span className="brand-red">h</span>
          <span className="mirror-word">Mirror</span>
        </div>
        <div className="searchbox">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
          <input
            aria-label="Mirrored search text"
            value={text}
            onChange={(e) => { if (controller) void updateText(e.target.value); }}
            readOnly={!controller}
            placeholder={controller ? "Type here to mirror live…" : "Waiting for the controller…"}
          />
          {text && controller && <button className="clear" onClick={() => void updateText("")} aria-label="Clear text">×</button>}
        </div>
        <div className="buttons">
          {controller ? <>
            <button onClick={() => void broadcast({ text, redirectUrl, action: "idle", updatedAt: Date.now() })}>Sync now</button>
            <button onClick={() => void updateText("")}>Clear screen</button>
          </> : <div className="viewer-hint">This display mirrors the controller in real time.</div>}
        </div>
        {controller && <div className="control-panel">
          <label htmlFor="redirect">Redirect destination</label>
          <div className="redirect-row">
            <input id="redirect" value={redirectUrl} onChange={(e) => void updateUrl(e.target.value)} placeholder="https://example.com" inputMode="url" />
            <button className="primary" onClick={() => void go()}>Go</button>
          </div>
          <p>Controller mode is enabled on this device. Viewers see the text; the Go button redirects this controller.</p>
        </div>}
        <div className="roomline">Shared room: <strong>/{room}</strong> · {controller ? "Controller" : "Viewer"} mode</div>
      </section>
      <footer>Search Mirror · Independent demo interface · Not affiliated with Google</footer>
    </main>
  );
}