// ============================================================
//  OPENING AN UNSUBSCRIBE LINK MUST CHANGE NOTHING
//
//  The route used to delete a subscription on a plain GET. Corporate mail
//  filters fetch every link in an incoming message to vet it, so every
//  subscriber behind one would have been unsubscribed on arrival of their
//  first alert without clicking anything. See the header of
//  app/api/unsubscribe/route.ts.
//
//  HOW THIS PROVES GET NEVER TOUCHES THE DATABASE, rather than hoping:
//  it runs with the Supabase credentials REMOVED. getServiceSupabaseClient
//  throws the moment anything asks for a client. A GET that tried to
//  delete would therefore fail here; a GET that succeeds cannot have
//  reached the database at all. POST, the path that is supposed to
//  delete, must reach it -- so with no credentials it must fail, safely.
//
//  Also checks that a link carrying markup instead of a token is refused,
//  not echoed into the page, where it would run on this site's address.
//
//    npx tsx scripts/test-unsubscribe-safety.ts
// ============================================================

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
const { GET, POST } = await import("@/app/api/unsubscribe/route");

const GOOD = "3f2b8c1e-9a4d-4e6f-8b21-5c7d9e0a1b2c";
const EVIL = `"><script>alert(1)</script>`;
const url = (t: string) => `https://example.test/api/unsubscribe?token=${encodeURIComponent(t)}`;

let fails = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? `   (${detail})` : ""}`);
};

console.log("\nOPENING THE LINK (what a scanner does)\n");
{
  let threw = false;
  let res: Response | undefined;
  try { res = await GET(new Request(url(GOOD))); } catch { threw = true; }
  ok("GET succeeds with NO database credentials, so it never asked for the database", !threw && res?.status === 200, threw ? "threw" : `HTTP ${res?.status}`);
  const html = res ? await res.text() : "";
  ok("GET shows a confirmation button", /<form method="post"/.test(html) && /<button/.test(html));
  ok("the button posts back to the same token", html.includes(`action="/api/unsubscribe?token=${GOOD}"`));
  ok("GET does not claim anything was done", !/You won't receive any more/.test(html));
}

console.log("\nA LINK CARRYING MARKUP INSTEAD OF A TOKEN\n");
{
  const res = await GET(new Request(url(EVIL)));
  const html = await res.text();
  ok("is refused", res.status === 400, `HTTP ${res.status}`);
  ok("is not written into the page", !html.includes("<script>alert(1)") && !html.includes(EVIL));
  ok("gets no button", !/<form/.test(html));

  let threw = false;
  let post: Response | undefined;
  try { post = await POST(new Request(url(EVIL), { method: "POST" })); } catch { threw = true; }
  ok("POST with it is refused before any database access", !threw && post?.status === 400, threw ? "threw" : `HTTP ${post?.status}`);
}

console.log("\nPRESSING THE BUTTON (or the mail provider's one-click)\n");
{
  let threw = false;
  let res: Response | undefined;
  try {
    res = await POST(new Request(url(GOOD), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    }));
  } catch { threw = true; }
  // With no credentials the delete cannot run. What matters is that POST
  // is the path that TRIES -- and that it fails as a page, not a crash.
  ok("POST is the path that reaches for the database", !threw && res?.status === 500, threw ? "threw instead of answering" : `HTTP ${res?.status}`);
  const html = res ? await res.text() : "";
  ok("and a failure says nothing was changed", /Nothing was changed/.test(html));
}

console.log("\nMISSING TOKEN\n");
{
  const res = await GET(new Request("https://example.test/api/unsubscribe"));
  ok("is refused, not treated as a request to unsubscribe", res.status === 400, `HTTP ${res.status}`);
}

console.log("");
if (fails > 0) {
  console.error(`${fails} check(s) failed.\n`);
  process.exit(1);
}
console.log("Opening an unsubscribe link changes nothing; only a POST with a real token can.\n");
}

main();
export {};
