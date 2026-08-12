import { proxyToAppMfa } from "@/lib/backend/proxy";
export async function GET(request: Request) { return proxyToAppMfa(request, "status", "login"); }
