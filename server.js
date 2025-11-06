// server.js - Backend en Railway con PostgreSQL + GitHub Pages auto-deploy
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
client.connect().catch(err => console.error('DB Connection error:', err));

// === GITHUB ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'index.html';

// === PLANTILLA ===
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
let siteTemplate = '';
if (fs.existsSync(TEMPLATE_PATH)) {
  siteTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
} else {
  console.error('template.html no encontrado');
}

// === GENERAR HTML ===
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

// === SUBIR A GITHUB PAGES ===
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
  } catch (err) {
    if (err.status === 404) {
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: FILE_PATH,
        message: `Create index.html - ${new Date().toISOString()}`,
        content: Buffer.from(html).toString('base64'),
        branch: BRANCH
      });
    } else {
      console.error('GitHub API Error:', err.message);
    }
  }
}

// === INICIALIZAR DB + DATOS ===
async function initData() {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_data (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);

    const res = await client.query('SELECT data FROM site_data WHERE id = 1');
    if (res.rows.length === 0) {
      const initialData = {
        hero: { title: 'DROP #003: CAMISETAS DE ARTISTAS', desc: 'Camisetas únicas inspiradas en artistas como Travis Scott, Kanye West y Quevedo, perfectas para fans del streetwear.' },
        about: {
          title: '¿Qué es TOPVIBES?',
          desc1: 'TOPVIBES es una marca que lanza drops diferentes, sin encasillarse en un solo estilo. Nos inspiramos en la música, el deporte y todo lo que forma parte de la cultura actual. No buscamos vender por vender, sino soltar cosas que realmente nos molan y que conectan con la gente.',
          desc2: 'Empezamos con camisetas de fútbol de jugadores como Messi, Neymar y CR7, después sacamos una colección de osos basada en el álbum Graduation de Kanye West, y ahora presentamos un drop de camisetas únicas inspiradas en artistas como Travis Scott, Playboi Carti, Quevedo, Kendrick Lamar, Drake y Kanye West. Vendemos a través de Vinted y Wallapop, pero esto es solo el principio. Cada drop es distinto al anterior, y siempre estamos preparando algo nuevo.'
        },
        telegram: { title: 'Únete a Nuestra Comunidad en Telegram', desc: '¿Quieres ser el primero en enterarte de los próximos drops, descuentos exclusivos y novedades de TOPVIBES? ¡Únete a nuestro grupo de Telegram y forma parte de la comunidad!', link: 'https://t.me/+gOPcalQ283ZmMjdk' },
        shirtsTitle: 'Camisetas de Artistas',
        shirts: [
          {
            id: 'travis-scott',
            name: 'Travis Scott',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/jebq36.jpg',
            desc: 'Destaca tu estilo urbano con esta camiseta negra que presenta un estampado frontal único: la silueta de la cabeza de Travis Scott, rellena con un collage de sus distintos álbumes. Una prenda que fusiona arte y música, ideal para los fans del hip-hop y la moda contemporánea que buscan un diseño original y llamativo.',
            vinted1: 'https://vinted.com/items/7129804695-camiseta-travis-scott-negra-top-vibes',
            vinted2: 'https://vinted.com/items/7129752813-camiseta-travis-scott-inspiradas-en-los-albumes-camiseta-rapero-merch',
            wallapop: 'https://wallapop.com/item/camiseta-travis-scott-inspirada-en-albumes-1177538052',
            photos: ['https://files.catbox.moe/jebq36.jpg', 'https://files.catbox.moe/ax2bgv.jpg', 'https://files.catbox.moe/gjrrk1.jpg'],
            size: 'M',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          },
          {
            id: 'kanye-west',
            name: 'Kanye West',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/n9gr3b.jpg',
            desc: 'Añade un aire icónico a tu armario con esta camiseta inspirada en Kanye West. El diseño presenta una silueta minimalista de su rostro, combinada con elementos gráficos de sus álbumes más representativos. Perfecta para los amantes del rap y el streetwear que buscan una pieza única y con personalidad.',
            vinted1: 'https://vinted.com/items/7129862787-camiseta-kanye-west-negra-top-vibes',
            vinted2: 'https://vinted.com/items/7129981776-camiseta-kanye-west-inspirada-en-albumes-camiseta-rapero',
            wallapop: 'https://wallapop.com/item/camiseta-kanye-west-inspirada-en-albumes-1177538053',
            photos: ['https://files.catbox.moe/n9gr3b.jpg'],
            size: 'M',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          },
          {
            id: 'quevedo',
            name: 'Quevedo',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/mq4dbc.jpg',
            desc: 'Dale un giro urbano a tu estilo con esta camiseta inspirada en Quevedo. El diseño captura la esencia del artista con un estampado frontal que combina su logo y elementos de sus éxitos más virales. Ideal para fans del reggaetón y la música latina que quieren llevar el flow en su ropa.',
            vinted1: 'https://vinted.com/items/7129833371-camiseta-quevedo-negra-top-vibes',
            vinted2: 'https://vinted.com/items/7130620834-camiseta-quevedo-inspirada-en-canciones-camiseta-rapero',
            wallapop: 'https://wallapop.com/item/camiseta-quevedo-inspirada-en-canciones-1177538054',
            photos: ['https://files.catbox.moe/mq4dbc.jpg'],
            size: 'L',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          },
          {
            id: 'playboi-carti',
            name: 'Playboi Carti',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/ghb8e4.jpg',
            desc: 'Añade un toque vanguardista a tu outfit con esta camiseta inspirada en Playboi Carti. El diseño destaca por su estética experimental, con gráficos abstractos y tipografías distorsionadas que reflejan el estilo único del artista. Perfecta para quienes buscan destacar en la escena del trap y la moda alternativa.',
            vinted1: 'https://vinted.com/items/7129847714-camiseta-playboi-carti-negra-top-vibes',
            vinted2: 'https://vinted.com/items/7130320619-camiseta-playboi-carti-inspirada-en-albumes-camiseta-rapero',
            wallapop: 'https://wallapop.com/item/camiseta-playboi-carti-inspirada-en-albumes-1177538055',
            photos: ['https://files.catbox.moe/ghb8e4.jpg'],
            size: 'L',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          },
          {
            id: 'kendrick-lamar',
            name: 'Kendrick Lamar',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/sa521h.jpg',
            desc: 'Añade un toque distintivo a tu estilo con esta camiseta inspirada en Kendrick Lamar. El diseño presenta una composición artística que combina su silueta con frases icónicas de sus letras, creando una pieza que no solo es moda, sino también un homenaje al rap consciente y la cultura hip-hop.',
            vinted1: 'https://vinted.com/items/7129831487-camiseta-kendrick-lamar-negra-top-vibes',
            vinted2: 'https://vinted.com/items/7130241869-camiseta-kendrick-lamar-inspirada-en-letras-camiseta-rapero',
            wallapop: 'https://wallapop.com/item/camiseta-kendrick-lamar-inspirada-en-letras-1177538056',
            photos: ['https://files.catbox.moe/sa521h.jpg'],
            size: 'M',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          },
          {
            id: 'drake',
            name: 'Drake',
            price: '19.99',
            oldPrice: '24.99',
            img: 'https://files.catbox.moe/3b9llp.jpg',
            desc: 'Eleva tu estilo con esta camiseta inspirada en Drake. El diseño captura la esencia del artista con un estampado que mezcla su logo OVO con elementos de sus álbumes más exitosos. Una prenda imprescindible para fans del rap melódico y la moda urbana que buscan un look sofisticado y actual.',
            vinted1: 'https://vinted.com/items/7129822256-camiseta-drake-negra-top-vibes',
            vinted2: 'https://vinted.com/items/7130074286-camiseta-drake-inspirada-en-albumes-camiseta-rapero',
            wallapop: 'https://wallapop.com/item/camiseta-drake-inspirada-en-albumes-1177538057',
            photos: ['https://files.catbox.moe/3b9llp.jpg'],
            size: 'M',
            pdf: 'https://files.catbox.moe/u93uht.pdf'
          }
        ],
        discounts: {
          oldPrice: '24.99',
          newPrice: '19.99',
          validCodes: ['M4S1T', 'BURRO', 'YOTAMBIENVIVOELDROP', 'D307', 'DROP003', 'SPRINT', 'TOP10', 'VIP2025', '#DROP003VIENEDURO', 'TOPVIBES25', 'CAST', 'INFLUENCERS', 'CHAPARRO', 'M7D5Z'],
          title: 'Canjea tu Código de Descuento',
          desc: 'Ingresa tu código exclusivo para el Drop #003 y completa el formulario para recibir tu descuento.'
        },
        footer: { year: '2025', ig: 'https://www.instagram.com/topvibeess/', tt: 'https://www.tiktok.com/@topvibeess', yt: 'https://youtube.com/@topvibeess' }
      };
      await client.query('INSERT INTO site_data (id, data) VALUES (1, $1)', [JSON.stringify(initialData)]);
      const html = generateSiteHTML(initialData);
      await updateGitHubPages(html);
      console.log('Datos iniciales creados y index.html generado');
    }
  } catch (err) {
    console.error('Error en initData:', err);
  }
}

