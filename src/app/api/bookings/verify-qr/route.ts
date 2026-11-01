import { NextRequest, NextResponse } from 'next/server';
import { verifySignedQRToken } from '@/lib/qr';
import { getBookingById } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'No QR token provided for verification.' },
        { status: 400 }
      );
    }

    // 1. Verify Cryptographic HMAC Signature
    const verification = verifySignedQRToken(token);
    if (!verification.valid || !verification.data) {
      return NextResponse.json(
        { valid: false, error: verification.error || 'Cryptographic signature validation failed. Tampered or corrupt QR code.' },
        { status: 400 }
      );
    }

    const tokenData = verification.data;

    // 2. Fetch live booking status from store/db
    const booking = await getBookingById(tokenData.bookingId);
    if (!booking) {
      return NextResponse.json(
        { valid: false, error: `Booking ID '${tokenData.bookingId}' does not exist in the database.` },
        { status: 404 }
      );
    }

    // 3. Status checks
    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { valid: false, error: 'This booking has been cancelled by the driver.', booking, tokenData },
        { status: 400 }
      );
    }

    if (booking.status === 'completed') {
      return NextResponse.json(
        { valid: false, error: 'This booking has already been completed and checked out.', booking, tokenData },
        { status: 400 }
      );
    }

    if (booking.status === 'expired' || booking.status === 'no_show') {
      return NextResponse.json(
        { valid: false, error: 'This booking has expired (Driver marked as No Show).', booking, tokenData },
        { status: 400 }
      );
    }

    // Check expiry before check-in (30 mins after start time without showing up)
    const startTimeMs = new Date(booking.start_time).getTime();
    const nowMs = Date.now();
    if (booking.status === 'booked' && nowMs > startTimeMs + 30 * 60 * 1000) {
      return NextResponse.json(
        { valid: false, error: 'Booking expired: Driver did not arrive within 30 minutes of start time.', booking, tokenData },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      booking,
      tokenData,
      message: 'QR code verified successfully. Valid for entry.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'QR verification error';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
