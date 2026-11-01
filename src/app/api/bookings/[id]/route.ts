import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, cancelBooking, updateBooking } from '@/lib/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ booking });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving booking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.action === 'cancel') {
      const cancelled = await cancelBooking(id);
      return NextResponse.json({ success: true, booking: cancelled });
    }

    const updated = await updateBooking(id, body);
    return NextResponse.json({ success: true, booking: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating booking';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
