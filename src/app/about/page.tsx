import React from 'react';
import Link from 'next/link';
import { Radio, ShieldCheck, Cpu, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-16">
      {/* Hero Header */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Next-Generation Smart Parking</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          About ParkWise Mobility
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          An intelligent multi-level parking management system powered by IoT ultrasonic telemetry, automated barrier actuation, and HMAC cryptographic access passes.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Real-Time Ultrasonic Detection</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            High-precision sensors monitor bay occupancy every 40ms, providing instant visual guidance via LED beacons and updating the live map.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Cryptographic QR Passes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Tamper-proof HMAC-SHA256 signed entry tokens enable contactless barrier access for pre-booked reservations.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Automated Barrier Operations</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Fast-response servo barrier gate with automatic departure timers and emergency override controls from the operations dashboard.
          </p>
        </div>
      </div>

      {/* System Specifications */}
      <div className="p-8 rounded-3xl bg-slate-900 text-white space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>System Architecture & Specs</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-slate-400 block font-medium">Bays Managed</span>
            <span className="text-lg font-black text-white">6 Slots</span>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-slate-400 block font-medium">Hardware Core</span>
            <span className="text-lg font-black text-white">ESP32 Dual-Core</span>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-slate-400 block font-medium">Telemetry Rate</span>
            <span className="text-lg font-black text-white">1000 ms</span>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-slate-400 block font-medium">Security</span>
            <span className="text-lg font-black text-white">HMAC-SHA256</span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
          >
            <span>View Live Map</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
