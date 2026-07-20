/**
 * app/api/revalidate/route.ts
 *
 * Strapi webhook endpoint → triggers ISR revalidation of the homepage.
 *
 * Strapi Webhook config (Settings → Webhooks → Add):
 *   URL:     https://portfolio.yourdomain.com/api/revalidate
 *   Header:  x-revalidate-secret: <your REVALIDATE_SECRET value>
 *   Events:  All Entry.* events (create, update, delete, publish, unpublish)
 */

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');

  if (!process.env.REVALIDATE_SECRET) {
    console.error('[revalidate] REVALIDATE_SECRET env var is not set.');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Revalidate the homepage (where all portfolio data is consumed)
    revalidatePath('/');

    const body = await req.json().catch(() => ({}));
    console.log(
      `[revalidate] Homepage revalidated. Triggered by Strapi event:`,
      body?.event ?? 'unknown'
    );

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[revalidate] Revalidation failed:', err);
    return NextResponse.json(
      { error: 'Revalidation failed', detail: String(err) },
      { status: 500 }
    );
  }
}
