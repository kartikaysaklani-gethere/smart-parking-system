'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Clock, MapPin, PhoneCall } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070e1a] text-slate-600 dark:text-slate-400 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0B2545] dark:bg-[#0F9D9A] flex items-center justify-center text-white dark:text-[#08111e] font-black text-sm">
                P
              </div>
              <span className="font-bold text-base text-slate-900 dark:text-white">
                ParkPulse Smart Mobility
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Automated multi-level parking management system. Real-time slot guidance, contactless cryptographic QR entry passes, and automated barrier operations.
            </p>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Navigation
            </h4>
            <ul className="text-sm space-y-1.5 font-medium">
              <li>
                <Link href="/dashboard" className="hover:text-[#0F9D9A] transition-colors">
                  Live Garage Map
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-[#0F9D9A] transition-colors">
                  Reserve Parking Slot
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="hover:text-[#0F9D9A] transition-colors">
                  My Reservations & Passes
                </Link>
              </li>
              <li>
                <Link href="/gate" className="hover:text-[#0F9D9A] transition-colors">
                  Staff Gate Terminal
                </Link>
              </li>
            </ul>
          </div>

          {/* Garage Operations */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Operations & Support
            </h4>
            <div className="text-xs space-y-2 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0F9D9A] shrink-0" />
                <span>Operating 24 Hours / 7 Days</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
                <span>Encrypted Verification & Realtime Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#F2A541] shrink-0" />
                <span>Main Garage: Ground & 1st Floor</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 ParkSmart Systems. All rights reserved.</p>
          <div className="flex items-center gap-3 font-medium">
            <span className="text-[#059669] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
