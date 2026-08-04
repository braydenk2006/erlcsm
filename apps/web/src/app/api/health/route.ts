import { NextResponse } from "next/server";
import { prisma } from "@commandry/database";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "web",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "web",
        database: "unavailable",
      },
      { status: 503 },
    );
  }
}
