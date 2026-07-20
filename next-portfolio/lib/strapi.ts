/**
 * lib/strapi.ts
 * Strapi v5 REST API client for the portfolio.
 *
 * ⚠️  Strapi v5 breaking change vs v4:
 *     v4 response: { data: { id, attributes: { name, ... } } }
 *     v5 response: { data: { id, name, ... } }   ← flat, no "attributes" wrapper
 *
 * This client handles the v5 flat format.
 */

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL?.replace(/\/$/, '') ||
  'http://localhost:1337';

// ---------------------------------------------------------------------------
// Generic fetcher with ISR revalidation
// ---------------------------------------------------------------------------
export async function fetchStrapi<T = any>(
  path: string,
  revalidate = 60
): Promise<T | null> {
  try {
    const res = await fetch(`${STRAPI_URL}/api${path}`, {
      next: { revalidate },
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[Strapi] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }

    return res.json() as T;
  } catch (err) {
    console.warn(`[Strapi] fetch error for ${path}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Strapi v5 helpers
// ---------------------------------------------------------------------------

/** Extracts URL from a v5 media field (single image). */
function mediaUrl(field: any): string {
  // v5: field is { id, url, formats, ... } — flat object
  return field?.url ?? '';
}

/** Extracts items from a v5 collection response.
 *  v5: { data: [ { id, name, ... }, ... ], meta: { ... } }
 *  v4: { data: [ { id, attributes: { name, ... } } ], meta: { ... } }
 *  We handle both for safety.
 */
function items<T>(response: any): T[] {
  if (!response?.data) return [];
  return response.data.map((item: any) => {
    // v4 compat: if item has attributes, spread them
    if (item.attributes) return { id: item.id, ...item.attributes };
    // v5: already flat
    return item;
  });
}

/** Extracts a single-type entry from a v5 response.
 *  v5: { data: { id, name, ... } }
 *  v4: { data: { id, attributes: { name, ... } } }
 */
function single(response: any): any {
  if (!response?.data) return {};
  const d = response.data;
  if (d.attributes) return { id: d.id, ...d.attributes }; // v4 compat
  return d; // v5 flat
}

// ---------------------------------------------------------------------------
// Per-section fetchers
// ---------------------------------------------------------------------------

async function fetchGlobal() {
  // No populate needed — heroImageUrl/aboutImageUrl are plain text fields, not media relations
  return fetchStrapi('/global');
}

async function fetchTitles() {
  return fetchStrapi('/titles?sort=order:asc&pagination[limit]=50');
}

async function fetchTechStack() {
  return fetchStrapi('/tech-stack-images?sort=order:asc&pagination[limit]=50');
}

async function fetchSocials() {
  return fetchStrapi('/socials?sort=order:asc&pagination[limit]=50');
}

async function fetchSkills() {
  return fetchStrapi('/skills?sort=name:asc&pagination[limit]=200');
}

async function fetchProjects() {
  // No populate needed — imageUrl is a plain text field, not a Strapi media relation
  return fetchStrapi('/projects?sort=order:asc&pagination[limit]=100');
}

async function fetchEducations() {
  return fetchStrapi('/educations?sort=order:asc&pagination[limit]=50');
}

async function fetchExperiences() {
  return fetchStrapi('/experiences?sort=order:asc&pagination[limit]=50');
}

// ---------------------------------------------------------------------------
// Combined portfolio data fetcher
// Returns data in the EXACT same shape as data.json so no component changes needed
// ---------------------------------------------------------------------------
export async function getPortfolioData() {
  const [
    globalRes,
    titlesRes,
    techStackRes,
    socialsRes,
    skillsRes,
    projectsRes,
    educationsRes,
    experiencesRes,
  ] = await Promise.all([
    fetchGlobal(),
    fetchTitles(),
    fetchTechStack(),
    fetchSocials(),
    fetchSkills(),
    fetchProjects(),
    fetchEducations(),
    fetchExperiences(),
  ]);

  // Strapi v5: single type is flat
  const g = single(globalRes);

  // -- main section --
  const main = {
    name: g.name ?? '',
    shortDesc: g.shortDesc ?? '',
    titles: items<{ text: string }>(titlesRes).map((t) => t.text),
    heroImage: mediaUrl(g.heroImage) || g.heroImageUrl || '',
    techStackImages: items<{ url: string }>(techStackRes).map((t) => t.url),
  };

  // -- about section --
  const about = {
    aboutImage: mediaUrl(g.aboutImage) || g.aboutImageUrl || '',
    aboutImageCaption: g.aboutImageCaption ?? '',
    title: g.aboutTitle ?? '',
    about: g.about ?? '',
    callUrl: g.callUrl ?? '',
    resumeUrl: g.resumeUrl ?? '',
  };

  // -- socials --
  const socials = items<{ icon: string; link: string }>(socialsRes).map(
    ({ icon, link }) => ({ icon, link })
  );

  // -- skills --
  const skills = items<{ name: string; image: string; category: string }>(
    skillsRes
  ).map(({ name, image, category }) => ({ name, image, category }));

  // -- projects --
  const projects = items<any>(projectsRes).map((p) => ({
    name: p.name ?? '',
    techstack: p.techstack ?? '',
    category: p.category ?? '',
    duration: p.duration ?? '',
    image: mediaUrl(p.image) || p.imageUrl || '',
    desc: p.desc ?? '',
    links: {
      code: p.codeLink ?? '',
      video: p.videoLink ?? '',
      visit: p.visitLink ?? '',
    },
  }));

  // -- educations --
  const educations = items<any>(educationsRes).map((e) => ({
    institute: e.institute ?? '',
    degree: e.degree ?? '',
    duration: e.duration ?? '',
    desc: e.desc ?? undefined,
  }));

  // -- experiences --
  const experiences = items<any>(experiencesRes).map((e) => ({
    company: e.company ?? '',
    position: e.position ?? '',
    duration: e.duration ?? '',
    desc: e.desc ?? [],
  }));

  return { main, about, socials, skills, projects, educations, experiences };
}
