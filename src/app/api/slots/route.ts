import { NextRequest, NextResponse } from 'next/server';
import { getSlots, updateSlot } from '@/lib/store';
import { SlotId, SlotStatus } from '@/lib/types';

export async function GET() {
  try {
    let slots = await getSlots();

    // Local-to-Cloud Bridge: If ESP32 is pinging Vercel directly, sync sensor slot states to localhost
    try {
      const cloudRes = await fetch('https://smart-parking-system-ten-pearl.vercel.app/api/slots', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2000),
      });
      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        if (cloudData.slots && Array.isArray(cloudData.slots)) {
          for (const cs of cloudData.slots) {
            const localSlot = slots.find((s) => s.id === cs.id);
            if (localSlot && localSlot.type === 'sensor' && localSlot.status !== cs.status) {
              await updateSlot(cs.id as SlotId, { status: cs.status });
            }
          }
          slots = await getSlots();
        }
      }
    } catch {
      // Offline fallback
    }

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
