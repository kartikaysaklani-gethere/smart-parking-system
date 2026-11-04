import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getBookingById } from '@/lib/store';
import { generateSignedQRToken } from '@/lib/qr';

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

    let token = booking.qr_token;
    if (!token) {
      token = generateSignedQRToken({
        bookingId: booking.id,
        driverName: booking.driver_name,
        phone: booking.phone,
        vehicleNumber: booking.vehicle_number,
        carModel: booking.car_model,
        carColor: booking.car_color,
        slotCode: booking.slot_code,
        startTime: booking.start_time,
        hours: booking.hours,
        amount: booking.amount,
        issuedAt: new Date(booking.created_at).getTime(),
      });
      booking.qr_token = token;
    }

    const pngBuffer = await QRCode.toBuffer(token, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: {
        dark: '#0B2545',
        light: '#FFFFFF',
      },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate QR code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
