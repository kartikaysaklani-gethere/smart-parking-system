import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBookings, createBooking } from '@/lib/store';
import { SlotId } from '@/lib/types';

const CreateBookingSchema = z.object({
  user_id: z.string().nullable().optional(),
  slot_code: z.enum(['G1', 'G2', 'G3', 'F1', 'F2', 'F3']),
  driver_name: z.string().min(2, 'Driver name must be at least 2 characters'),
  phone: z.string().min(7, 'Phone number must be at least 7 characters'),
  vehicle_number: z.string().min(3, 'Vehicle number is required'),
  car_model: z.string().optional(),
  car_color: z.string().optional(),
  start_time: z.string().datetime({ message: 'Invalid ISO date string' }),
  hours: z.number().int().min(1, 'Minimum 1 hour').max(24, 'Maximum 24 hours'),
  amount: z.number().optional(),
  walk_in: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    const bookings = await getBookings(userId);
    return NextResponse.json({ bookings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch bookings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = CreateBookingSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parse.error.format() },
        { status: 400 }
      );
    }

    const booking = await createBooking({
      ...parse.data,
      slot_code: parse.data.slot_code as SlotId,
    });

    return NextResponse.json({ success: true, booking }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Booking creation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
