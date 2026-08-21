import { get, put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function userId() { const session = await auth.api.getSession({ headers: await headers() }); return session?.user?.id }
export async function POST(request: NextRequest) {
  const id = await userId(); if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await request.formData(); const file = data.get('file'); const category = String(data.get('category') ?? 'files')
  if (!(file instanceof File) || file.size > 1024 * 1024 * 1024) return NextResponse.json({ error: 'Geçersiz veya çok büyük dosya' }, { status: 400 })
  if (!['mods','backups','configs'].includes(category)) return NextResponse.json({ error: 'Geçersiz kategori' }, { status: 400 })
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const blob = await put(`${id}/${category}/${crypto.randomUUID()}-${safeName}`, file, { access: 'private', addRandomSuffix: false })
  return NextResponse.json({ pathname: blob.pathname })
}
export async function GET(request: NextRequest) {
  const id = await userId(); if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pathname = request.nextUrl.searchParams.get('pathname')
  if (!pathname?.startsWith(`${id}/`)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await get(pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') ?? undefined })
  if (!result) return new NextResponse('Not found', { status: 404 })
  if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
  return new NextResponse(result.stream, { headers: { 'Content-Type': result.blob.contentType, ETag: result.blob.etag, 'Cache-Control': 'private, no-cache', 'Content-Disposition': `attachment; filename="${pathname.split('/').pop()}"` } })
}
