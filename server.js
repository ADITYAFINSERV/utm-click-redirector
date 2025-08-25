// Load .env for local development
if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}

import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Initialize DB
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS counters (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE,
      value INTEGER
    )
  `);

  const prefix = process.env.CLICK_PREFIX || "rakesh";
  await pool.query(
    `INSERT INTO counters (name, value)
     VALUES ($1, 0)
     ON CONFLICT (name) DO NOTHING`,
    [prefix]
  );
}

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

// Redirect endpoint
app.get(["/", "/r", "/redirect"], async (req, res) => {
  const dest = process.env.DESTINATION_URL;
  if (!dest) return res.status(500).send("DESTINATION_URL not set");

  const prefix = process.env.CLICK_PREFIX || "rakesh";

  // Increment counter atomically
  const result = await pool.query(
    `UPDATE counters SET value = value + 1 WHERE name=$1 RETURNING value`,
    [prefix]
  );

  const count = result.rows[0].value;
  const campaign = `${prefix}${String(count).padStart(2, "0")}`;

  // Append utm_campaign
  const u = new URL(dest);
  u.searchParams.set("utm_campaign", campaign);

  console.log({
    ts: new Date().toISOString(),
    utm_campaign: campaign,
    ip: req.headers["x-forwarded-for"] || req.ip,
    ua: req.headers["user-agent"]
  });

  res.redirect(302, u.toString());
});

// Admin route (see latest campaign number)
app.get("/admin/latest", async (_req, res) => {
  const prefix = process.env.CLICK_PREFIX || "rakesh";
  const result = await pool.query(
    `SELECT value FROM counters WHERE name=$1`,
    [prefix]
  );
  res.send(`Current utm_campaign = ${prefix}${String(result.rows[0].value).padStart(2, "0")}`);
});

// Start server
app.listen(PORT, async () => {
  await initDB();
  console.log(`Listening on port ${PORT}`);
});
{
  "name": "utm-click-redirector",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5",
    "dotenv": "^16.4.5"
  },
  "license": "UNLICENSED"
}
