export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function GET() {
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

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function writeSse(line: string) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      function writeEvent(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      const preferred = env.PYTHON_BIN && String(env.PYTHON_BIN).trim();
      const candidates = [preferred || "", "python3", "python"].filter(
        Boolean
      ) as string[];
      let child: ReturnType<typeof spawn> | null = null;

      function trySpawn(index: number) {
        const bin = candidates[index];
        try {
          child = spawn(bin, ["-m", "socialcrew_ai.main"], {
            cwd: backendDir,
            env,
            shell: false,
          });
        } catch {
          child = null;
        }
        if (!child) {
          if (index + 1 < candidates.length) return trySpawn(index + 1);
          writeEvent("error", "Unable to spawn Python process");
          controller.close();
          return;
        }
        writeSse(`Using interpreter: ${bin}`);

        if (child.stdout) {
          child.stdout.setEncoding("utf8");
          child.stdout.on("data", (d: string) => {
            d.split(/\r?\n/).forEach((line) => line && writeSse(line));
          });
        }
        if (child.stderr) {
          child.stderr.setEncoding("utf8");
          child.stderr.on("data", (d: string) => {
            d.split(/\r?\n/).forEach((line) => line && writeSse(line));
          });
        }
        child.on("close", (code) => {
          writeEvent("done", String(code ?? -1));
          controller.close();
        });
      }

      trySpawn(0);
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
