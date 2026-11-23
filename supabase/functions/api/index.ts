// Entry point of the single Supabase Edge Function "api".
import { handle } from "./app.ts";

Deno.serve((req) => handle(req));
