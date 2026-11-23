// SQL for the email unsubscribe page. Owner: M1. Copied from PostgresStore.setEmailOptOut.
import { db } from "./common.ts";

export async function setEmailOptOut(
  input: { userId: string; optOut: boolean; updatedAt: string },
): Promise<void> {
  await db()`
    insert into user_email_preferences (user_id, email_opt_out, updated_at)
    values (${input.userId}, ${input.optOut}, ${input.updatedAt}::timestamptz)
    on conflict (user_id) do update
      set email_opt_out = excluded.email_opt_out,
          updated_at = excluded.updated_at`;
}
