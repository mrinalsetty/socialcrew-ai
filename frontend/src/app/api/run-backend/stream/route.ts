export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export async function GET(req: Request) {
  // If deploying on Vercel, set BACKEND_URL and we'll proxy to the backend instead of spawning Python
  const backendHttp =
    process.env.BACKEND_URL && String(process.env.BACKEND_URL).trim();
  if (backendHttp) {
    const inUrl = new URL(req.url);
    const topic = (inUrl.searchParams.get("topic") || "").trim();
    const base = backendHttp.replace(/\/$/, "");
    const target = `${base}/run${
      topic ? `?topic=${encodeURIComponent(topic)}` : ""
    }`;
    const res = await fetch(target, {
      headers: { accept: "text/event-stream" },
    });
    // Pass-through SSE body and set appropriate headers
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Connection", "keep-alive");
    return new Response(res.body, { status: res.status, headers });
  }
  const encoder = new TextEncoder();
  const backendDir = path.join(process.cwd(), "..", "backend");
  // Merge backend/.env into environment for the child process
  const env: NodeJS.ProcessEnv = { ...process.env, PYTHONPATH: "src" };
  try {
    const dotenvPath = path.join(backendDir, ".env");
    if (fs.existsSync(dotenvPath)) {
      const raw = fs.readFileSync(dotenvPath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2];
        // strip surrounding quotes if present
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      });
    }
  } catch {
    // ignore .env parse errors; process.env still available
  }

  const url = new URL(req.url);
  const topic = (url.searchParams.get("topic") || "").trim();
  if (topic) {
    env.TOPIC = topic;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function writeSse(line: string) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      function writeEvent(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Echo the topic and basic env for visibility
      if (topic) {
        writeSse(`Topic received: ${topic}`);
      } else {
        writeSse("No topic provided. Backend will use default.");
      }
      writeSse(`PYTHON_BIN: ${env.PYTHON_BIN || "not set"}`);
      writeSse(`PYTHONPATH: ${env.PYTHONPATH || "not set"}`);

      // Preflight: detect any *_API_KEY in env and log it (non-blocking)
      const detectedKeys = Object.keys(env).filter((k) => /_API_KEY$/.test(k));
      if (detectedKeys.length === 0) {
        writeSse(
          "No provider API key detected in environment. Proceeding anyway."
        );
        writeSse("Set your key(s) in backend/.env (e.g., GROQ_API_KEY=...)");
      } else {
        writeSse(`Detected provider keys: ${detectedKeys.join(", ")}`);
      }

      const preferred = env.PYTHON_BIN && String(env.PYTHON_BIN).trim();
      const venvCrewai = path.join(backendDir, ".venv", "bin", "crewai");
      let child: ChildProcess | null = null;

      function spawnCliOrPython() {
        // 1) Prefer venv CrewAI CLI if available
        if (fs.existsSync(venvCrewai)) {
          writeSse(`Using CLI: ${venvCrewai} run`);
          try {
            child = spawn(venvCrewai, ["run"], {
              cwd: backendDir,
              env,
              shell: false,
            });
            return;
          } catch {
            child = null;
          }
        }

        // 2) Fall back to Python module
        const candidates = [preferred || "", "python3", "python"].filter(
          Boolean
        ) as string[];
        for (const bin of candidates) {
          try {
            child = spawn(bin, ["-m", "socialcrew_ai.main"], {
              cwd: backendDir,
              env,
              shell: false,
            });
            writeSse(`Using interpreter: ${bin}`);
            return;
          } catch {
            child = null;
          }
        }
      }

      // Spawn the backend process now
      spawnCliOrPython();
      if (!child) {
        writeEvent("error", "Unable to spawn CrewAI CLI or Python process");
        controller.close();
        return;
      }

      // Attach listeners
      const proc = child as ChildProcess;
      if (proc.stdout) {
        proc.stdout.setEncoding("utf8");
        proc.stdout.on("data", (d: string) => {
          d.split(/\r?\n/).forEach((line) => line && writeSse(line));
        });
      }
      if (proc.stderr) {
        proc.stderr.setEncoding("utf8");
        proc.stderr.on("data", (d: string) => {
          d.split(/\r?\n/).forEach((line) => line && writeSse(line));
        });
      }
      proc.on("close", (code: number) => {
        const outJson = path.join(backendDir, "social_posts.json");
        const outMd = path.join(backendDir, "analytics_summary.md");
        const logFile = path.join(backendDir, "run.log");
        writeSse(`Process exited with code: ${String(code ?? -1)}`);
        writeSse(`Backend CWD was: ${backendDir}`);
        writeSse(
          `Check output: social_posts.json exists? ${fs.existsSync(outJson)}`
        );
        writeSse(
          `Check output: analytics_summary.md exists? ${fs.existsSync(outMd)}`
        );
        writeSse(`Check log: run.log exists? ${fs.existsSync(logFile)}`);
        writeEvent("done", String(code ?? -1));
        controller.close();
      });
    },
    cancel() {
      // client disconnected; nothing special to do
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
