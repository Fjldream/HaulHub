import { NextRequest } from "next/server";
import { apiGet } from "@/lib/api-client";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!q) {
    return Response.json({ message: "请输入地点关键词" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ q });
    if (city) params.set("city", city);
    const result = await apiGet(`/maps/places/search?${params.toString()}`);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "地图搜索失败，请稍后重试";
    return Response.json({ message }, { status: 500 });
  }
}
