import { NextRequest, NextResponse } from 'next/server';
import { getBookings, updateBooking, updateSlot, getSlotById } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'parking_cron_secret_cleanup_token';

    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron token' }, { status: 401 });
    }

    const bookings = await getBookings();
    const now = Date.now();
    let expiredCount = 0;

    for (const b of bookings) {
      if (b.status === 'booked') {
        const startTime = new Date(b.start_time).getTime();
        // If 30 minutes past start_time without check-in -> mark as no-show
        if (now > startTime + 30 * 60 * 1000) {
          await updateBooking(b.id, { status: 'no_show' });
          expiredCount++;

          // Release slot if bound
          const slot = await getSlotById(b.slot_code);
          if (slot && slot.assigned_booking_id === b.id && slot.status === 'booked') {
            await updateSlot(b.slot_code, {
              status: 'free',
              assigned_booking_id: null,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Expired ${expiredCount} no-show bookings.`,
      expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron cleanup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
