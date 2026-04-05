import { NextResponse } from 'next/server';
import { syncLan } from '@/lib/sync.js';

export async function POST(_req, { params }) {
  const lanId = Number(params.id);
  if (!lanId) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const res = await syncLan(lanId);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
