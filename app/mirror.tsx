
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

type SharedMessage = {
  text: string;
  action: "typing" | "search";
  updatedAt: number;
};

const languages = [
  "हिन्दी",
  "বাংলা",
  "తెలుగు",
  "मराठी",
  "தமிழ்",
  "ગુજરાતી",
  "ಕನ್ನಡ",
  "മലയാളം",
  "ਪੰਜਾਬੀ",
];

const trending = [
  "latest news today",
  "weather today",
  "popular movies",
  "technology news",
  "sports results",
  "trending searches",
];

function googleSearchUrl(query: string) {
  return "https://www.google.com/search?q=" + encodeURIComponent(query);
}

export default function Mirror() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting…");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectedRef = useRef(false);
  const textRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectingRef = useRef(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setStatus("Configuration missing");
      return;
    }

    const supabase = createClient(url, key);
    let active = true;

    const channel = supabase.channel("magic-mirror-global", {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel.on("broadcast", { event: "shared-state" }, ({ payload }) => {
      if (!active || !payload || redirectingRef.current) return;

      const message = payload as Partial<SharedMessage>;

      if (typeof message.text !== "string") return;

      textRef.current = message.text;
      setText(message.text);

      if (message.action === "search" && message.text.trim()) {
        redirectingRef.current = true;
        window.location.replace(googleSearchUrl(message.text.trim()));
      }
    });

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

    try {
      const result = await channel.send({
        type: "broadcast",
        event: "shared-state",
        payload: {
          text: textRef.current,
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
    if (!query || redirectingRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    redirectingRef.current = true;

    // Broadcast the search before navigating locally.
    // If Supabase is unavailable, still allow local search.
    await sendState("search");

    window.location.replace(googleSearchUrl(query));
  }

  function searchTrending(item: string) {
    textRef.current = item;
    setText(item);

    if (timerRef.current) clearTimeout(timerRef.current);

    const form = document.querySelector<HTMLFormElement>(
      ".mobile-search-box"
    );

    form?.requestSubmit();
  }

  return (
    <main className="mobile-search-page">
      <header className="mobile-search-header">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <nav className="search-tabs" aria-label="Search categories">
          <button className="tab active" type="button">
            ALL
          </button>
          <button className="tab" type="button">
            IMAGES
          </button>
        </nav>

        <div className="header-tools">
          <button
            className="apps-grid"
            type="button"
            aria-label="Google apps"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </button>

          <a
            className="sign-in-button"
            href="https://accounts.google.com/"
            target="_blank"
            rel="noreferrer"
          >
            Sign in
          </a>
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
          <button
            className="search-symbol"
            type="submit"
            aria-label="Search"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
          </button>

          <input
            type="search"
            aria-label="Shared search query"
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
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

          <button
            className="search-tool"
            type="button"
            aria-label="AI search"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
            </svg>
          </button>

          <button
            className="search-tool"
            type="button"
            aria-label="Voice search"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6" />
            </svg>
          </button>
        </form>

        <div className="language-area">
          <p>Search offered in:</p>
          <div className="language-list">
            {languages.map((language) => (
              <a key={language} href="#languages">
                {language}
              </a>
            ))}
          </div>
        </div>

        <section className="trending-section">
          <h2>
            Trending searches <span>⋮</span>
          </h2>

          <div className="trending-list">
            {trending.map((item) => (
              <button
                type="button"
                className="trending-item"
                key={item}
                onClick={() => searchTrending(item)}
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
        <span>
          {status === "Live" ? "Shared live search enabled" : status}
        </span>
        <span>Independent demo interface</span>
      </footer>
    </main>
  );
}
