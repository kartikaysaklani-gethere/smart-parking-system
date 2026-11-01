'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ParkingSlot } from '@/lib/types';
import { SlotCard } from '@/components/SlotCard';
import { createClient } from '@/lib/supabase/client';
import {
  Layers,
  Radio,
  CalendarPlus,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from 'lucide-react';

export default function DashboardPage() {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [hardwareOnline, setHardwareOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<'all' | 0 | 1>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [slotsRes, settingsRes] = await Promise.all([
        fetch('/api/slots'),
        fetch('/api/settings'),
      ]);

      if (slotsRes.ok) {
        const data = await slotsRes.json();
        setSlots(data.slots || []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setHardwareOnline(Boolean(data.hardware?.online));
        setLastSeen(data.hardware?.lastSeen || null);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Supabase Realtime Channel
    try {
      const supabase = createClient();
      const channel = supabase
        .channel('realtime:slots')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'slots' },
          () => {
            fetchStatus();
          }
        )
        .subscribe();

      // Polling fallback to guarantee live updates even when Supabase is in mock/offline mode
      const interval = setInterval(fetchStatus, 3000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    } catch {
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [fetchStatus]);

  const groundSlots = slots.filter((s) => s.floor === 0);
  const firstSlots = slots.filter((s) => s.floor === 1);

  const freeTotal = slots.filter((s) => s.status === 'free').length;
  const freeGround = groundSlots.filter((s) => s.status === 'free').length;
  const freeFirst = firstSlots.filter((s) => s.status === 'free').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Hardware Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B2545] dark:text-white tracking-tight">
              Live Garage Map
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Realtime Sync</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Realtime slot occupancy for both floors. Automated detection via ultrasonic sensors.
          </p>
        </div>

        {/* Hardware telemetry status indicator */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <Radio
              className={`w-5 h-5 ${
                hardwareOnline ? 'text-emerald-500 animate-pulse' : 'text-[#F2A541]'
              }`}
            />
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>{hardwareOnline ? 'IoT Controller Connected' : 'Controller Standby'}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    hardwareOnline ? 'bg-emerald-500' : 'bg-[#F2A541]'
                  }`}
                ></span>
              </div>
              <p className="text-[10px] text-slate-500">
                {lastSeen ? `Pinged: ${new Date(lastSeen).toLocaleTimeString()}` : 'Awaiting hardware ping'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchStatus();
            }}
            disabled={refreshing}
            aria-label="Refresh slot data"
            className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md">
          <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Free Total</span>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-300 mt-1">
            {freeTotal} <span className="text-base font-semibold text-slate-500">/ 6</span>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Immediate parking</span>
        </div>

        <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md">
          <span className="text-xs font-black text-[#0B2545] dark:text-slate-300 uppercase tracking-wider">Ground Floor</span>
          <div className="text-3xl font-black text-[#0B2545] dark:text-white mt-1">
            {freeGround} <span className="text-base font-semibold text-slate-500">/ 3</span>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">G1, G2, G3</span>
        </div>

        <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md">
          <span className="text-xs font-black text-[#0B2545] dark:text-slate-300 uppercase tracking-wider">1st Floor</span>
          <div className="text-3xl font-black text-[#0B2545] dark:text-white mt-1">
            {freeFirst} <span className="text-base font-semibold text-slate-500">/ 3</span>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">F1, F2, F3</span>
        </div>

        <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border-2 border-[#0F9D9A]/50 dark:border-[#0F9D9A]/40 shadow-md flex flex-col justify-between">
          <span className="text-xs font-black text-[#0F9D9A] uppercase tracking-wider">Hourly Tariff</span>
          <div className="text-3xl font-black text-[#0B2545] dark:text-white mt-1">₹40 <span className="text-xs font-semibold text-slate-500">/ hr</span></div>
          <Link
            href="/book"
            className="text-xs font-bold text-[#0F9D9A] hover:underline flex items-center gap-1"
          >
            Reserve Slot →
          </Link>
        </div>
      </div>

      {/* Floor Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setSelectedFloor('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedFloor === 'all'
                ? 'bg-white dark:bg-[#0B2545] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            All Floors (6 Slots)
          </button>
          <button
            onClick={() => setSelectedFloor(0)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedFloor === 0
                ? 'bg-white dark:bg-[#0B2545] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Ground Floor (3)
          </button>
          <button
            onClick={() => setSelectedFloor(1)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedFloor === 1
                ? 'bg-white dark:bg-[#0B2545] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            1st Floor (3)
          </button>
        </div>

        <Link
          href="/book"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F9D9A] hover:bg-[#0c827f] text-white shadow-sm transition-all"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>Book a Slot</span>
        </Link>
      </div>

      {/* Floors Visual Grid */}
      <div className="space-y-8">
        {(selectedFloor === 'all' || selectedFloor === 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0B2545] dark:bg-[#0F9D9A]"></span>
                <h2 className="text-lg font-bold text-[#0B2545] dark:text-white">Ground Floor (Level 0)</h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {freeGround} of 3 free • G1 & G2 Ultrasonic Sensors • G3 Dummy Car
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {groundSlots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          </div>
        )}

        {(selectedFloor === 'all' || selectedFloor === 1) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0F9D9A]"></span>
                <h2 className="text-lg font-bold text-[#0B2545] dark:text-white">1st Floor (Level 1)</h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {freeFirst} of 3 free • F1 Ultrasonic Sensor • F2 Bookable • F3 Reserved
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {firstSlots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Color Legend */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0c182a] border border-slate-200 dark:border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#0F9D9A]" />
          <span>Slot Status Legend</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Free (Available)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Booked (Online)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Assigned (In Transit)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Occupied (Car Parked)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Reserved (VIP)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-400"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Maintenance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
