"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [analyticsMd, setAnalyticsMd] = useState<string>("");
  const [reportMd, setReportMd] = useState<string>("");
  const [consoleOut, setConsoleOut] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const esRef = useRef<EventSource | null>(null);

  async function runBackendAndReload() {
    try {
      setRunning(true);
      setError(null);

      setConsoleOut("");

      // Live logs via SSE
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      const es = new EventSource("/api/run-backend/stream");
      esRef.current = es;
      es.onmessage = (evt) => {
        setConsoleOut((prev) => (prev ? prev + "\n" + evt.data : evt.data));
      };
      es.addEventListener("done", async () => {
        es.close();
        esRef.current = null;
        // fetch outputs after completion
        const [a, s] = await Promise.all([
          fetch("/api/file/analytics_summary.md"),
          fetch("/api/file/social_posts.json"),
        ]);
        setAnalyticsMd(a.ok ? await a.text() : "");
        setReportMd(s.ok ? await s.text() : "");
        setRunning(false);
      });
      es.onerror = () => {
        setError("Stream error. Check backend Python availability.");
        es.close();
        esRef.current = null;
        setRunning(false);
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">SocialCrew AI</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={runBackendAndReload}
          disabled={running}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        >
          {running ? "Running…" : "Run"}
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border rounded p-4 bg-white/50">
          <h2 className="font-semibold mb-2">
            Agent 1 Output (analytics_summary.md)
          </h2>
          <pre className="whitespace-pre-wrap text-sm">
            {analyticsMd || "No output yet."}
          </pre>
        </section>
        <section className="border rounded p-4 bg-white/50">
          <h2 className="font-semibold mb-2">
            Agent 2 Output (social_posts.json)
          </h2>
          <pre className="whitespace-pre-wrap text-sm">
            {reportMd || "No output yet."}
          </pre>
        </section>
      </div>

      <section className="border rounded p-4 bg-black text-green-300">
        <h2 className="font-semibold mb-2 text-white">Console</h2>
        <pre className="whitespace-pre-wrap text-xs">{consoleOut || "—"}</pre>
      </section>
    </main>
  );
}
