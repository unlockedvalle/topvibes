// server.js - FINAL 100% FUNCIONAL
// → LEE index.html del proyecto CADA VEZ
// → REEMPLAZA {{PLACEHOLDERS}} CORRECTAMENTE
// → GUARDA EN POSTGRESQL
// → ACTUALIZA GITHUB PAGES
// → ADMIN CARGA + GUARDA + FUNCIONA

const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;

// === POSTGRESQL ===
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

client.connect()
  .then(() => console.log('PostgreSQL conectado'))
  .catch(err => console.error('Error DB:', err));

// === GITHUB ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'index.html';
const TEMPLATE_PATH = path.join(__dirname, 'index.html');

// === RECARGAR index.html CADA VEZ ===
function loadTemplate() {
  try {
    const content = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    console.log(`index.html cargado (longitud: ${content.length} caracteres)`);
    return content;
  } catch (err) {
    console.error('ERROR: index.html NO encontrado en:', TEMPLATE_PATH);
    console.error('→ Sube index.html a la RAÍZ del repo');
    return '<h1>ERROR: index.html no existe</h1>';
  }
}

// === GENERAR HTML (reemplaza variables) ===
function generateSiteHTML(data) {
  let html = loadTemplate();

  const replace = (key, value) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value !== undefined && value !== null ? value : '');
  };

  replace('HERO_TITLE', data.hero?.title);
  replace('HERO_DESC', data.hero?.desc);
  replace('ABOUT_TITLE', data.about?.title);
  replace('ABOUT_DESC1', data.about?.desc1);
  replace('ABOUT_DESC2', data.about?.desc2);
  replace('TELEGRAM_TITLE', data.telegram?.title);
  replace('TELEGRAM_DESC', data.telegram?.desc);
  replace('TELEGRAM_LINK', data.telegram?.link);
  replace('SHIRTS_TITLE', data.shirtsTitle);
  replace('SHIRTS_DATA', JSON.stringify(data.shirts || []));
  replace('VALID_CODES', JSON.stringify(data.discounts?.validCodes || []));
  replace('NEW_PRICE', data.discounts?.newPrice);
  replace('DISCOUNTS_TITLE', data.discounts?.title);
  replace('DISCOUNTS_DESC', data.discounts?.desc);
  replace('COPYRIGHT_YEAR', data.footer?.year);
  replace('IG_LINK', data.footer?.ig);
  replace('TT_LINK', data.footer?.tt);
  replace('YT_LINK', data.footer?.yt);

  return html;
}

// === ACTUALIZAR GITHUB PAGES ===
async function updateGitHubPages(html) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: FILE_PATH,
      branch: BRANCH
    });

    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: FILE_PATH,
      message: `Update site - ${new Date().toISOString()}`,
      content: Buffer.from(html).toString('base64'),
      sha: data.sha,
      branch: BRANCH
    });

    console.log('index.html SUBIDO a GitHub Pages');
  } catch (err) {
    if (err.status === 404) {
      console.error('ERROR: index.html NO existe en GitHub. Crea uno manualmente.');
    } else {
      console.error('GitHub error:', err.message);
    }
  }
}

// === INICIALIZAR DB + DATOS ===
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
        hero: { title: 'DROP #003: CAMISETAS DE ARTISTAS', desc: 'Camisetas únicas inspiradas en artistas.' },
        about: { title: '¿Qué es TOPVIBES?', desc1: 'Marca de drops únicos.', desc2: 'Vendemos en Vinted y Wallapop.' },
        telegram: { title: 'Únete a Telegram', desc: 'Novedades y descuentos.', link: 'https://t.me/+gOPcalQ283ZmMjdk' },
        shirtsTitle: 'Camisetas de Artistas',
        shirts: [
          {
            id: 'travis-scott',
            name: 'Travis Scott',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/jebq36.jpg',
            desc: 'Silueta con collage',
            vinted1: 'https://vinted.com/items/7129804695',
            vinted2: 'https://vinted.com/items/7129752813',
            wallapop: 'https://wallapop.com/item/abc123',
            photos: ['https://files.catbox.moe/jebq36.jpg'],
            size: 'M',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          }
        ],
        discounts: { title: 'Canjea tu Código', desc: 'Ingresa tu código para el drop #003', validCodes: ['DROP003'], newPrice: '19.99' },
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

    // GUARDA EN DB
    await client.query(
      'INSERT INTO site_data (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(updated)]
    );
    console.log('Datos guardados en PostgreSQL');

    // GENERA Y SUBE
    const html = generateSiteHTML(updated);
    await updateGitHubPages(html);

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
}

app.post('/api/update-all', (req, res) => updateSection(() => req.body, res));

// === INICIAR ===
app.listen(PORT, async () => {
  await initDatabase();
  console.log(`Backend ON → https://topvibes-production.up.railway.app`);
  console.log(`Panel → https://${OWNER}.github.io/${REPO}/admin.html`);
  console.log(`Sitio → https://${OWNER}.github.io/${REPO}`);
});
