import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, getSlots, updateSlot, updateSettings, createBooking } from '@/lib/store';
import { SlotId } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, isWalkIn, walkInData } = body;

    let targetBookingId = bookingId;
    let assignedSlotCode: SlotId;

    if (isWalkIn) {
      // Walk-in booking creation
      if (!walkInData || !walkInData.slot_code || !walkInData.vehicle_number) {
        return NextResponse.json(
          { error: 'Walk-in details (slot_code, vehicle_number, driver_name) are required.' },
          { status: 400 }
        );
      }

      assignedSlotCode = walkInData.slot_code;

      const newBooking = await createBooking({
        slot_code: assignedSlotCode,
        driver_name: walkInData.driver_name || 'Walk-In Guest',
        phone: walkInData.phone || '9999999999',
        vehicle_number: walkInData.vehicle_number,
        car_model: walkInData.car_model || 'Standard',
        car_color: walkInData.car_color || 'Default',
        start_time: new Date().toISOString(),
        hours: walkInData.hours || 1,
        walk_in: true,
      });

      targetBookingId = newBooking.id;
    } else {
      // Pre-booked reservation
      if (!targetBookingId) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      const booking = await getBookingById(targetBookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return NextResponse.json(
          { error: `Cannot check in. Booking status is '${booking.status}'.` },
          { status: 400 }
        );
      }

      assignedSlotCode = booking.slot_code;
    }

    // Assign slot: Set status to 'assigned', link assigned_booking_id
    const slot = await updateSlot(assignedSlotCode, {
      status: 'assigned',
      assigned_booking_id: targetBookingId,
    });

    // Update booking check-in timestamp and status
    const updatedBooking = await updateBooking(targetBookingId, {
      checked_in_at: new Date().toISOString(),
      status: 'active',
    });

    // Notify ESP32 via settings latest_assignment for LED & LCD navigation
    await updateSettings({
      latest_assignment: {
        slot_code: assignedSlotCode,
        assigned_at: new Date().toISOString(),
        booking_id: targetBookingId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Car checked in. Navigate to Slot ${assignedSlotCode} (${slot.floor === 0 ? 'Ground Floor' : '1st Floor'}).`,
      slot,
      booking: updatedBooking,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
