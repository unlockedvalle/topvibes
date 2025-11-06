// server.js - FINAL 100% FUNCIONAL
// → RECARGA index.html CADA VEZ
// → Reemplaza TODOS los {{PLACEHOLDERS}}
// → Admin carga + guarda + actualiza GitHub Pages

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
  .then(() => console.log('DB conectada'))
  .catch(err => console.error('Error DB:', err));

// === GITHUB ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'index.html';
const TEMPLATE_PATH = path.join(__dirname, 'index.html');

// === RECARGAR PLANTILLA CADA VEZ ===
async function loadTemplate() {
  try {
    return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  } catch (err) {
    console.error('ERROR: index.html no encontrado en la raíz');
    return '<h1>ERROR: index.html no existe</h1>';
  }
}

// === GENERAR HTML (recarga plantilla) ===
async function generateSiteHTML(data) {
  let html = await loadTemplate();
  const r = (k, v) => {
    const regex = new RegExp(`{{${k}}}`, 'g');
    html = html.replace(regex, v || '');
  };
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

// === ACTUALIZAR GITHUB PAGES ===
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
    console.log('index.html actualizado en GitHub');
  } catch (err) {
    console.error('GitHub error:', err.message);
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
          { id: 'travis-scott', name: 'Travis Scott', price: '19.99', img: 'https://files.catbox.moe/jebq36.jpg', desc: 'Silueta con collage', photos: [], size: 'M', pdf: 'https://files.catbox.moe/u93uht.pdf' }
        ],
        discounts: { title: 'Código de Descuento', desc: 'Ingresa tu código', validCodes: ['DROP003'], newPrice: '19.99' },
        footer: { year: '2025', ig: 'https://instagram.com/topvibeess', tt: 'https://tiktok.com/@topvibeess', yt: 'https://youtube.com/@topvibeess' }
      };
      await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initialData)]);
      const html = await generateSiteHTML(initialData);
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
    const html = await generateSiteHTML(updated);
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
