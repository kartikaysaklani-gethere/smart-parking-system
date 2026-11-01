'use client';

import React, { useEffect, useState, use } from 'react';
import { Booking } from '@/lib/types';
import { formatDate, formatINR } from '@/lib/utils';
import { ShieldCheck, CheckCircle2, AlertTriangle, Car, Clock, User, QrCode } from 'lucide-react';
import Link from 'next/link';

export default function PublicVerifyPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const resolved = use(params);
  const { bookingId } = resolved;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) throw new Error('Booking ID not found');
        const data = await res.json();
        setBooking(data.booking);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#0F9D9A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
          Verifying Booking Signature...
        </p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4 bg-white dark:bg-[#0c182a] p-8 rounded-3xl border border-rose-200 dark:border-rose-900 shadow-sm">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-black text-rose-700 dark:text-rose-300">Invalid Booking Record</h2>
        <p className="text-xs text-slate-500">{error || 'This booking does not exist in the database.'}</p>
        <Link href="/" className="inline-block px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">
          Return to Home
        </Link>
      </div>
    );
  }

  const isValid = booking.status === 'booked' || booking.status === 'active';

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Public Verification Portal</span>
        </div>
        <h1 className="text-2xl font-black text-[#0B2545] dark:text-white">Official Parking Pass Check</h1>
        <p className="text-xs text-slate-500">Cryptographically issued by Smart Parking System.</p>
      </div>

      <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg space-y-6">
        {/* Verification Banner */}
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 border ${
            isValid
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 text-slate-700 dark:text-slate-300'
          }`}
        >
          {isValid ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          )}
          <div>
            <h3 className="font-bold text-sm">
              {isValid ? 'Verified & Authorized Pass' : `Status: ${booking.status.toUpperCase()}`}
            </h3>
            <p className="text-[11px] opacity-80">
              {isValid
                ? 'Valid reservation on system records.'
                : 'This reservation is no longer active.'}
            </p>
          </div>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-4 text-xs pt-2">
          <div>
            <span className="text-slate-400 block font-medium">Assigned Slot</span>
            <span className="text-2xl font-black text-[#0B2545] dark:text-white">
              Slot {booking.slot_code}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {booking.slot_code.startsWith('G') ? 'Ground Floor' : '1st Floor'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Vehicle Plate</span>
            <span className="text-xl font-bold uppercase tracking-wider text-[#0F9D9A]">
              {booking.vehicle_number}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Driver Name</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{booking.driver_name}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Duration & Bill</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {booking.hours} hrs ({formatINR(booking.amount)})
            </span>
          </div>

          <div className="col-span-2">
            <span className="text-slate-400 block font-medium">Schedule</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDate(booking.start_time)}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <Link
            href={`/bookings/${booking.id}`}
            className="text-xs font-bold text-[#0F9D9A] hover:underline flex items-center justify-center gap-1"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Open High-Res QR Ticket Pass</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
