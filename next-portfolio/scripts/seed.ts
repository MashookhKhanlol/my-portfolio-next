/**
 * scripts/seed.ts
 *
 * One-time migration script: reads data.json and POSTs all content
 * into a running Strapi instance via the REST API.
 *
 * Prerequisites:
 *   1. Strapi is running (npm run dev)
 *   2. You have created an API token in Strapi Admin:
 *      Settings → API Tokens → Create new token (Full access)
 *   3. Set STRAPI_URL and STRAPI_TOKEN below (or via env vars)
 *
 * Usage:
 *   cd next-portfolio
 *   npx ts-node scripts/seed.ts
 *   # OR
 *   STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=xxx npx ts-node scripts/seed.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || 'YOUR_STRAPI_API_TOKEN_HERE';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_TOKEN}`,
};

async function post(endpoint: string, body: object) {
  const res = await fetch(`${STRAPI_URL}/api${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ POST ${endpoint} failed [${res.status}]:`, err);
    return null;
  }
  const json = await res.json();
  console.log(`✅ POST ${endpoint} → id:${json.data?.id}`);
  return json;
}

async function put(endpoint: string, body: object) {
  const res = await fetch(`${STRAPI_URL}/api${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ PUT ${endpoint} failed [${res.status}]:`, err);
    return null;
  }
  const json = await res.json();
  console.log(`✅ PUT ${endpoint}`);
  return json;
}

async function main() {
  const dataPath = path.join(__dirname, '..', 'data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw);

  console.log('\n🌱 Starting Strapi seed from data.json...\n');

  // ── 1. Global (single type) ────────────────────────────────────────────────
  console.log('--- Global ---');
  await put('/global', {
    name:               data.main.name,
    shortDesc:          data.main.shortDesc,
    heroImageUrl:       data.main.heroImage,
    aboutImageUrl:      data.about.aboutImage,
    aboutImageCaption:  data.about.aboutImageCaption,
    aboutTitle:         data.about.title,
    about:              data.about.about,
    callUrl:            data.about.callUrl,
    resumeUrl:          data.about.resumeUrl,
  });

  // ── 2. Titles ──────────────────────────────────────────────────────────────
  console.log('\n--- Titles ---');
  for (let i = 0; i < data.main.titles.length; i++) {
    await post('/titles', { text: data.main.titles[i], order: i });
  }

  // ── 3. Tech Stack Images ───────────────────────────────────────────────────
  console.log('\n--- Tech Stack Images ---');
  for (let i = 0; i < data.main.techStackImages.length; i++) {
    await post('/tech-stack-images', { url: data.main.techStackImages[i], order: i });
  }

  // ── 4. Socials ─────────────────────────────────────────────────────────────
  console.log('\n--- Socials ---');
  for (let i = 0; i < data.socials.length; i++) {
    await post('/socials', { ...data.socials[i], order: i });
  }

  // ── 5. Skills ──────────────────────────────────────────────────────────────
  console.log('\n--- Skills ---');
  for (const skill of data.skills) {
    await post('/skills', skill);
  }

  // ── 6. Projects ────────────────────────────────────────────────────────────
  console.log('\n--- Projects ---');
  for (let i = 0; i < data.projects.length; i++) {
    const p = data.projects[i];
    await post('/projects', {
      name:       p.name,
      techstack:  p.techstack,
      category:   p.category,
      duration:   p.duration,
      imageUrl:   p.image,
      desc:       p.desc,
      codeLink:   p.links?.code   || '',
      videoLink:  p.links?.video  || '',
      visitLink:  p.links?.visit  || '',
      order:      i,
    });
  }

  // ── 7. Education ───────────────────────────────────────────────────────────
  console.log('\n--- Educations ---');
  for (let i = 0; i < data.educations.length; i++) {
    const e = data.educations[i];
    await post('/educations', {
      institute: e.institute,
      degree:    e.degree,
      duration:  e.duration,
      desc:      e.desc || null,
      order:     i,
    });
  }

  // ── 8. Experiences ─────────────────────────────────────────────────────────
  console.log('\n--- Experiences ---');
  for (let i = 0; i < data.experiences.length; i++) {
    const e = data.experiences[i];
    await post('/experiences', {
      company:  e.company,
      position: e.position,
      duration: e.duration,
      desc:     e.desc || null,
      order:    i,
    });
  }

  console.log('\n🎉 Seed complete! All data.json content has been migrated to Strapi.\n');
  console.log('Next: Go to Strapi Admin → Settings → Roles → Public');
  console.log('      Enable "find" and "findOne" for ALL content types above.\n');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
