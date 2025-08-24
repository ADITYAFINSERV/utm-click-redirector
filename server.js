import express from "express";
import { randomUUID } from "crypto";

const app = express();
const PORT = process.env.PORT || 10000;

// Healthcheck endpoint for Render
app.get("/healthz", (_req, res) => res.send("ok"));

app.get(["/", "/r", "/redirect"], (req, res) => {
  const dest = process.env.DESTINATION_URL;
  if (!dest) return res.status(500).send("DESTINATION_URL not set");

  const u = new URL(dest);
  const sp = u.searchParams;

  // Generate unique click_id
  const clickId = randomUUID();

  // Always set click_id
  sp.set("click_id", clickId);

  // Replace utm_campaign with click_id for tracking
  sp.set("utm_campaign", `utmclick_${clickId}`);

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
