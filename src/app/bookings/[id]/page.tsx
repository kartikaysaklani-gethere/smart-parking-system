'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Booking } from '@/lib/types';
import { formatINR, formatDate } from '@/lib/utils';
import { generateQRCodeDataURL } from '@/lib/qr';
import { toast } from 'sonner';
import {
  QrCode,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car,
  User,
  Phone,
  ArrowLeft,
  Share2,
} from 'lucide-react';

export default function BookingDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadBooking() {
      try {
        const res = await fetch(`/api/bookings/${id}`);
        if (!res.ok) throw new Error('Booking not found');
        const data = await res.json();
        setBooking(data.booking);

        if (data.booking.qr_token) {
          const url = await generateQRCodeDataURL(data.booking.qr_token);
          setQrDataUrl(url);
        }
      } catch (err: unknown) {
        toast.error('Could not load booking details.');
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [id]);

  const handleDownloadPNG = () => {
    if (!qrDataUrl || !booking) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `ParkSmart-QR-${booking.slot_code}-${booking.vehicle_number}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR Code downloaded!');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#0F9D9A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Loading your cryptographic parking pass...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Booking Not Found</h2>
        <p className="text-xs text-slate-500">The requested reservation does not exist.</p>
        <Link href="/bookings" className="inline-block px-4 py-2 bg-[#0F9D9A] text-white rounded-xl text-xs font-bold">
          Back to Bookings
        </Link>
      </div>
    );
  }

  // Timeline steps
  const steps = [
    { label: 'Reserved', time: booking.created_at, done: true },
    {
      label: 'Checked In (Gate)',
      time: booking.checked_in_at,
      done: Boolean(booking.checked_in_at || booking.status === 'active' || booking.status === 'completed'),
    },
    {
      label: 'Parked at Slot',
      time: null,
      done: booking.status === 'active' || booking.status === 'completed',
    },
    {
      label: 'Completed',
      time: booking.checked_out_at,
      done: booking.status === 'completed',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 print:p-0 print:m-0 print:max-w-none">
      {/* Back button */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#0B2545] dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Reservations</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPNG}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4 text-[#0F9D9A]" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4 text-blue-500" />
            <span>Print Pass</span>
          </button>
        </div>
      </div>

      {/* Main Ticket Card (Pass) */}
      <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-none">
        {/* Ticket Header Banner */}
        <div className="bg-gradient-to-r from-[#0B2545] to-[#0F9D9A] text-white p-6 sm:p-8 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#5eead4] block">
              Official Entry Pass
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
              Slot {booking.slot_code}
            </h1>
            <p className="text-xs text-slate-200 mt-1">
              {booking.slot_code.startsWith('G') ? 'Ground Floor (Level 0)' : '1st Floor (Level 1)'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-200 block">Total Tariff:</span>
            <span className="text-2xl font-black text-white">{formatINR(booking.amount)}</span>
            <span className="text-[11px] text-slate-200 block">
              {booking.hours} hr{booking.hours > 1 ? 's' : ''} pre-paid
            </span>
          </div>
        </div>

        {/* QR Code Presentation */}
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
          <div className="p-4 rounded-3xl bg-white dark:bg-white shadow-md border-4 border-slate-200/60 dark:border-slate-700">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Booking Signed QR"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-slate-300 animate-pulse" />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Cryptographically Signed (HMAC-SHA256)</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
            Present this QR to the gate kiosk webcam on arrival. ESP32 gate servo and slot guidance LEDs will activate automatically.
          </p>
        </div>

        {/* Timeline Status */}
        <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Reservation Timeline
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl border text-xs ${
                  step.done
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${step.done ? 'text-emerald-600' : 'text-slate-300'}`}
                  />
                  <span>{step.label}</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {step.time ? new Date(step.time).toLocaleTimeString() : step.done ? 'In Progress' : 'Pending'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-2 sm:grid-cols-3 gap-5 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Driver Name</span>
            <span className="font-bold text-slate-800 dark:text-white text-sm">{booking.driver_name}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Phone Number</span>
            <span className="font-bold text-slate-800 dark:text-white text-sm">{booking.phone}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Vehicle Plate</span>
            <span className="font-bold text-[#0F9D9A] text-sm tracking-wider uppercase">
              {booking.vehicle_number}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Vehicle Make & Color</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {booking.car_model || 'Standard'} {booking.car_color ? `(${booking.car_color})` : ''}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Start Schedule</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDate(booking.start_time)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Booking ID</span>
            <span className="font-mono text-[11px] text-slate-500 truncate block">
              {booking.id.slice(0, 13)}...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
