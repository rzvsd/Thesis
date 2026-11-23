// Entry point of the single Supabase Edge Function "api" (and its previews api-m1..api-m4).
import { handle } from "./app.ts";

Deno.serve((req) => handle(req));
