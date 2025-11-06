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

// Postgres
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
client.connect();

// GitHub
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'index.html';

// Plantilla
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
let siteTemplate = fs.existsSync(TEMPLATE_PATH) ? fs.readFileSync(TEMPLATE_PATH, 'utf-8') : '';

// Función generar HTML
function generateSiteHTML(data) {
  let html = siteTemplate;
  const replace = (key, value) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
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
  replace('COPYRIGHT_YEAR', data.footer?.year);
  replace('IG_LINK', data.footer?.ig);
  replace('TT_LINK', data.footer?.tt);
  replace('YT_LINK', data.footer?.yt);
  return html;
}

// Subir a GitHub
async function updateGitHubPages(html) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER, repo: REPO, path: FILE_PATH, branch: BRANCH
    });
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: FILE_PATH, message: `Update site - ${new Date().toISOString()}`,
      content: Buffer.from(html).toString('base64'), sha: data.sha, branch: BRANCH
    });
  } catch (err) {
    if (err.status === 404) {
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: FILE_PATH, message: `Create index.html - ${new Date().toISOString()}`,
        content: Buffer.from(html).toString('base64'), branch: BRANCH
      });
    } else {
      console.error('GitHub Error:', err);
    }
  }
}

// Inicializar DB y datos
async function initData() {
  await client.query(`CREATE TABLE IF NOT EXISTS site_data (id SERIAL PRIMARY KEY, data JSONB)`);
  const res = await client.query('SELECT data FROM site_data WHERE id = 1');
  if (res.rows.length === 0) {
    const initialData = {
      hero: { title: 'DROP #003: CAMISETAS DE ARTISTAS', desc: 'Camisetas únicas inspiradas en artistas como Travis Scott, Kanye West y Quevedo, perfectas para fans del streetwear.' },
      about: { title: '¿Qué es TOPVIBES?', desc1: 'TOPVIBES es una marca que lanza drops diferentes, sin encasillarse en un solo estilo. Nos inspiramos en la música, el deporte y todo lo que forma parte de la cultura actual. No buscamos vender por vender, sino soltar cosas que realmente nos molan y que conectan con la gente.', desc2: 'Empezamos con camisetas de fútbol de jugadores como Messi, Neymar y CR7, después sacamos una colección de osos basada en el álbum Graduation de Kanye West, y ahora presentamos un drop de camisetas únicas inspiradas en artistas como Travis Scott, Playboi Carti, Quevedo, Kendrick Lamar, Drake y Kanye West.Vendemos a través de Vinted y Wallapop, pero esto es solo el principio. Cada drop es distinto al anterior, y siempre estamos preparando algo nuevo.' },
      telegram: { title: 'Únete a Nuestra Comunidad en Telegram', desc: '¿Quieres ser el primero en enterarte de los próximos drops, descuentos exclusivos y novedades de TOPVIBES? ¡Únete a nuestro grupo de Telegram y forma parte de la comunidad!', link: 'https://t.me/+gOPcalQ283ZmMjdk' },
      shirtsTitle: 'Camisetas de Artistas',
      shirts: [
        { id: 'travis-scott', name: 'Travis Scott', price: '19.99', oldPrice: '24.99', img: 'https://files.catbox.moe/jebq36.jpg', desc: 'Destaca tu estilo urbano con esta camiseta negra que presenta un estampado frontal único: la silueta de la cabeza de Travis Scott, rellena con un collage de sus distintos álbumes. Una prenda que fusiona arte y música, ideal para los fans del hip-hop y la moda contemporánea que buscan un diseño original y llamativo.', vinted1: 'https://vinted.com/items/7129804695-camiseta-travis-scott-negra-top-vibes', vinted2: 'https://vinted.com/items/7129752813-camiseta-travis-scott-inspiradas-en-los-albumes-camiseta-rapero-merch', wallapop: 'https://wallapop.com/item/camiseta-travis-scott-inspirada-en-albumes-1177538052', photos: ['https://files.catbox.moe/jebq36.jpg', 'https://files.catbox.moe/ax2bgv.jpg', 'https://files.catbox.moe/gjrrk1.jpg'], size: 'M', pdf: 'https://files.catbox.moe/u93uht.pdf' },
        // ... (añade las otras 5 camisetas como en el código anterior)
      ],
      discounts: { oldPrice: '24.99', newPrice: '19.99', validCodes: ['M4S1T', 'BURRO', 'YOTAMBIENVIVOELDROP', 'D307', 'DROP003', 'SPRINT', 'TOP10', 'VIP2025', '#DROP003VIENEDURO', 'TOPVIBES25', 'CAST', 'INFLUENCERS', 'CHAPARRO', 'M7D5Z'], title: 'Canjea tu Código de Descuento', desc: 'Ingresa tu código exclusivo para el Drop #003 y completa el formulario para recibir tu descuento.' },
      footer: { year: '2025', ig: 'https://www.instagram.com/topvibeess/', tt: 'https://www.tiktok.com/@topvibeess', yt: 'https://youtube.com/@topvibeess' }
    };
    await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [initialData]);
    const html = generateSiteHTML(initialData);
    await updateGitHubPages(html);
  }
}

// API: Obtener datos
app.get('/api/data', async (req, res) => {
  const result = await client.query('SELECT data FROM site_data WHERE id = 1');
  res.json(result.rows[0]?.data || {});
});

// Función update + deploy
async function updateAndDeploy(updateData, res) {
  await client.query('UPDATE site_data SET data = $1 WHERE id = 1', [updateData]);
  const result = await client.query('SELECT data FROM site_data WHERE id = 1');
  const data = result.rows[0].data;
  const html = generateSiteHTML(data);
  await updateGitHubPages(html);
  res.json({ status: 'ok' });
}

// Rutas update
app.post('/api/update-hero', async (req, res) => {
  const data = await client.query('SELECT data FROM site_data WHERE id = 1');
  const current = data.rows[0].data;
  const updated = { ...current, hero: req.body.hero };
  await updateAndDeploy(updated, res);
});

app.post('/api/update-about', async (req, res) => {
  const data = await client.query('SELECT data FROM site_data WHERE id = 1');
  const current = data.rows[0].data;
  const updated = { ...current, about: req.body.about };
  await updateAndDeploy(updated, res);
});

app.post('/api/update-telegram', async (req, res) => {
  const data = await client.query('SELECT data FROM site_data WHERE id = 1');
  const current = data.rows[0].data;
  const updated = { ...current, telegram: req.body.telegram };
  await updateAndDeploy(updated, res);
});

app.post('/api/update-shirts', async (req, res) => {
  const data = await client.query('SELECT data FROM site_data WHERE id = 1');
  const current = data.rows[0].data;
  const updated = { ...current, shirtsTitle: req.body.shirtsTitle, shirts: req.body.shirts };
  await updateAndDeploy(updated, res);
});

app.post('/api/update-discounts', async (req, res) => {
  const data = await client.query('SELECT data FROM site_data WHERE id = 1');
  const current = data.rows[0].data;
  const updated = { ...current, discounts: req.body.discounts };
  await updateAndDeploy(updated, res);
});

app.post('/api/update-footer', async (req, res) => {
  const data = await client.query('SELECT data FROM site_data WHERE id = 1');
  const current = data.rows[0].data;
  const updated = { ...current, footer: req.body.footer };
  await updateAndDeploy(updated, res);
});

// Iniciar
app.listen(PORT, async () => {
  await initData();
  console.log(`Backend en puerto ${PORT}`);
});
