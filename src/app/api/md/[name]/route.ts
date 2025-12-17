export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await context.params;

    // Only allow simple filenames ending with .md (no path separators)
    if (!/^[A-Za-z0-9._-]+\.md$/.test(name)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "..", "backend", name);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
