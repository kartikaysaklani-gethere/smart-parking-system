'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Car,
  QrCode,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Compass,
  CheckCircle2,
  Tv,
} from 'lucide-react';
import { ParkingSlot } from '@/lib/types';
import { SlotCard } from '@/components/SlotCard';

export default function LandingPage() {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [hardwareOnline, setHardwareOnline] = useState(false);

  useEffect(() => {
    async function loadData() {
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
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const freeCount = slots.filter((s) => s.status === 'free').length;
  const groundFree = slots.filter((s) => s.floor === 0 && s.status === 'free').length;
  const firstFree = slots.filter((s) => s.floor === 1 && s.status === 'free').length;

  return (
    <div className="space-y-16 pb-12">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2545] via-[#133560] to-[#0a1e38] text-white p-8 sm:p-12 md:p-16 shadow-2xl border border-slate-700/50">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#0F9D9A_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0F9D9A]/25 border border-[#0F9D9A]/40 text-[#5eead4]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>{loading ? 'Reading Sensors...' : `${freeCount} of 6 Slots Available Now`}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-slate-200 border border-white/15">
              <Activity className="w-3.5 h-3.5 text-[#F2A541]" />
              <span>{hardwareOnline ? 'Connected to IoT Controller' : 'IoT Controller Ready'}</span>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Smart Parking System with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F9D9A] via-[#38bdf8] to-[#F2A541]">
                Intelligent Slot Detection
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
              An engineering-grade IoT garage solution. Ultrasonic distance sensing, servo entrance control, cryptographic QR check-in, and dynamic LCD floor guidance in real-time.
            </p>
          </div>

          {/* CTA Group */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0F9D9A] hover:bg-[#0c827f] text-white font-bold text-sm shadow-lg shadow-[#0F9D9A]/30 transition-all hover:scale-105"
            >
              <span>Book a Slot Now (₹40/hr)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/20 transition-all"
            >
              <Layers className="w-4 h-4 text-[#38bdf8]" />
              <span>View Live Map</span>
            </Link>

            <Link
              href="/gate"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-sm border border-white/10 transition-all"
            >
              <QrCode className="w-4 h-4 text-[#F2A541]" />
              <span>Gate Kiosk</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Live Slot Counters Quick View */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-slate-500">Total Available</p>
            <h3 className="text-3xl font-black text-[#0B2545] dark:text-white mt-1">
              {loading ? '...' : `${freeCount} / 6`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Ground: {groundFree} • 1st Floor: {firstFree}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-slate-500">Sensor Slots</p>
            <h3 className="text-3xl font-black text-[#0F9D9A] mt-1">3 Slots</h3>
            <p className="text-xs text-slate-500 mt-1">G1, G2 (Ground) & F1 (1st Floor)</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0F9D9A]/10 text-[#0F9D9A] flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-slate-500">Virtual Slots</p>
            <h3 className="text-3xl font-black text-[#F2A541] mt-1">3 Slots</h3>
            <p className="text-xs text-slate-500 mt-1">G3 (Dummy car) • F2 (Bookable) • F3 (Reserved)</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#F2A541]/10 text-[#F2A541] flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </section>

      {/* 3. Live 6-Slot Visual Snapshot */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-black text-[#0B2545] dark:text-white tracking-tight">
              Realtime Slot Status
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Live states updated synchronously via Supabase & ESP32 telemetry.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[#0F9D9A] hover:underline flex items-center gap-1"
          >
            Open Full Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B2545] dark:text-white tracking-tight">
            How The Hardware System Works
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            End-to-end integration between physical microcontrollers and the cloud.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-[#0B2545] text-white flex items-center justify-center font-black mb-4">
              1
            </div>
            <h3 className="font-bold text-base text-[#0B2545] dark:text-white mb-2">
              Book Online / Walk In
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Driver reserves a slot online and receives an HMAC-signed QR ticket, or staff issues a walk-in at the gate kiosk.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-[#0F9D9A] text-white flex items-center justify-center font-black mb-4">
              2
            </div>
            <h3 className="font-bold text-base text-[#0B2545] dark:text-white mb-2">
              Gate Servo & QR Scan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Staff scans driver QR using the gate webcam. System validates cryptographic integrity and opens the SG90 servo gate.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-[#F2A541] text-white flex items-center justify-center font-black mb-4">
              3
            </div>
            <h3 className="font-bold text-base text-[#0B2545] dark:text-white mb-2">
              LED & LCD Navigation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The assigned slot LED lights up. The 16x2 LCD displays &quot;Go to slot X / [Floor]&quot; for 20 seconds to guide the driver.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0c182a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black mb-4">
              4
            </div>
            <h3 className="font-bold text-base text-[#0B2545] dark:text-white mb-2">
              Ultrasonic Detection & Exit
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ultrasonic sensor confirms parking and turns off LED. On exit, quick check-out computes actual duration and frees the slot.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Hardware Architecture Component Breakdown */}
      <section className="rounded-3xl bg-white dark:bg-[#0c182a] border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-2xl font-black text-[#0B2545] dark:text-white tracking-tight">
            Hardware & Automation Infrastructure
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Physical ultrasonic detection, automated barrier gate, and cloud synchronisation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-[#0F9D9A]">
              <Cpu className="w-5 h-5" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">ESP32 NodeMCU</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Wi-Fi enabled dual-core microcontroller calling Next.js API securely with encrypted telemetry.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-blue-500">
              <Zap className="w-5 h-5" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">HC-SR04 Sensors</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ultrasonic ping sensors monitoring physical slots G1, G2, and F1 in real time.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-[#F2A541]">
              <Tv className="w-5 h-5" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">16x2 I2C LCD</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mounted at entrance gate; displays real-time free counts and directional slot instructions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-emerald-500">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Supabase Realtime</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PostgreSQL database with WebSockets for instant state sync without page reloads.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
