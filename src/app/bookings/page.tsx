'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Booking, BookingStatus } from '@/lib/types';
import { formatINR, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Ticket,
  Calendar,
  Clock,
  Car,
  QrCode,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function BookingsListPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'upcoming' | 'active' | 'past'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const fetchBookings = async () => {
    setCurrentTime(Date.now());
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
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

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this reservation? The slot will be released.')) {
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

      toast.success('Reservation successfully cancelled.');
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
          <h1 className="text-3xl font-black text-[#0B2545] dark:text-white tracking-tight">
            My Bookings & Tickets
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access your signed QR entry tickets, view status timelines, or manage upcoming reservations.
          </p>
        </div>

        <Link
          href="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0F9D9A] hover:bg-[#0c827f] text-white font-bold text-sm shadow-sm transition-all"
        >
          <span>New Reservation</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {[
          { key: 'all', label: `All (${bookings.length})` },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'active', label: 'Active / At Gate' },
          { key: 'past', label: 'Past & Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key as typeof filterTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterTab === tab.key
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Ticket className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">No Bookings Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You do not have any reservations in this filter tab. Reserve a slot anytime.
            </p>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F9D9A] text-white text-xs font-bold"
          >
            Book a Slot Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((booking) => {
            const isCancelable =
              booking.status === 'booked' && new Date(booking.start_time).getTime() > now;

            return (
              <div
                key={booking.id}
                className="bg-white dark:bg-[#0c182a] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Top Row */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-[#0B2545] dark:text-white">
                        Slot {booking.slot_code}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {booking.slot_code.startsWith('G') ? 'Ground Floor' : '1st Floor'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      Driver: {booking.driver_name} • {booking.vehicle_number}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                      booking.status === 'active'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                        : booking.status === 'booked'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                        : booking.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-xs py-3 border-y border-slate-100 dark:border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block font-medium">Starts At:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(booking.start_time)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Duration & Bill:</span>
                    <span className="font-semibold text-[#0F9D9A]">
                      {booking.hours} hr{booking.hours > 1 ? 's' : ''} ({formatINR(booking.amount)})
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="flex-1 py-2.5 rounded-xl bg-[#0B2545] dark:bg-[#0F9D9A] text-white dark:text-[#08111e] text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>View QR Pass</span>
                  </Link>

                  {isCancelable && (
                    <button
                      onClick={() => handleCancel(booking.id)}
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
    </div>
  );
}
