export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST() {
  try {
    // Run: (cwd=backend) PYTHONPATH=src python -m socialcrew_ai.main
    const backendDir = path.join(process.cwd(), "..", "backend");
    const env = { ...process.env, PYTHONPATH: "src" } as NodeJS.ProcessEnv;

    const result = await new Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      const child = spawn("python", ["-m", "socialcrew_ai.main"], {
        cwd: backendDir,
        env,
        shell: false,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("close", (code) =>
        resolve({ code: code ?? -1, stdout, stderr })
      );
    });

    if (result.code === 0) {
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, ...result }, { status: 500 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
