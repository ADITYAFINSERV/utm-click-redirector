// Load .env for local development
if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}

import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// Destination URL
const dest = process.env.DESTINATION_URL;
if (!dest) {
  console.error("❌ DESTINATION_URL is not set. Exiting...");
  process.exit(1);
}

// Postgres connection (optional)
let pool;
let dbAvailable = true;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
} catch (err) {
  console.warn("⚠️ Database not configured, will run without DB:", err.message);
  dbAvailable = false;
}

// Initialize DB
async function initDB() {
  if (!dbAvailable) return;

  try {
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
    console.log("✅ Database initialized");
  } catch (err) {
    console.error("❌ Database init failed:", err.message);
    dbAvailable = false;
  }
}

// Fallback counter (in-memory)
let fallbackCounter = 0;

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

// Redirect endpoint
app.get(["/", "/r", "/redirect"], async (req, res) => {
  const prefix = process.env.CLICK_PREFIX || "rakesh";
  let campaign;

  if (dbAvailable) {
    try {
      const result = await pool.query(
        `UPDATE counters SET value = value + 1 WHERE name=$1 RETURNING value`,
        [prefix]
      );
      const count = result.rows[0].value;
      campaign = `${prefix}${String(count).padStart(2, "0")}`;
    } catch (err) {
      console.error("⚠️ DB error, switching to fallback:", err.message);
      dbAvailable = false;
    }
  }

  // Fallback mode → use local counter
  if (!campaign) {
    fallbackCounter++;
    campaign = `${prefix}${String(fallbackCounter).padStart(2, "0")}`;
  }

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

// Admin route
app.get("/admin/latest", async (_req, res) => {
  const prefix = process.env.CLICK_PREFIX || "rakesh";

  if (dbAvailable) {
    try {
      const result = await pool.query(
        `SELECT value FROM counters WHERE name=$1`,
        [prefix]
      );
      return res.send(
        `Current utm_campaign = ${prefix}${String(result.rows[0].value).padStart(2, "0")}`
      );
    } catch (err) {
      return res.send("⚠️ Error fetching counter: " + err.message);
    }
  } else {
    return res.send(
      `⚠️ DB not available. Current fallback utm_campaign = ${prefix}${String(fallbackCounter).padStart(2, "0")}`
    );
  }
});

// Start server
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Listening on port ${PORT}`);
});
