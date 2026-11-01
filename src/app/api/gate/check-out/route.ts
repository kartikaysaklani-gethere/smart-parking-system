import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, getBookings, updateSlot, getSettings, getSlotById } from '@/lib/store';
import { calculateCheckoutFee } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, vehicleNumber, slotCode } = body;

    let targetBooking = null;

    if (bookingId) {
      targetBooking = await getBookingById(bookingId);
    } else if (slotCode) {
      const slot = await getSlotById(slotCode);
      if (slot && slot.assigned_booking_id) {
        targetBooking = await getBookingById(slot.assigned_booking_id);
      }
    } else if (vehicleNumber) {
      const all = await getBookings();
      targetBooking = all.find(
        (b) =>
          b.vehicle_number.toUpperCase().replace(/\s+/g, '') ===
            vehicleNumber.toUpperCase().replace(/\s+/g, '') &&
          (b.status === 'active' || b.status === 'booked')
      );
    }

    if (!targetBooking) {
      return NextResponse.json(
        { error: 'No active booking found matching the provided criteria.' },
        { status: 404 }
      );
    }

    if (targetBooking.status === 'completed') {
      return NextResponse.json(
        { error: 'Booking has already been checked out.' },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    const rate = settings.price_per_hour;

    const checkInTime = targetBooking.checked_in_at || targetBooking.start_time;
    const checkOutTime = new Date().toISOString();

    const feeBreakdown = calculateCheckoutFee(
      checkInTime,
      checkOutTime,
      rate,
      targetBooking.walk_in ? undefined : targetBooking.hours,
      targetBooking.walk_in ? undefined : targetBooking.amount
    );

    // Update booking to completed
    const updatedBooking = await updateBooking(targetBooking.id, {
      status: 'completed',
      checked_out_at: checkOutTime,
      amount: feeBreakdown.amount,
    });

    // Release slot
    const slot = await getSlotById(targetBooking.slot_code);
    if (slot && (slot.assigned_booking_id === targetBooking.id || slot.id !== 'G3')) {
      await updateSlot(targetBooking.slot_code, {
        status: 'free',
        assigned_booking_id: null,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Vehicle checked out successfully.',
      booking: updatedBooking,
      feeBreakdown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
