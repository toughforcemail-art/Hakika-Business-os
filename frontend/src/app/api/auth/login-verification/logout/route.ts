import { proxyToAppMfa } from "@/lib/backend/proxy";
export async function POST(request: Request) { return proxyToAppMfa(request, "logout", "login"); }
