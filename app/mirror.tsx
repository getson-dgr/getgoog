
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

type SharedMessage = {
  text: string;
  action: "typing" | "search";
  updatedAt: number;
};

const languages = [
  "हिन्दी", "বাংলা", "తెలుగు", "मराठी", "தமிழ்",
  "ગુજરાતી", "ಕನ್ನಡ", "മലയാളം", "ਪੰਜਾਬੀ",
];

const trending = [
  "latest news today",
  "weather today",
  "popular movies",
  "technology news",
  "sports results",
  "trending searches",
];

export default function Mirror() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectedRef = useRef(false);
  const textRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      const message = payload as Partial<SharedMessage>;
      if (typeof message.text !== "string") return;

      textRef.current = message.text;
      setText(message.text);

      if (message.action === "search") {
        const destination =
          "https://www.google.com/search?q=" +
          encodeURIComponent(message.text.trim());

        if (message.text.trim()) {
          window.location.assign(destination);
        }
      }
    });
<img
  src="/google-home.png"
  alt="Mobile search homepage"
  className="reference-image"
/>
    channel.subscribe((subscriptionStatus) => {
      if (!active) return;

      if (subscriptionStatus === "SUBSCRIBED") {
        connectedRef.current = true;
        setStatus("Live");
      } else if (
        subscriptionStatus === "CHANNEL_ERROR" ||
        subscriptionStatus === "TIMED_OUT" ||
        subscriptionStatus === "CLOSED"
      ) {
        connectedRef.current = false;
        setStatus("Connection issue");
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

  async function sendState(action: SharedMessage["action"]) {
    const channel = channelRef.current;
    if (!channel || !connectedRef.current) {
      setStatus("Connecting…");
      return false;
    }

    const query = textRef.current;

    try {
      const result = await channel.send({
        type: "broadcast",
        event: "shared-state",
        payload: {
          text: query,
          action,
          updatedAt: Date.now(),
        } satisfies SharedMessage,
      });

      if (result !== "ok") {
        setStatus("Sync failed");
        return false;
      }

      return true;
    } catch {
      setStatus("Connection issue");
      return false;
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

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = textRef.current.trim();
    if (!query) return;

    textRef.current = query;
    setText(query);

    const sent = await sendState("search");

    if (sent) {
      window.location.assign(
        "https://www.google.com/search?q=" + encodeURIComponent(query)
      );
    }
  }

  return (
    <main className="mobile-search-page">
      <header className="mobile-search-header">
        <nav className="search-tabs" aria-label="Search categories">
          <button className="tab active" type="button">ALL</button>
          <button className="tab" type="button">IMAGES</button>
        </nav>

        <div className="header-tools">
          <span className={`connection-dot ${status === "Live" ? "online" : ""}`} />
          <button type="button" aria-label="Notifications" className="tool-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
            </svg>
          </button>
          <button type="button" aria-label="Apps" className="apps-grid">
            {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
          </button>
          <div className="profile-ring"><span>G</span></div>
        </div>
      </header>

      <section className="mobile-search-content">
        <div className="google-wordmark" aria-label="Search">
          <span className="g-blue">G</span>
          <span className="g-red">o</span>
          <span className="g-yellow">o</span>
          <span className="g-blue">g</span>
          <span className="g-green">l</span>
          <span className="g-red">e</span>
        </div>

        <form className="mobile-search-box" onSubmit={handleSearch}>
          <button className="search-symbol" type="submit" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
          </button>

          <input
            aria-label="Shared search query"
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            placeholder=""
            autoComplete="off"
          />

          {text && (
            <button
              type="button"
              className="clear-query"
              aria-label="Clear query"
              onClick={() => handleChange("")}
            >
              ×
            </button>
          )}

          <button className="search-tool" type="button" aria-label="AI search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
              <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
            </svg>
          </button>

          <button className="search-tool" type="button" aria-label="Voice search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6" />
            </svg>
          </button>

          <button className="search-tool" type="button" aria-label="Image search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
              <circle cx="11" cy="11" r="3" />
              <path d="m14 14 4 4" />
            </svg>
          </button>
        </form>

        <div className="language-area">
          <p>Search offered in:</p>
          <div className="language-list">
            {languages.map((language) => (
              <a key={language} href="#languages">{language}</a>
            ))}
          </div>
        </div>

        <section className="trending-section">
          <h2>Trending searches <span>⋮</span></h2>
          <div className="trending-list">
            {trending.map((item) => (
              <button
                type="button"
                className="trending-item"
                key={item}
                onClick={() => handleChange(item)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 17 6-6 4 3 7-8M14 6h6v6" />
                </svg>
                <span>{item}</span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <footer className="mobile-search-footer">
        <span>{status === "Live" ? "Shared live search enabled" : status}</span>
        <span>Independent demo interface</span>
      </footer>
    </main>
  );
}
