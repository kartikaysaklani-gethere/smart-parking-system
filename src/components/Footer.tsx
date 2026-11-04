'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Clock, MapPin, Radio, GraduationCap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-lg text-slate-900 dark:text-white">
                ParkWise Mobility Systems
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Automated multi-level parking management system. Real-time ultrasonic slot detection, contactless cryptographic QR entry passes, and automated barrier operations.
            </p>
            <div className="pt-2">
              <Link
                href="/team"
                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Engineered by Kartikay Saklani & Anshuman (Chandigarh University) &rarr;</span>
              </Link>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Quick Navigation
            </h4>
            <ul className="text-xs space-y-2 font-medium">
              <li>
                <Link href="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Live Garage Map
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Reserve Parking Slot
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  My Reservations & Passes
                </Link>
              </li>
              <li>
                <Link href="/gate" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Gate Barrier Terminal
                </Link>
              </li>
              <li>
                <Link href="/team" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Project Engineers
                </Link>
              </li>
            </ul>
          </div>

          {/* Garage Operations */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              System Operations
            </h4>
            <div className="text-xs space-y-2 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Operating 24 Hours / 7 Days</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>HMAC Verification & Telemetry Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Dual-Floor: Ground & 1st Floor</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>&copy; 2026 ParkWise Systems. All rights reserved.</p>
          <div className="flex items-center gap-3 font-medium">
            <span className="text-emerald-500 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              All Telemetry Systems Active
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
