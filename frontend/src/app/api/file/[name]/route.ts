export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await ctx.params;
    // Allow only simple filenames and specific extensions
    if (!/^[A-Za-z0-9._-]+\.(md|json|txt)$/.test(name)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    const backendHttp =
      process.env.BACKEND_URL && String(process.env.BACKEND_URL).trim();
    if (backendHttp) {
      const base = backendHttp.replace(/\/$/, "");
      const target = `${base}/file/${encodeURIComponent(name)}`;
      const res = await fetch(target);
      const headers = new Headers();
      res.headers.forEach((v, k) => headers.set(k, v));
      return new NextResponse(res.body, { status: res.status, headers });
    }

    // Local dev: read from ../backend
    const filePath = path.join(process.cwd(), "..", "backend", name);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = fs.readFileSync(filePath);

    let contentType = "application/octet-stream";
    if (name.endsWith(".md")) contentType = "text/markdown; charset=utf-8";
    else if (name.endsWith(".json"))
      contentType = "application/json; charset=utf-8";
    else if (name.endsWith(".txt")) contentType = "text/plain; charset=utf-8";

    return new NextResponse(data, {
      status: 200,
      headers: { "content-type": contentType },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
