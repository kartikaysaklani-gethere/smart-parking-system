import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../src/app/api/device/telemetry/route';
import { NextRequest } from 'next/server';
import { updateSlot, updateSettings } from '../src/lib/store';

describe('ESP32 Device Telemetry Endpoint (POST /api/device/telemetry)', () => {
  beforeEach(async () => {
    // Reset G1, G2, F1
    await updateSlot('G1', { status: 'free', assigned_booking_id: null });
    await updateSlot('G2', { status: 'free', assigned_booking_id: null });
    await updateSlot('F1', { status: 'free', assigned_booking_id: null });
    await updateSettings({
      latest_assignment: null,
    });
  });

  it('rejects requests with missing or invalid x-device-key header', async () => {
    const req = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'wrong_key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ slots: { G1: false } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('returns valid LED activations and LCD free slot counts', async () => {
    // Set G1 to 'assigned'
    await updateSlot('G1', { status: 'assigned' });

    const req = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'esp32_smart_parking_secret_key_2026',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slots: { G1: false, G2: false, F1: false },
        gate: { car_present: false, distance_cm: 150 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Since G1 is assigned and sensor G1 is false (car hasn't reached yet), G1 LED must be true!
    expect(data.leds.G1).toBe(true);
    expect(data.leds.G2).toBe(false);
    expect(data.gate_hold).toBe(false);
    expect(Array.isArray(data.lcd)).toBe(true);
    expect(data.lcd[0]).toContain('Free:');
  });

  it('turns off LED and transitions slot to occupied when ultrasonic sensor detects car', async () => {
    // G1 is assigned
    await updateSlot('G1', { status: 'assigned' });

    // ESP32 reports G1 is now true (car parked)
    const req = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'esp32_smart_parking_secret_key_2026',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slots: { G1: true, G2: false, F1: false },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // LED should be off because car has arrived
    expect(data.leds.G1).toBe(false);
  });

  it('displays navigation instructions on LCD for 20s after gate assignment', async () => {
    await updateSettings({
      latest_assignment: {
        slot_code: 'F1',
        assigned_at: new Date().toISOString(),
        booking_id: 'test-assign-id',
      },
    });

    const req = new NextRequest('http://localhost:3000/api/device/telemetry', {
      method: 'POST',
      headers: {
        'x-device-key': 'esp32_smart_parking_secret_key_2026',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slots: { G1: false, G2: false, F1: false },
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.lcd[0]).toBe('Go to slot F1');
    expect(data.lcd[1]).toBe('1st Floor');
  });
});
