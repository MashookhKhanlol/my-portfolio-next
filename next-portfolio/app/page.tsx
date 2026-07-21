import { readFileSync } from 'fs'
import { join } from 'path'
import { FaNodeJs } from "react-icons/fa"
import HomePage from "./HomePage"
import { getPortfolioData } from '@/lib/strapi'

// Always render dynamically — Strapi updates must appear immediately
export const dynamic = 'force-dynamic'

async function getData() {
  // ── Priority 1: Strapi CMS (self-hosted) ─────────────────────────────────
  const strapiUrl = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL
  if (strapiUrl) {
    try {
      const strapiData = await getPortfolioData()
      // Guard: if Strapi connected but Global has no content yet, fall back
      // so the site doesn't render broken while content is being migrated.
      const hasContent = strapiData?.main?.name || strapiData?.projects?.length > 0
      if (hasContent) return strapiData
      console.warn('[getData] Strapi connected but no content yet — falling back to legacy source')
    } catch (err) {
      console.warn('[getData] Strapi unavailable — falling back to legacy source:', err)
    }
  }

  // ── Priority 2: Remote data.json URL (legacy NEXT_PUBLIC_DATA_URL) ────────
  const DATA_URL = process.env.NEXT_PUBLIC_DATA_URL
  if (DATA_URL) {
    const res = await fetch(DATA_URL, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }

  // ── Priority 3: Local data.json (default dev fallback) ────────────────────
  // Use fs.readFileSync so changes are picked up immediately in dev
  // without restarting the server.
  const filePath = join(process.cwd(), 'data.json')
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

export default async function page() {

  const data = await getData()

  return (
    <>
      {data ?
        <HomePage data={data} />
        :
        <div className='h-screen w-screen flex flex-col items-center justify-center gap-5 text-violet-600 fixed z-30 bg-gray-100 dark:bg-grey-900'>
          <FaNodeJs size={100} className='animate-pulse' />
          <p className='animate-pulse text-xl'>Loading...</p>
        </div>
      }
    </>
  )
}