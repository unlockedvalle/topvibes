// server.js - FINAL DINÁMICO
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');

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
      hero: { title: 'DROP #003: CAMISETAS DE ARTISTAS', desc: 'Camisetas únicas inspiradas en artistas como Travis Scott, Kanye West y Quevedo.' },
      about: { title: '¿Qué es TOPVIBES?', desc1: 'Marca de drops únicos.', desc2: 'Vendemos en Vinted y Wallapop.' },
      telegram: { title: 'Únete a Nuestra Comunidad en Telegram', desc: '¿Quieres ser el primero en enterarte?', link: 'https://t.me/+gOPcalQ283ZmMjdk' },
      shirtsTitle: 'Camisetas de Artistas',
      shirts: [
        {
          id: 'travis-scott',
          name: 'Travis Scott',
          img: 'https://files.catbox.moe/jebq36.jpg',
          oldPrice: '24.99',
          newPrice: '19.99',
          photos: ['https://files.catbox.moe/jebq36.jpg', 'https://files.catbox.moe/ax2bgv.jpg'],
          desc: { intro: 'Destaca tu estilo urbano...', details: ['Color: Negro', 'Estampado: Silueta...'], closing: 'Una camiseta versátil...' },
          size: 'M',
          pdf: 'https://files.catbox.moe/u93uht.pdf',
          vinted1: 'https://vinted.com/items/7129804695',
          vinted2: 'https://vinted.com/items/7129752813',
          wallapop: 'https://wallapop.com/item/camiseta-travis-scott-1177538052'
        }
        // AÑADE LOS DEMÁS...
      ],
      discounts: { title: 'Canjea tu Código', desc: 'Ingresa tu código exclusivo...', validCodes: ['M4S1T','BURRO','DROP003'], newPrice: '19.99' },
      footer: { year: '2025', ig: 'https://instagram.com/topvibeess', tt: 'https://tiktok.com/@topvibeess', yt: 'https://youtube.com/@topvibeess' }
    };
    await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initial)]);
  }
}

// === GET DATOS ===
app.get('/api/data', async (req, res) => {
  const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
  res.json(rows[0]?.data || {});
});

// === GUARDAR TODO ===
app.post('/api/update-all', async (req, res) => {
  await client.query(
    'INSERT INTO site_data (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
    [JSON.stringify(req.body)]
  );
  console.log('Datos guardados en DB');
  res.json({ status: 'ok' });
});

app.listen(PORT, async () => {
  await initDatabase();
  console.log(`Backend ON → https://topvibes-production.up.railway.app/api/data`);
});
