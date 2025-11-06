// server.js - Versión FINAL 100% FUNCIONAL con PostgreSQL
// Tablas se crean SOLAS, datos iniciales se insertan SOLOS
// Actualiza GitHub Pages automáticamente
// Todo en RAÍZ del repo topvibes

const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// === POSTGRESQL ===
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

client.connect()
  .then(() => console.log('Conectado a PostgreSQL'))
  .catch(err => console.error('Error conectando a DB:', err));

// === GITHUB ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'index.html';

// === PLANTILLA ===
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
let siteTemplate = '';
try {
  siteTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  console.log('template.html cargado');
} catch (err) {
  console.error('ERROR: template.html no encontrado en la raíz');
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
  r('COPYRIGHT_YEAR', data.footer?.year);
  r('IG_LINK', data.footer?.ig);
  r('TT_LINK', data.footer?.tt);
  r('YT_LINK', data.footer?.yt);
  return html;
}

// === SUBIR A GITHUB ===
async function updateGitHubPages(html) {
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: FILE_PATH, branch: BRANCH });
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: FILE_PATH, message: `Update - ${new Date().toISOString()}`,
      content: Buffer.from(html).toString('base64'), sha: data.sha, branch: BRANCH
    });
    console.log('index.html actualizado en GitHub');
  } catch (err) {
    if (err.status === 404) {
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: FILE_PATH, message: `Create index.html - ${new Date().toISOString()}`,
        content: Buffer.from(html).toString('base64'), branch: BRANCH
      });
      console.log('index.html creado en GitHub');
    } else {
      console.error('GitHub Error:', err.message);
    }
  }
}

// === INICIALIZAR DB + TABLA + DATOS (SE CREA SOLA) ===
async function initDatabase() {
  try {
    // Crea tabla SOLA
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_data (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'
      )
    `);
    console.log('Tabla site_data verificada/creada');

    // Verifica si hay datos
    const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
    if (rows.length === 0) {
      console.log('No hay datos → insertando iniciales...');
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
          // Añade el resto tú en el panel
        ],
        discounts: { oldPrice: '24.99', newPrice: '19.99', validCodes: ['M4S1T','BURRO','DROP003'], title: 'Código de Descuento', desc: 'Ingresa tu código para el drop #003' },
        footer: { year: '2025', ig: 'https://instagram.com/topvibeess', tt: 'https://tiktok.com/@topvibeess', yt: 'https://youtube.com/@topvibeess' }
      };

      await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initialData)]);
      console.log('Datos iniciales insertados');

      const html = generateSiteHTML(initialData);
      await updateGitHubPages(html);
      console.log('index.html generado por primera vez');
    } else {
      console.log('Datos ya existen → listo');
    }
  } catch (err) {
    console.error('Error en initDatabase:', err);
  }
}

// === API: GET DATOS ===
app.get('/api/data', async (req, res) => {
  try {
    const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
    res.json(rows[0]?.data || {});
  } catch (err) {
    console.error('GET error:', err);
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
    console.error('Update error:', err);
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

// === INICIAR ===
app.listen(PORT, async () => {
  await initDatabase();
  console.log(`TOPVIBES backend ON en puerto ${PORT}`);
  console.log(`Panel → https://${OWNER}.github.io/${REPO}/admin.html`);
  console.log(`Sitio → https://${OWNER}.github.io/${REPO}`);
});
