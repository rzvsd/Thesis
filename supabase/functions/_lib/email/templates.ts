// Email texts. Subjects and texts copied from apps/product-api (auth-routes.ts, account-routes.ts).
// The supabase driver uses the dashboard templates instead (docs/rebuild/M1-auth-mapping.md has the text).

export function verifyEmailText(code: string): { subject: string; text: string } {
  return {
    subject: "Verify your Thesis account",
    text: `Your Thesis verification code is:\n\n${code}\n\n` +
      "Enter it in the Thesis app to verify your account. " +
      "If you did not create an account, ignore this email.",
  };
}

export function passwordResetText(code: string): { subject: string; text: string } {
  return {
    subject: "Your Thesis password reset code",
    text: `Your password reset code is:\n\n${code}\n\n` +
      "Enter it in the Thesis app to choose a new password. It expires in 1 hour. " +
      "If you did not ask for this, ignore this email.",
  };
}

export function accountDeletionText(code: string): { subject: string; text: string } {
  return {
    subject: "Confirm deletion of your Thesis account",
    text: `Your account deletion code is:\n\n${code}\n\n` +
      "Enter it on the account deletion page to permanently delete your account. " +
      "It expires in 1 hour. If you did not ask for this, ignore this email.",
  };
}
