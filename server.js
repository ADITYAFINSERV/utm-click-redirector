import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// Connect to Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Ensure table exists
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS counters (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE,
      value INTEGER
    )
  `);

  // Ensure one row for our prefix
  const prefix = process.env.CLICK_PREFIX || "rakesh";
  await pool.query(
    `INSERT INTO counters (name, value)
     VALUES ($1, 0)
     ON CONFLICT (name) DO NOTHING`,
    [prefix]
  );
}

app.get("/healthz", (_req, res) => res.send("ok"));

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

  const u = new URL(dest);
  u.searchParams.set("utm_campaign", campaign);

  // Log
  console.log({
    ts: new Date().toISOString(),
    utm_campaign: campaign,
    ip: req.headers["x-forwarded-for"] || req.ip,
    ua: req.headers["user-agent"]
  });

  res.redirect(302, u.toString());
});

app.listen(PORT, async () => {
  await initDB();
  console.log(`Listening on port ${PORT}`);
});
import "dotenv/config";
