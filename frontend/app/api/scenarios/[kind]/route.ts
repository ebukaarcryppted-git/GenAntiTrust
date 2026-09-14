import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (kind !== "clean" && kind !== "rigged") {
    return NextResponse.json({ error: "unknown scenario" }, { status: 404 });
  }
  const filePath = path.resolve(
    process.cwd(),
    "..",
    "simulator",
    "scenarios",
    `${kind}.json`
  );
  try {
    const raw = await readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      {
        error:
          `Scenario file not found. Run: python simulator/marketplace.py ${kind}`,
      },
      { status: 404 }
    );
  }
}
