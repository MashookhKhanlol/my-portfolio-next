/**
 * lib/strapi.ts
 * Strapi REST API client for the portfolio.
 * Transforms Strapi's nested response shape into the flat data.json shape
 * that all existing components already consume.
 */

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

// ---------------------------------------------------------------------------
// Generic fetcher with ISR revalidation
// ---------------------------------------------------------------------------
export async function fetchStrapi<T = any>(
  path: string,
  revalidate = 60
): Promise<T> {
  const res = await fetch(`${STRAPI_URL}/api${path}`, {
    next: { revalidate },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(
      `Strapi fetch failed [${path}]: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts the URL from a Strapi media field (single image). */
function mediaUrl(field: any): string {
  return field?.data?.attributes?.url ?? '';
}

/** Extracts plain attributes array from a Strapi collection response. */
function attrs<T>(response: any): T[] {
  return (response?.data ?? []).map((item: any) => ({
    id: item.id,
    ...item.attributes,
  }));
}

// ---------------------------------------------------------------------------
// Per-section fetchers
// ---------------------------------------------------------------------------

async function fetchGlobal() {
  return fetchStrapi('/global?populate[heroImage]=*&populate[aboutImage]=*');
}

async function fetchTitles() {
  return fetchStrapi('/titles?sort=order:asc');
}

async function fetchTechStack() {
  return fetchStrapi('/tech-stack-images?sort=order:asc');
}

async function fetchSocials() {
  return fetchStrapi('/socials?sort=order:asc');
}

async function fetchSkills() {
  return fetchStrapi('/skills?sort=name:asc&pagination[limit]=100');
}

async function fetchProjects() {
  return fetchStrapi('/projects?populate[image]=*&sort=order:asc&pagination[limit]=100');
}

async function fetchEducations() {
  return fetchStrapi('/educations?sort=order:asc');
}

async function fetchExperiences() {
  return fetchStrapi('/experiences?sort=order:asc');
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

  const g = globalRes?.data?.attributes ?? {};

  // -- main section --
  const main = {
    name: g.name ?? '',
    shortDesc: g.shortDesc ?? '',
    titles: attrs<{ text: string }>(titlesRes).map((t) => t.text),
    heroImage: mediaUrl(g.heroImage) || g.heroImageUrl || '',
    techStackImages: attrs<{ url: string }>(techStackRes).map((t) => t.url),
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
  const socials = attrs<{ icon: string; link: string }>(socialsRes).map(
    ({ icon, link }) => ({ icon, link })
  );

  // -- skills --
  const skills = attrs<{ name: string; image: string; category: string }>(
    skillsRes
  ).map(({ name, image, category }) => ({ name, image, category }));

  // -- projects --
  const projects = attrs<any>(projectsRes).map((p) => ({
    name: p.name ?? '',
    techstack: p.techstack ?? '',
    category: p.category ?? '',
    duration: p.duration ?? '',
    // image: prefer Cloudinary-uploaded media, fall back to imageUrl text field
    image: mediaUrl(p.image) || p.imageUrl || '',
    desc: p.desc ?? '',
    links: {
      code: p.codeLink ?? '',
      video: p.videoLink ?? '',
      visit: p.visitLink ?? '',
    },
  }));

  // -- educations --
  const educations = attrs<any>(educationsRes).map((e) => ({
    institute: e.institute ?? '',
    degree: e.degree ?? '',
    duration: e.duration ?? '',
    desc: e.desc ?? undefined,
  }));

  // -- experiences --
  const experiences = attrs<any>(experiencesRes).map((e) => ({
    company: e.company ?? '',
    position: e.position ?? '',
    duration: e.duration ?? '',
    desc: e.desc ?? [],
  }));

  return { main, about, socials, skills, projects, educations, experiences };
}
