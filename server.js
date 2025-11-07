// server.js - FINAL 100% FUNCIONAL
// → index.html está en RAÍZ del proyecto (Railway)
// → Backend lo lee → reemplaza → sube a GitHub Pages

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
const TEMPLATE_PATH = path.join(__dirname, 'index.html'); // ← EN RAÍZ

// === LEER index.html CADA VEZ ===
function loadTemplate() {
  try {
    const content = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    console.log(`index.html cargado desde proyecto (longitud: ${content.length})`);
    return content;
  } catch (err) {
    console.error('ERROR: index.html NO encontrado en:', TEMPLATE_PATH);
    return '<h1>ERROR: index.html no existe en el proyecto</h1>';
  }
}

// === GENERAR HTML ===
function generateSiteHTML(data) {
  let html = loadTemplate();

  const r = (k, v) => {
    html = html.replace(new RegExp(`{{${k}}}`, 'g'), v || '');
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

// === SUBIR A GITHUB PAGES ===
async function updateGitHubPages(html) {
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: FILE_PATH, branch: BRANCH });
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: FILE_PATH,
      message: `Update - ${new Date().toISOString()}`,
      content: Buffer.from(html).toString('base64'),
      sha: data.sha,
      branch: BRANCH
    });
    console.log('index.html SUBIDO a GitHub Pages');
  } catch (err) {
    console.error('GitHub error:', err.message);
  }
}

// === INIT DB ===
async function initDatabase() {
  await client.query(`CREATE TABLE IF NOT EXISTS site_data (id SERIAL PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}')`);
  const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
  if (rows.length === 0) {
    const initial = { hero: { title: 'DROP #003' }, about: {}, telegram: {}, shirtsTitle: '', shirts: [], discounts: {}, footer: {} };
    await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initial)]);
    await updateGitHubPages(generateSiteHTML(initial));
  }
}

app.get('/api/data', async (req, res) => {
  const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
  res.json(rows[0]?.data || {});
});

async function updateSection(fn, res) {
  const { rows } = await client.query('SELECT data FROM site_data WHERE id = 1');
  const updated = fn(rows[0]?.data || {});
  await client.query('INSERT INTO site_data (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1', [JSON.stringify(updated)]);
  await updateGitHubPages(generateSiteHTML(updated));
  res.json({ status: 'ok' });
}

app.post('/api/update-all', (req, res) => updateSection(() => req.body, res));

app.listen(PORT, async () => {
  await initDatabase();
  console.log(`Backend ON → https://topvibes-production.up.railway.app`);
});
