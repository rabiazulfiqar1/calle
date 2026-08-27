/**
 * Run this ONCE to authorize your app with CALL-E:
 *   npx tsx scripts/calle-mcp-login.ts
 *
 * It prints a login URL — open it in your browser, log into CALL-E,
 * authorize. This script polls until that completes, then caches the
 * token to disk (~/.calle-mcp/two-phase-work/...). Every API route in
 * the app then reuses that cached token — no per-user login needed.
 *
 * Re-run this if a route ever tells you the token was rejected/expired.
 */
import { getCachedTokenOrStartLogin, waitForBrokerLogin } from "../lib/mcp/brokerclient";

async function main() {
  const state = await getCachedTokenOrStartLogin();

  if (!state.loginRequired) {
    console.log("✅ Already authorized — cached token is still valid. Nothing to do.");
    return;
  }

  console.log("\n=== CALL-E Authorization Required ===\n");
  console.log("Open this URL in your browser and log in:\n");
  console.log(state.loginUrl);
  console.log("\nWaiting for you to complete authorization...\n");

  const token = await waitForBrokerLogin();
  console.log("✅ Authorized! Token cached. You can now use the app normally.");
  console.log(`Token expires at: ${token.expires_at ?? "(no expiry given)"}`);
}

main().catch((err) => {
  console.error("❌ Authorization failed:", err.message ?? err);
  process.exit(1);
});