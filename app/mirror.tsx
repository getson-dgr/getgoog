
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

type SharedState = {
  text: string;
  action: "typing" | "search";
  updatedAt: number;
};

export default function Mirror() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectedRef = useRef(false);
  const textRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setStatus(
        `Configuration missing: URL=${Boolean(url)}, KEY=${Boolean(key)}`
      );
      return;
    }

    const supabase = createClient(url, key);
    let active = true;

    const channel = supabase.channel("magic-mirror-global", {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel.on("broadcast", { event: "shared-state" }, ({ payload }) => {
      if (!active || !payload) return;

      const next = payload as Partial<SharedState>;

      // Ignore older updates that arrive after a newer update.
      if (
        typeof next.updatedAt !== "number" ||
        next.updatedAt < lastSentRef.current
      ) {
        return;
      }

      if (typeof next.text === "string") {
        textRef.current = next.text;
        setText(next.text);
      }

      if (next.action === "search" && typeof next.text === "string") {
        window.location.assign(
          "https://www.google.com/search?q=" + encodeURIComponent(next.text)
        );
      }
    });

    channel.subscribe((subscriptionStatus) => {
      if (!active) return;

      if (subscriptionStatus === "SUBSCRIBED") {
        connectedRef.current = true;
        setStatus("Live · shared by everyone");
      } else if (
        subscriptionStatus === "CHANNEL_ERROR" ||
        subscriptionStatus === "TIMED_OUT" ||
        subscriptionStatus === "CLOSED"
      ) {
        connectedRef.current = false;
        setStatus(`Connection issue: ${subscriptionStatus}`);
      }
    });

    return () => {
      active = false;
      connectedRef.current = false;
      channelRef.current = null;

      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, []);

  async function sendState(action: SharedState["action"] = "typing") {
    const channel = channelRef.current;

    if (!channel || !connectedRef.current) {
      setStatus("Connecting… please try again in a moment.");
      return;
    }

    const updatedAt = Date.now();
    lastSentRef.current = updatedAt;

    const result = await channel.send({
      type: "broadcast",
      event: "shared-state",
      payload: {
        text: textRef.current,
        action,
        updatedAt,
      } satisfies SharedState,
    });

    if (result !== "ok") {
      setStatus("Sync failed. Check your connection.");
    }
  }

  function handleChange(value: string) {
    textRef.current = value;
    setText(value);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void sendState("typing");
    }, 100);
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = textRef.current.trim();
    if (!query) return;

    textRef.current = query;
    setText(query);

    void sendState("search").then(() => {
      window.location.assign(
        "https://www.google.com/search?q=" + encodeURIComponent(query)
      );
    });
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand" aria-label="Search Mirror">Search</div>
        <div className="top-right">
          <span className={`dot ${status.startsWith("Live") ? "on" : ""}`} />
          {status}
        </div>
      </header>

      <section className="hero">
        <div className="logo">
          <span className="mirror-word">Search Mirror</span>
        </div>

        <form className="searchbox" onSubmit={handleSearch}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 5 5" />
          </svg>

          <input
            aria-label="Shared search"
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Type a search…"
          />

          <button type="submit" aria-label="Search">Search</button>
        </form>

        <p className="viewer-hint">
          Everyone on this page shares the same live search.
        </p>
      </section>

      <footer>
        Search Mirror · Independent demo interface · Not affiliated with Google
      </footer>
    </main>
  );
}
