import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as deviceTelemetryPOST } from '../src/app/api/device/telemetry/route';
import { POST as verifyQrPOST } from '../src/app/api/bookings/verify-qr/route';
import { POST as gateCheckInPOST } from '../src/app/api/gate/check-in/route';
import { POST as gateCheckOutPOST } from '../src/app/api/gate/check-out/route';
import { createBooking, getSlotById, updateSlot, getBookingById, updateSettings } from '../src/lib/store';

describe('Complete End-to-End System Journey (Book -> QR -> Gate Scan -> LED/LCD -> Occupied -> Leave -> Checkout)', () => {
  beforeEach(async () => {
    // Reset G1
    await updateSlot('G1', { status: 'free', assigned_booking_id: null });
    await updateSettings({ latest_assignment: null });
  });

  it('executes full hardware & booking cycle flawlessly', async () => {
    // STEP 1: Driver books slot G1 online
    const startTime = new Date().toISOString();
    const booking = await createBooking({
      slot_code: 'G1',
      driver_name: 'Ananya Roy',
      phone: '+91 98888 77777',
      vehicle_number: 'KA 03 MN 4567',
      car_model: 'Tata Nexon EV',
      car_color: 'Teal Blue',
      start_time: startTime,
      hours: 2,
      amount: 80,
    });

    expect(booking.id).toBeDefined();
    expect(booking.status).toBe('booked');
    expect(booking.qr_token).toBeDefined();

    // STEP 2: Driver arrives at gate; Gate webcam scans the QR token
    const verifyReq = new NextRequest('http://localhost:3000/api/bookings/verify-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: booking.qr_token }),
    });

    const verifyRes = await verifyQrPOST(verifyReq);
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.valid).toBe(true);
    expect(verifyData.booking.driver_name).toBe('Ananya Roy');
    expect(verifyData.booking.vehicle_number).toBe('KA 03 MN 4567');

    // STEP 3: Gate staff presses "Confirm Entry" -> Servo opens, assigns slot
    const checkInReq = new NextRequest('http://localhost:3000/api/gate/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.id, isWalkIn: false }),
    });

    const checkInRes = await gateCheckInPOST(checkInReq);
    expect(checkInRes.status).toBe(200);
    const checkInData = await checkInRes.json();
    expect(checkInData.success).toBe(true);

    // Slot should now be 'assigned'
    const slotAfterCheckIn = await getSlotById('G1');
    expect(slotAfterCheckIn?.status).toBe('assigned');

    // STEP 4: ESP32 pings telemetry API -> LED G1 must turn ON, LCD shows navigation
    const esp32Req1 = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'esp32_smart_parking_secret_key_2026',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slots: { G1: false, G2: false, F1: false },
        gate: { car_present: true, distance_cm: 10 },
      }),
    });

    const esp32Res1 = await deviceTelemetryPOST(esp32Req1);
    expect(esp32Res1.status).toBe(200);
    const esp32Data1 = await esp32Res1.json();

    // Verification of Hardware commands:
    expect(esp32Data1.leds.G1).toBe(true); // Slot G1 LED turned ON!
    expect(esp32Data1.lcd[0]).toBe('Go to slot G1'); // LCD Navigation line 1!
    expect(esp32Data1.lcd[1]).toBe('Ground Floor'); // LCD Navigation line 2!
    expect(esp32Data1.gate_hold).toBe(true); // Gate held open for car!

    // STEP 5: Car reaches slot G1; Ultrasonic sensor detects distance < threshold (occupied = true)
    const esp32Req2 = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'esp32_smart_parking_secret_key_2026',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slots: { G1: true, G2: false, F1: false },
        gate: { car_present: false, distance_cm: 150 },
      }),
    });

    const esp32Res2 = await deviceTelemetryPOST(esp32Req2);
    expect(esp32Res2.status).toBe(200);
    const esp32Data2 = await esp32Res2.json();

    // LED turns OFF because car has arrived
    expect(esp32Data2.leds.G1).toBe(false);

    // Slot status in database is now 'occupied'
    const slotAfterParked = await getSlotById('G1');
    expect(slotAfterParked?.status).toBe('occupied');

    // STEP 6: Car leaves slot; Ultrasonic sensor reports slot is now empty (false)
    const esp32Req3 = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'esp32_smart_parking_secret_key_2026',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slots: { G1: false, G2: false, F1: false },
      }),
    });

    const esp32Res3 = await deviceTelemetryPOST(esp32Req3);
    expect(esp32Res3.status).toBe(200);

    // Slot status becomes 'free' again
    const slotAfterDeparture = await getSlotById('G1');
    expect(slotAfterDeparture?.status).toBe('free');

    // STEP 7: Exit Gate Check-out
    const checkOutReq = new NextRequest('http://localhost:3000/api/gate/check-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const checkOutRes = await gateCheckOutPOST(checkOutReq);
    expect(checkOutRes.status).toBe(200);
    const checkOutData = await checkOutRes.json();
    expect(checkOutData.success).toBe(true);

    const finalizedBooking = await getBookingById(booking.id);
    expect(finalizedBooking?.status).toBe('completed');
    expect(finalizedBooking?.checked_out_at).toBeDefined();
  });
});
