import { describe, it, expect, beforeEach } from 'vitest';
import { generateSignedQRToken, verifySignedQRToken } from '../src/lib/qr';
import { calculatePreBookedAmount, calculateCheckoutFee } from '../src/lib/pricing';
import {
  createBooking,
  getSlots,
  updateSlot,
  getBookingById,
  cancelBooking,
  getSettings,
  updateSettings,
} from '../src/lib/store';
import { QRPayloadData, SlotId } from '../src/lib/types';

describe('QR Code Generation & Cryptographic Verification', () => {
  const sampleData: QRPayloadData = {
    bookingId: 'test-uuid-1234',
    driverName: 'Vikram Malhotra',
    phone: '+91 98765 00000',
    vehicleNumber: 'MH 01 AB 9999',
    carModel: 'Honda City',
    carColor: 'White',
    slotCode: 'G1',
    startTime: new Date().toISOString(),
    hours: 2,
    amount: 80,
    issuedAt: Date.now(),
  };

  it('generates a valid signed QR token that passes verification', () => {
    const token = generateSignedQRToken(sampleData);
    expect(typeof token).toBe('string');
    expect(token.includes('.')).toBe(true);

    const verification = verifySignedQRToken(token);
    expect(verification.valid).toBe(true);
    expect(verification.data?.bookingId).toBe('test-uuid-1234');
    expect(verification.data?.vehicleNumber).toBe('MH 01 AB 9999');
    expect(verification.data?.slotCode).toBe('G1');
  });

  it('rejects a tampered token where payload has been modified', () => {
    const token = generateSignedQRToken(sampleData);
    const [payloadBase64, signature] = token.split('.');

    // Modify payload (e.g. change hours or slot)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...sampleData, slotCode: 'F1', amount: 0 })
    ).toString('base64url');

    const tamperedToken = `${tamperedPayload}.${signature}`;
    const verification = verifySignedQRToken(tamperedToken);

    expect(verification.valid).toBe(false);
    expect(verification.error).toContain('tampered');
  });

  it('rejects an invalid or malformed token string', () => {
    expect(verifySignedQRToken('').valid).toBe(false);
    expect(verifySignedQRToken('malformed_token_without_dot').valid).toBe(false);
    expect(verifySignedQRToken('abc.def').valid).toBe(false);
  });
});

describe('Pricing Engine & Hourly Rounding Rules', () => {
  it('correctly calculates pre-booked rate for given hours', () => {
    expect(calculatePreBookedAmount(1, 40)).toBe(40);
    expect(calculatePreBookedAmount(3, 40)).toBe(120);
    expect(calculatePreBookedAmount(5, 50)).toBe(250);
  });

  it('rounds up walk-in durations correctly to the next full hour (minimum 1 hour)', () => {
    const base = new Date('2026-11-01T10:00:00Z');

    // 15 minutes stayed -> billed 1 hour
    const exit15m = new Date('2026-11-01T10:15:00Z');
    const fee15m = calculateCheckoutFee(base, exit15m, 40);
    expect(fee15m.durationMinutes).toBe(15);
    expect(fee15m.billedHours).toBe(1);
    expect(fee15m.amount).toBe(40);

    // 60 minutes stayed -> billed 1 hour
    const exit60m = new Date('2026-11-01T11:00:00Z');
    const fee60m = calculateCheckoutFee(base, exit60m, 40);
    expect(fee60m.billedHours).toBe(1);
    expect(fee60m.amount).toBe(40);

    // 65 minutes stayed -> billed 2 hours
    const exit65m = new Date('2026-11-01T11:05:00Z');
    const fee65m = calculateCheckoutFee(base, exit65m, 40);
    expect(fee65m.durationMinutes).toBe(65);
    expect(fee65m.billedHours).toBe(2);
    expect(fee65m.amount).toBe(80);
  });

  it('computes overstay penalty for pre-booked sessions exceeding allotted time', () => {
    const checkIn = new Date('2026-11-01T10:00:00Z');
    // Pre-booked for 2 hours (₹80), but leaves after 3 hours 15 minutes (billed 4 hours)
    const checkOut = new Date('2026-11-01T13:15:00Z');
    const fee = calculateCheckoutFee(checkIn, checkOut, 40, 2, 80);

    expect(fee.billedHours).toBe(4);
    expect(fee.overstayHours).toBe(2);
    expect(fee.overstayFee).toBe(80);
    expect(fee.amount).toBe(160);
  });
});