// === API: OBTENER DATOS ===
app.get('/api/data', async (req, res) => {
  try {
    const result = await client.query('SELECT data FROM site_data WHERE id = 1');
    res.json(result.rows[0]?.data || {});
  } catch (err) {
    console.error('Error GET /api/data:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// === FUNCIÓN UPDATE + DEPLOY ===
async function updateAndDeploy(updateFn, res) {
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

// === RUTAS UPDATE ===
app.post('/api/update-hero', (req, res) => updateAndDeploy(current => ({ ...current, hero: req.body.hero }), res));
app.post('/api/update-about', (req, res) => updateAndDeploy(current => ({ ...current, about: req.body.about }), res));
app.post('/api/update-telegram', (req, res) => updateAndDeploy(current => ({ ...current, telegram: req.body.telegram }), res));
app.post('/api/update-shirts', (req, res) => updateAndDeploy(current => ({ ...current, shirtsTitle: req.body.shirtsTitle, shirts: req.body.shirts }), res));
app.post('/api/update-discounts', (req, res) => updateAndDeploy(current => ({ ...current, discounts: req.body.discounts }), res));
app.post('/api/update-footer', (req, res) => updateAndDeploy(current => ({ ...current, footer: req.body.footer }), res));

// === INICIAR SERVIDOR ===
app.listen(PORT, async () => {
  await initData();
  console.log(`Backend corriendo en puerto ${PORT}`);
  console.log(`Panel: https://${OWNER}.github.io/${REPO}/admin.html`);
  console.log(`Sitio: https://${OWNER}.github.io/${REPO}`);
});
