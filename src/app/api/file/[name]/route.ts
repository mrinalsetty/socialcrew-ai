export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const name = params.name;
    // Allow only simple filenames and specific extensions
    if (!/^[A-Za-z0-9._-]+\.(md|json|txt)$/.test(name)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

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