describe('Slot Booking Overlap & Concurrency Safeguards', () => {
  beforeEach(async () => {
    // Reset G1 to free
    await updateSlot('G1', { status: 'free', assigned_booking_id: null });
  });

  it('successfully creates a booking for a free slot', async () => {
    const startTime = new Date('2026-11-10T10:00:00Z').toISOString();
    const booking = await createBooking({
      slot_code: 'G1',
      driver_name: 'Rahul Sen',
      phone: '9876543210',
      vehicle_number: 'KA 01 XY 1111',
      start_time: startTime,
      hours: 2,
    });

    expect(booking.id).toBeDefined();
    expect(booking.slot_code).toBe('G1');
    expect(booking.amount).toBe(80);
  });

  it('rejects an overlapping booking request on the same slot', async () => {
    const startTime = new Date('2026-11-11T14:00:00Z').toISOString();

    // First booking: 14:00 to 16:00
    await createBooking({
      slot_code: 'G1',
      driver_name: 'Driver A',
      phone: '9876543210',
      vehicle_number: 'KA 01 XY 2222',
      start_time: startTime,
      hours: 2,
    });

    // Conflicting booking: 15:00 to 17:00 (overlaps by 1 hr)
    const overlapStart = new Date('2026-11-11T15:00:00Z').toISOString();
    await expect(
      createBooking({
        slot_code: 'G1',
        driver_name: 'Driver B',
        phone: '9876543210',
        vehicle_number: 'KA 01 XY 3333',
        start_time: overlapStart,
        hours: 2,
      })
    ).rejects.toThrow(/already booked/);
  });

  it('allows non-overlapping booking immediately following an existing booking', async () => {
    const start1 = new Date('2026-11-12T08:00:00Z').toISOString();
    await createBooking({
      slot_code: 'G1',
      driver_name: 'Morning Driver',
      phone: '9876543210',
      vehicle_number: 'KA 01 XY 4444',
      start_time: start1,
      hours: 2, // 08:00 - 10:00
    });

    // Starts at 10:00 (exact boundary)
    const start2 = new Date('2026-11-12T10:00:00Z').toISOString();
    const secondBooking = await createBooking({
      slot_code: 'G1',
      driver_name: 'Midday Driver',
      phone: '9876543210',
      vehicle_number: 'KA 01 XY 5555',
      start_time: start2,
      hours: 2, // 10:00 - 12:00
    });

    expect(secondBooking.id).toBeDefined();
    expect(secondBooking.slot_code).toBe('G1');
  });

  it('prevents booking maintenance slots or dummy occupied slots', async () => {
    await updateSlot('G1', { status: 'maintenance' });

    await expect(
      createBooking({
        slot_code: 'G1',
        driver_name: 'Driver C',
        phone: '9876543210',
        vehicle_number: 'KA 01 XY 6666',
        start_time: new Date().toISOString(),
        hours: 1,
      })
    ).rejects.toThrow(/maintenance/);

    // G3 is dummy occupied
    await expect(
      createBooking({
        slot_code: 'G3',
        driver_name: 'Driver D',
        phone: '9876543210',
        vehicle_number: 'KA 01 XY 7777',
        start_time: new Date().toISOString(),
        hours: 1,
      })
    ).rejects.toThrow(/dummy occupied/);
  });
});
