import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncLan } from '@/lib/sync.js';

export async function POST(_req, props) {
  const params = await props.params;
  const lanId = Number(params.id);
  if (!lanId) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const res = await syncLan(lanId);
    revalidatePath(`/lan/${lanId}`, 'layout');
    revalidatePath('/');
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
