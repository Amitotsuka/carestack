#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

function readPayload() {
  if (process.env.CARESTACK_UAT_STATE_B64) {
    return Buffer.from(process.env.CARESTACK_UAT_STATE_B64, 'base64').toString('utf8');
  }
  const databasePath = process.env.LOCAL_SQLITE_PATH || path.resolve(__dirname, '..', 'data', 'hospital.sqlite');
  if (!fs.existsSync(databasePath)) throw new Error(`SQLite database not found: ${databasePath}`);
  const database = new Database(databasePath, { readonly: true });
  const row = database.prepare('SELECT payload FROM app_state WHERE id = 1').get();
  database.close();
  if (!row?.payload) throw new Error('No app_state record was found in the local SQLite database.');
  return row.payload;
}

async function main() {
  const connectionString = process.env.POSTGRES_EXTERNAL_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set POSTGRES_EXTERNAL_URL (or DATABASE_URL) before importing data.');
  const payload = readPayload();
  JSON.parse(payload); // Fail before opening a connection if the export is invalid.

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
    `, [payload]);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
