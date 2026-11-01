import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSlots, updateSlot, getSettings, updateSettings, recordTelemetry, getBookingById, updateBooking } from '@/lib/store';
import { SlotId, TelemetryResponse } from '@/lib/types';

const DeviceTelemetrySchema = z.object({
  slots: z
    .object({
      G1: z.boolean().optional(),
      G2: z.boolean().optional(),
      F1: z.boolean().optional(),
    })
    .catchall(z.boolean())
    .default({}),
  gate: z
    .object({
      car_present: z.boolean().optional(),
      distance_cm: z.number().optional(),
    })
    .optional(),
});

// Simple in-memory rate limiting (max 10 requests per second)
let lastRequestTime = 0;
let requestCount = 0;

export async function POST(req: NextRequest) {
  try {
    // 1. Device Key Authentication
    const providedKey = req.headers.get('x-device-key');
    const expectedKey = process.env.DEVICE_API_KEY || 'esp32_smart_parking_secret_key_2026';

    if (!providedKey || providedKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing x-device-key header.' },
        { status: 401 }
      );
    }

    // Rate limiting check
    const nowMs = Date.now();
    if (nowMs - lastRequestTime < 1000) {
      requestCount++;
      if (requestCount > 20) {
        return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
      }
    } else {
      lastRequestTime = nowMs;
      requestCount = 1;
    }

    // 2. Validate Request Body
    const jsonBody = await req.json();
    const parseResult = DeviceTelemetrySchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid telemetry payload schema', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    // 3. Record Telemetry in Log & Heartbeat
    await recordTelemetry(payload);

    // 4. Update Slot Status based on Sensor Readings
    const currentSlots = await getSlots();
    const sensorSlotIds: SlotId[] = ['G1', 'G2', 'F1'];

    for (const slotId of sensorSlotIds) {
      const isSensorOccupied = payload.slots[slotId];
      if (isSensorOccupied === undefined) continue;

      const currentSlot = currentSlots.find((s) => s.id === slotId);
      if (!currentSlot) continue;

      if (isSensorOccupied) {
        // Car arrived at slot!
        if (currentSlot.status !== 'occupied') {
          await updateSlot(slotId, {
            status: 'occupied',
          });

          // If there is an assigned booking, update booking status to 'active'
          if (currentSlot.assigned_booking_id) {
            const booking = await getBookingById(currentSlot.assigned_booking_id);
            if (booking && booking.status !== 'completed' && booking.status !== 'cancelled') {
              await updateBooking(booking.id, {
                status: 'active',
                checked_in_at: booking.checked_in_at || new Date().toISOString(),
              });
            }
          }
        }
      } else {
        // Sensor reports free
        if (currentSlot.status === 'occupied') {
          // Car has physically left slot
          await updateSlot(slotId, {
            status: 'free',
            assigned_booking_id: null,
          });
        }
      }
    }

    // Refresh slots after sensor updates
    const updatedSlots = await getSlots();
    const settings = await getSettings();

    // 5. Compute LED Outputs
    // Rule: An LED is true ONLY for a slot that is currently assigned and not yet occupied.
    const leds: Record<string, boolean> = {
      G1: false,
      G2: false,
      F1: false,
    };

    for (const slotId of sensorSlotIds) {
      const s = updatedSlots.find((item) => item.id === slotId);
      const sensorSaysOccupied = Boolean(payload.slots[slotId]);
      leds[slotId] = Boolean(s && s.status === 'assigned' && !sensorSaysOccupied);
    }

    // 6. Compute LCD Display Lines (16x2)
    // Rule: Show latest assignment for 20 seconds, otherwise "Free: n/6" and floor-wise count; "PARKING FULL" when 0 free.
    let lcdLine1 = '';
    let lcdLine2 = '';

    const latestAssignment = settings.latest_assignment;
    const isRecentAssignment =
      latestAssignment &&
      nowMs - new Date(latestAssignment.assigned_at).getTime() <= 20000;

    if (isRecentAssignment) {
      const targetSlot = updatedSlots.find((s) => s.id === latestAssignment.slot_code);
      lcdLine1 = `Go to slot ${latestAssignment.slot_code}`.slice(0, 16);
      lcdLine2 = targetSlot?.floor === 1 ? '1st Floor' : 'Ground Floor';
    } else {
      const groundFree = updatedSlots.filter((s) => s.floor === 0 && s.status === 'free').length;
      const firstFree = updatedSlots.filter((s) => s.floor === 1 && s.status === 'free').length;
      const totalFree = groundFree + firstFree;

      if (totalFree === 0) {
        lcdLine1 = 'PARKING FULL';
        lcdLine2 = 'Please Wait';
      } else {
        lcdLine1 = `Free: ${totalFree}/6`;
        lcdLine2 = `G:${groundFree}  F:${firstFree}`;
      }
    }

    const gateHold = Boolean(payload.gate?.car_present);

    const responsePayload: TelemetryResponse = {
      leds: {
        G1: leds.G1,
        G2: leds.G2,
        F1: leds.F1,
      },
      lcd: [lcdLine1, lcdLine2],
      gate_hold: gateHold,
      server_time: new Date().toISOString(),
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Telemetry server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
