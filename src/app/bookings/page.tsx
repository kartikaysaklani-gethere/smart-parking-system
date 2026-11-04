'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Booking } from '@/lib/types';
import { formatINR, formatDate } from '@/lib/utils';
import { generateQRCodeDataURL } from '@/lib/qr';
import { toast } from 'sonner';
import {
  Ticket,
  Clock,
  Car,
  QrCode,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Maximize2,
  X,
  Download,
} from 'lucide-react';

export default function BookingsListPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'upcoming' | 'active' | 'past'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [selectedPass, setSelectedPass] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    setCurrentTime(Date.now());
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const data = await res.json();
        const list: Booking[] = data.bookings || [];
        setBookings(list);

        // Generate QR codes for all bookings
        const qrs: Record<string, string> = {};
        for (const b of list) {
          if (b.qr_token) {
            try {
              qrs[b.id] = await generateQRCodeDataURL(b.qr_token);
            } catch {
              // Ignore failure
            }
          }
        }
        setQrMap(qrs);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (bookingId: string, slotCode: string) => {
    if (!confirm(`Are you sure you want to cancel your reservation for Slot ${slotCode}? Your parking bay will be released.`)) {
      return;
    }

    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel');
      }

      toast.success('Reservation cancelled and parking bay freed.');
      fetchBookings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation error';
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const now = currentTime || 0;

  const filtered = bookings.filter((b) => {
    if (filterTab === 'upcoming') {
      return b.status === 'booked' && new Date(b.start_time).getTime() > now;
    }
    if (filterTab === 'active') {
      return b.status === 'active' || (b.status === 'booked' && new Date(b.start_time).getTime() <= now);
    }
    if (filterTab === 'past') {
      return b.status === 'completed' || b.status === 'cancelled' || b.status === 'expired' || b.status === 'no_show';
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            My Bookings & QR Passes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access your signed QR access passes for automated gate barrier entry, view live session timelines, or manage reservations.
          </p>
        </div>

        <Link
          href="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
        >
          <span>New Reservation</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {[
          { key: 'all', label: `All Passes (${bookings.length})` },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'active', label: 'Active / At Garage' },
          { key: 'past', label: 'Past & Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key as typeof filterTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterTab === tab.key
                ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Ticket className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">No Bookings Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You do not have any active reservations in this category.
            </p>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Book a Slot Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((booking) => {
            const isCancelable = booking.status === 'booked' || booking.status === 'active';
            const qrImage = qrMap[booking.id];

            return (
              <div
                key={booking.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Top Row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        Slot {booking.slot_code}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {booking.slot_code.startsWith('G') ? 'Ground Floor' : '1st Floor'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                      {booking.driver_name} • <span className="font-mono uppercase">{booking.vehicle_number}</span>
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                      booking.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                        : booking.status === 'booked'
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300'
                        : booking.status === 'completed'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                {/* QR Code Pass Section */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  {qrImage ? (
                    <div
                      onClick={() => setSelectedPass(booking)}
                      className="cursor-pointer group relative w-24 h-24 p-1.5 rounded-xl bg-white border border-slate-200 shadow-sm shrink-0 flex items-center justify-center"
                      title="Click to enlarge entry pass"
                    >
                      <Image
                        src={qrImage}
                        alt="Booking QR Code"
                        width={96}
                        height={96}
                        className="w-full h-full object-contain"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                  )}

                  <div className="space-y-1 text-xs">
                    <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-indigo-500" />
                      Cryptographic Gate Pass
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      Scan at gate camera or staff kiosk for automated barrier entry.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedPass(booking)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 block"
                    >
                      Expand Fullscreen Pass &rarr;
                    </button>
                  </div>
                </div>

                {/* Schedule & Duration Details */}
                <div className="grid grid-cols-2 gap-3 text-xs py-3 border-y border-slate-100 dark:border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block font-medium">Valid From:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(booking.start_time)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Duration & Tariff:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {booking.hours} hr{booking.hours > 1 ? 's' : ''} ({formatINR(booking.amount)})
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                  >
                    <span>View Pass Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {isCancelable && (
                    <button
                      onClick={() => handleCancel(booking.id, booking.slot_code)}
                      disabled={cancellingId === booking.id}
                      className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== FULLSCREEN PASS MODAL ===================== */}
      {selectedPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-center animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Official Gate Access Pass
              </span>
              <button
                onClick={() => setSelectedPass(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                Slot {selectedPass.slot_code}
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {selectedPass.vehicle_number} • {selectedPass.driver_name}
              </p>
            </div>

            {/* High-Contrast QR Code */}
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-inner inline-block mx-auto">
              {qrMap[selectedPass.id] && (
                <Image
                  src={qrMap[selectedPass.id]}
                  alt="High Contrast Entry QR"
                  width={220}
                  height={220}
                  className="mx-auto"
                  unoptimized
                />
              )}
            </div>

            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <p className="font-mono text-[10px] text-slate-400">
                Token ID: {selectedPass.id.slice(0, 16)}...
              </p>
              <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>HMAC-SHA256 Authenticated Pass</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPass(null)}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
