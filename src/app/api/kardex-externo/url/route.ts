import { getDb } from "@/lib/db";
import { atenderReporteUrl } from "@/lib/reporte-kardex";

export async function POST(request: Request) {
  return atenderReporteUrl(request, getDb());
}
