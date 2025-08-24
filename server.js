import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// Simple counter in memory
let counter = 1;

// Healthcheck (Render needs this)
app.get("/healthz", (_req, res) => res.send("ok"));

app.get(["/", "/r", "/redirect"], (req, res) => {
  const dest = process.env.DESTINATION_URL;
  if (!dest) return res.status(500).send("DESTINATION_URL not set");

  const u = new URL(dest);
  const sp = u.searchParams;

  // Click prefix (e.g., rakesh) from env
  const base = process.env.CLICK_PREFIX || "rakesh";

  // Build sequential ID like rakesh01, rakesh02 ...
  const clickId = `${base}${String(counter).padStart(2, "0")}`;
  counter++;

  // Apply to URL
  sp.set("click_id", clickId);
  sp.set("utm_campaign", clickId);

  console.log({
    ts: new Date().toISOString(),
    click_id: clickId,
    ip: req.headers["x-forwarded-for"] || req.ip,
    ua: req.headers["user-agent"]
  });

  res.redirect(302, u.toString());
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
