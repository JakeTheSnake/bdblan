import { NextResponse } from 'next/server';
import { syncHeroes } from '@/lib/sync.js';

export async function POST() {
  try {
    const n = await syncHeroes();
    return NextResponse.json({ heroes: n });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
