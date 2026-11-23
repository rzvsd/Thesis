// Admin seed script (N11). Never runs on its own: run it by hand and pass --yes.
//
//   cd supabase/functions
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... THESIS_DB_URL=... \
//   ADMIN_SEED_EMAIL=you@example.com ADMIN_SEED_PASSWORD=... [ADMIN_SEED_PRO=1] \
//   deno run --allow-env --allow-net _lib/auth/seed_admin.ts --yes
//
// The password comes only from the environment. The account is verified, marked
// app_metadata.thesis_test_account = true in Supabase Auth, and gets PRO when ADMIN_SEED_PRO=1.
import { env } from "../../_shared/env.ts";
import { pgAuthStore } from "../store/auth.ts";
import { seedAdmin } from "./bootstrap.ts";
import { GoTrueClient } from "./gotrue.ts";
import { isValidEmail } from "./tokens.ts";

async function main(): Promise<number> {
  if (!Deno.args.includes("--yes")) {
    console.error("Refusing to run without --yes.");
    return 2;
  }
  const email = env("ADMIN_SEED_EMAIL")?.trim().toLowerCase() ?? "";
  const password = env("ADMIN_SEED_PASSWORD") ?? "";
  if (!isValidEmail(email) || password.length < 8) {
    console.error("Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (min 8 chars).");
    return 2;
  }
  const result = await seedAdmin(
    { email, password, forcePro: env("ADMIN_SEED_PRO") === "1" },
    { gotrue: new GoTrueClient(), store: pgAuthStore },
  );
  console.log(JSON.stringify({ message: "Seeded admin", user_id: result.userId, created: result.created }));
  return 0;
}

if (import.meta.main) {
  Deno.exit(await main());
}
