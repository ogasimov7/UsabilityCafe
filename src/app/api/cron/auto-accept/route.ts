import { autoAcceptDue } from "@/lib/market";

// Called by a scheduled job (see vercel.json). Pays testers whose sessions went unreviewed for 72h.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const accepted = await autoAcceptDue();
  return Response.json({ accepted });
}
