// server.js - FINAL 100% FUNCIONAL
// Puerto 8080 (backend) | PostgreSQL en 3000 (interno)
// Tabla se crea sola | Datos se cargan en admin | index.html se actualiza

const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = 8080; // ← PUERTO DEL BACKEND

// === POSTGRESQL (puerto 3000 interno en Railway) ===
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

client.connect()
  .then(() => console.log('Conectado a PostgreSQL (puerto 3000 interno)'))
  .catch(err => console.error('Error DB:', err));

// === GITHUB ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'index.html';

// === PLANTILLA index.html ===
const TEMPLATE_PATH = path.join(__dirname, 'index.html');
let siteTemplate = '';
try {
  siteTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  console.log('index.html (plantilla) cargado');
} catch (err) {
  console.error('ERROR: index.html no encontrado en la raíz');
  process.exit(1);
}

// === GENERAR HTML ===
function generateSiteHTML(data) {
  let html = siteTemplate;
  const r = (k, v) => { html = html.replace(new RegExp(`{{${k}}}`, 'g'), v || ''); };
  r('HERO_TITLE', data.hero?.title);
  r('HERO_DESC', data.hero?.desc);
  r('ABOUT_TITLE', data.about?.title);
  r('ABOUT_DESC1', data.about?.desc1);
  r('ABOUT_DESC2', data.about?.desc2);
  r('TELEGRAM_TITLE', data.telegram?.title);
  r('TELEGRAM_DESC', data.telegram?.desc);
  r('TELEGRAM_LINK', data.telegram?.link);
  r('SHIRTS_TITLE', data.shirtsTitle);
  r('SHIRTS_DATA', JSON.stringify(data.shirts || []));
  r('VALID_CODES', JSON.stringify(data.discounts?.validCodes || []));
  r('NEW_PRICE', data.discounts?.newPrice);
  r('DISCOUNTS_TITLE', data.discounts?.title);
  r('DISCOUNTS_DESC', data.discounts?.desc);
  r('COPYRIGHT_YEAR', data.footer?.year);
  r('IG_LINK', data.footer?.ig);
  r('TT_LINK', data.footer?.tt);
  r('YT_LINK', data.footer?.yt);
  return html;
}

// === ACTUALIZAR index.html EN GITHUB ===
async function updateGitHubPages(html) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER, repo: REPO, path: FILE_PATH, branch: BRANCH
    });
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: FILE_PATH,
      message: `Update site - ${new Date().toISOString()}`,
      content: Buffer.from(html).toString('base64'),
      sha: data.sha,
      branch: BRANCH
    });
    console.log('index.html ACTUALIZADO');
  } catch (err) {
    console.error('ERROR: index.html no existe. Sube uno manualmente.');
  }
}

// === INICIALIZAR DB + TABLA + DATOS ===
async function initDatabase() {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_data (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'
      )
    `);
    console.log('Tabla site_data OK');

    const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
    if (rows.length === 0) {
      console.log('Insertando datos iniciales...');
      const initialData = {
        hero: { title: 'DROP #003: CAMISETAS DE ARTISTAS', desc: 'Camisetas únicas inspiradas en artistas como Travis Scott, Kanye West y Quevedo, perfectas para fans del streetwear.' },
        about: {
          title: '¿Qué es TOPVIBES?',
          desc1: 'TOPVIBES es una marca que lanza drops diferentes, sin encasillarse en un solo estilo. Nos inspiramos en la música, el deporte y todo lo que forma parte de la cultura actual.',
          desc2: 'Empezamos con camisetas de fútbol, pasamos por osos de Kanye, y ahora camisetas de artistas. Vendemos en Vinted y Wallapop. Cada drop es único.'
        },
        telegram: { title: 'Únete a Telegram', desc: 'Novedades, descuentos y drops exclusivos.', link: 'https://t.me/+gOPcalQ283ZmMjdk' },
        shirtsTitle: 'Camisetas de Artistas',
        shirts: [
          { id: 'travis-scott', name: 'Travis Scott', price: '19.99', oldPrice: '24.99', img: 'https://files.catbox.moe/jebq36.jpg', desc: 'Silueta con collage de álbumes', vinted1: 'https://vinted.com/items/7129804695', vinted2: 'https://vinted.com/items/7129752813', wallapop: 'https://wallapop.com/item/abc123', photos: ['https://files.catbox.moe/jebq36.jpg'], size: 'M', pdf: 'https://files.catbox.moe/u93uht.pdf' }
        ],
        discounts: { oldPrice: '24.99', newPrice: '19.99', validCodes: ['M4S1T','BURRO','DROP003'], title: 'Código de Descuento', desc: 'Ingresa tu código para el drop #003' },
        footer: { year: '2025', ig: 'https://instagram.com/topvibeess', tt: 'https://tiktok.com/@topvibeess', yt: 'https://youtube.com/@topvibeess' }
      };

      await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initialData)]);
      const html = generateSiteHTML(initialData);
      await updateGitHubPages(html);
      console.log('index.html generado por primera vez');
    }
  } catch (err) {
    console.error('Error initDatabase:', err);
  }
}

// === API: GET DATOS ===
app.get('/api/data', async (req, res) => {
  try {
    const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
    res.json(rows[0]?.data || {});
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// === UPDATE + DEPLOY ===
async function updateSection(updateFn, res) {
  try {
    const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
    const current = rows[0]?.data || {};
    const updated = updateFn(current);
    await client.query('INSERT INTO site_data (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1', [JSON.stringify(updated)]);
    const html = generateSiteHTML(updated);
    await updateGitHubPages(html);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
}

// === RUTAS ===
app.post('/api/update-hero', (req, res) => updateSection(c => ({ ...c, hero: req.body.hero }), res));
app.post('/api/update-about', (req, res) => updateSection(c => ({ ...c, about: req.body.about }), res));
app.post('/api/update-telegram', (req, res) => updateSection(c => ({ ...c, telegram: req.body.telegram }), res));
app.post('/api/update-shirts', (req, res) => updateSection(c => ({ ...c, shirtsTitle: req.body.shirtsTitle, shirts: req.body.shirts }), res));
app.post('/api/update-discounts', (req, res) => updateSection(c => ({ ...c, discounts: req.body.discounts }), res));
app.post('/api/update-footer', (req, res) => updateSection(c => ({ ...c, footer: req.body.footer }), res));

// === RUTA NUEVA: GUARDAR TODO ===
app.post('/api/update-all', (req, res) => updateSection(() => req.body, res));

// === INICIAR EN PUERTO 8080 ===
app.listen(PORT, async () => {
  await initDatabase();
  console.log(`TOPVIBES backend ON → puerto ${PORT}`);
  console.log(`Panel → https://${OWNER}.github.io/${REPO}/admin.html`);
  console.log(`Sitio → https://${OWNER}.github.io/${REPO}`);
});
