import { NextRequest, NextResponse } from 'next/server';
import { getSlots, updateSlot } from '@/lib/store';
import { SlotId, SlotStatus } from '@/lib/types';

export async function GET() {
  try {
    const slots = await getSlots();
    return NextResponse.json({ slots });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch slots';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Slot ID is required' }, { status: 400 });
    }

    const updated = await updateSlot(id as SlotId, {
      ...(status ? { status: status as SlotStatus } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });

    return NextResponse.json({ success: true, slot: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update slot';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
