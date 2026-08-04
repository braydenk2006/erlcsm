import { NextResponse } from "next/server";
import { prisma } from "@commandry/database";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}
