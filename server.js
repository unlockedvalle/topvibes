// server.js - SOLO DB + API
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;

// === POSTGRESQL ===
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => console.log('DB CONECTADA'))
  .catch(err => console.error('Error DB:', err));

// === INIT DB ===
async function initDatabase() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS site_data (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'
    )
  `);
  const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
  if (rows.length === 0) {
    const initial = {
      hero: { title: 'DROP #003', desc: 'Camisetas únicas' },
      about: { title: 'TOPVIBES', desc1: 'Drops exclusivos', desc2: 'Vinted + Wallapop' },
      telegram: { title: 'Telegram', desc: 'Únete', link: 'https://t.me/topvibes' },
      shirtsTitle: 'Camisetas',
      shirts: [],
      discounts: { title: 'Descuentos', desc: 'Usa código', validCodes: [], newPrice: '19.99' },
      footer: { year: '2025' }
    };
    await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initial)]);
  }
}

// === GET DATOS ===
app.get('/api/data', async (req, res) => {
  const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
  res.json(rows[0]?.data || {});
});

// === GUARDAR TODO (solo DB) ===
app.post('/api/update-all', async (req, res) => {
  try {
    await client.query(
      'INSERT INTO site_data (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(req.body)]
    );
    console.log('Datos guardados en DB');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  await initDatabase();
  console.log(`Backend ON → https://topvibes-production.up.railway.app/api/data`);
});
