
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createClient,
  type RealtimeChannel,
} from "@supabase/supabase-js";

type MirrorState = {
  text: string;
  redirectUrl: string;
  action: "idle" | "redirect";
  updatedAt: number;
};

const initialState: MirrorState = {
  text: "",
  redirectUrl: "",
  action: "idle",
  updatedAt: 0,
};

export default function Mirror() {
  const [text, setText] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [room, setRoom] = useState("home");
  const [controller, setController] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting…");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectedRef = useRef(false);
  const controllerRef = useRef(false);
  const textRef = useRef("");
  const redirectRef = useRef("");
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const path = window.location.pathname
      .split("/")
      .filter(Boolean)
      .join("-");

    setRoom(path || "home");

    const isController =
      new URLSearchParams(window.location.search).get("control") === "1";

    setController(isController);
    controllerRef.current = isController;
  }, []);

  useEffect(() => {
    if (room === "home" && window.location.pathname !== "/") {
      return;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setStatus("Supabase configuration is missing.");
      return;
    }

    const supabase = createClient(url, key);
    let active = true;

    const channel = supabase.channel(`mirror-${room}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      if (!active || !payload) return;

      const next = payload as Partial<MirrorState>;

      if (typeof next.text === "string") {
        textRef.current = next.text;
        setText(next.text);
      }

      if (typeof next.redirectUrl === "string") {
        redirectRef.current = next.redirectUrl;
        setRedirectUrl(next.redirectUrl);
      }

      // Only an explicit redirect event can trigger navigation.
      // The controller's own Go action handles its own navigation.
      if (
        next.action === "redirect" &&
        !controllerRef.current &&
        typeof next.redirectUrl === "string"
      ) {
        const destination = safeUrl(next.redirectUrl);

        if (destination) {
          if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
          }

          redirectTimerRef.current = setTimeout(() => {
            if (active) window.location.assign(destination);
          }, 500);
        }
      }
    });

    channel.subscribe((subscriptionStatus) => {
      if (!active) return;

      if (subscriptionStatus === "SUBSCRIBED") {
        connectedRef.current = true;
        setConnected(true);
        setStatus(`Live • room /${room}`);
      } else if (
        subscriptionStatus === "CHANNEL_ERROR" ||
        subscriptionStatus === "TIMED_OUT" ||
        subscriptionStatus === "CLOSED"
      ) {
        connectedRef.current = false;
        setConnected(false);
        setStatus(`Connection issue: ${subscriptionStatus}`);
      }
    });

    return () => {
      active = false;
      connectedRef.current = false;

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }

      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [room]);

  async function broadcast(
    updates: Partial<MirrorState> = {},
    action: "idle" | "redirect" = "idle"
  ) {
    const channel = channelRef.current;

    if (!channel || !connectedRef.current) {
      setStatus("Not connected yet. Please wait and try again.");
      return false;
    }

    const payload: MirrorState = {
      text: textRef.current,
      redirectUrl: redirectRef.current,
      action,
      updatedAt: Date.now(),
      ...updates,
    };

    try {
      const result = await channel.send({
        type: "broadcast",
        event: "state",
        payload,
      });

      if (result !== "ok") {
        setStatus("Sync failed. Check your connection.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Broadcast failed:", error);
      setStatus("Sync failed. Check Supabase settings.");
      return false;
    }
  }

  function handleTextChange(value: string) {
    if (!controller) return;

    textRef.current = value;
    setText(value);

    // Send the latest text after a short pause while typing.
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }

    redirectTimerRef.current = setTimeout(() => {
      void broadcast({ text: value });
    }, 80);
  }

  function handleUrlChange(value: string) {
    if (!controller) return;

    redirectRef.current = value;
    setRedirectUrl(value);
  }

  async function handleGo() {
    const destination = safeUrl(redirectRef.current);

    if (!destination) {
      setStatus("Enter a valid http:// or https:// URL.");
      return;
    }

    const sent = await broadcast(
      { redirectUrl: destination },
      "redirect"
    );

    if (sent) {
      window.location.assign(destination);
    }
  }

  async function handleClear() {
    textRef.current = "";
    setText("");
    await broadcast({ text: "" });
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand" aria-label="Search Mirror">
          <span className="brand-blue">S</span>
          <span className="brand-red">e</span>
          <span className="brand-yellow">a</span>
          <span className="brand-blue">r</span>
          <span className="brand-green">c</span>
          <span className="brand-red">h</span>
        </div>

        <div className="top-right">
          <span className={`dot ${connected ? "on" : ""}`} />
          {status}
        </div>
      </header>

      <section className="hero">
        <div className="logo" aria-label="Search Mirror">
          <span className="brand-blue">S</span>
          <span className="brand-red">e</span>
          <span className="brand-yellow">a</span>
          <span className="brand-blue">r</span>
          <span className="brand-green">c</span>
          <span className="brand-red">h</span>
          <span className="mirror-word">Mirror</span>
        </div>

        <div className="searchbox">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 5 5" />
          </svg>

          <input
            aria-label="Mirrored search text"
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            readOnly={!controller}
            placeholder={
              controller
                ? "Type here to mirror live…"
                : "Waiting for the controller…"
            }
          />

          {controller && text && (
            <button
              className="clear"
              onClick={() => void handleClear()}
              aria-label="Clear text"
            >
              ×
            </button>
          )}
        </div>

        <div className="buttons">
          {controller ? (
            <>
              <button
                onClick={() => void broadcast({ text: textRef.current })}
              >
                Sync now
              </button>
              <button onClick={() => void handleClear()}>
                Clear screen
              </button>
            </>
          ) : (
            <div className="viewer-hint">
              This display mirrors the controller in real time.
            </div>
          )}
        </div>

        {controller && (
          <div className="control-panel">
            <label htmlFor="redirect">Redirect destination</label>

            <div className="redirect-row">
              <input
                id="redirect"
                type="url"
                value={redirectUrl}
                onChange={(event) => handleUrlChange(event.target.value)}
                placeholder="https://example.com"
                inputMode="url"
              />

              <button className="primary" onClick={() => void handleGo()}>
                Go
              </button>
            </div>

            <p>
              Typing mirrors to viewers in this room. Go opens the destination
              on the controller and sends a redirect event to connected
              viewers.
            </p>
          </div>
        )}

        <div className="roomline">
          Shared room: <strong>/{room}</strong> ·{" "}
          {controller ? "Controller" : "Viewer"} mode
        </div>
      </section>

      <footer>
        Search Mirror · Independent demo interface · Not affiliated with Google
      </footer>
    </main>
  );
}

function safeUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}
