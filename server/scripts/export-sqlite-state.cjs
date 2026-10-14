#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const databasePath = process.env.LOCAL_SQLITE_PATH || path.resolve(__dirname, '..', 'data', 'hospital.sqlite');
if (!fs.existsSync(databasePath)) {
  throw new Error(`SQLite database not found: ${databasePath}`);
}

const database = new Database(databasePath, { readonly: true });
const row = database.prepare('SELECT payload FROM app_state WHERE id = 1').get();
database.close();
if (!row?.payload) throw new Error('No app_state record was found in the local SQLite database.');

// This command deliberately prints only the encoded value so it can be copied
// directly into the CARESTACK_UAT_STATE_B64 GitHub Actions secret.
process.stdout.write(Buffer.from(row.payload, 'utf8').toString('base64'));
