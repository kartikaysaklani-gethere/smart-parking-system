'use client';

import React from 'react';
import Link from 'next/link';
import {
  Cpu,
  GraduationCap,
  ShieldCheck,
  Code2,
  Radio,
  Layers,
  Sparkles,
  ExternalLink,
  Award,
  BookOpen,
} from 'lucide-react';

export default function TeamPage() {
  const teamMembers = [
    {
      name: 'Kartikay Saklani',
      role: 'IoT Systems Architect & Cloud Engineer',
      affiliation: 'Chandigarh University',
      specialization: 'Full-Stack Distributed Systems, Real-Time WebSockets & Cloud Telemetry',
      contributions: [
        'Architected Next.js 15 App Router cloud gateway with sub-second API telemetry',
        'Implemented Supabase PostgreSQL database schema with live state synchronization',
        'Engineered HMAC-SHA256 cryptographic QR code pass generator and kiosk validation',
        'Designed high-contrast responsive Operations Console with administrative overrides',
      ],
      avatarColor: 'from-indigo-600 to-cyan-500',
    },
    {
      name: 'Anshuman',
      role: 'Embedded Firmware & Hardware Engineer',
      affiliation: 'Chandigarh University',
      specialization: 'Embedded Microcontroller Systems, Sensor Networks & PWM Actuation',
      contributions: [
        'Engineered ESP32 FreeRTOS dual-core firmware with non-blocking concurrency',
        'Calibrated HC-SR04 ultrasonic array with acoustic crosstalk suppression for extended wires',
        'Designed automated entrance barrier mechanism using high-torque 90° servo actuation',
        'Implemented active-HIGH LED driver guidance matrix and 16x2 HD44780 I2C navigation',
      ],
      avatarColor: 'from-emerald-600 to-teal-500',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-16">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 sm:p-12 border border-slate-800 shadow-2xl">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <GraduationCap className="w-4 h-4" />
            <span>Chandigarh University Research & Development</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
            Engineering & Project Architects
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            ParkWise was designed, engineered, and built from scratch as an enterprise-grade IoT smart parking and mobility platform by students at <span className="text-white font-bold">Chandigarh University</span>.
          </p>
        </div>
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {teamMembers.map((member, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <div className="space-y-4">
              {/* Avatar & Header */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${member.avatarColor} flex items-center justify-center text-white font-black text-xl shadow-lg`}
                >
                  {member.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {member.name}
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">
                    {member.role}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {member.affiliation}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Focus Area:</span>
                {member.specialization}
              </div>

              {/* Core Deliverables */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Core Engineering Contributions
                </span>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {member.contributions.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-500">Chandigarh University</span>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-[10px] text-slate-600 dark:text-slate-300">
                Verified Creator
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* System Technical Architecture Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 block">
            System Specifications
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ParkWise System Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">ESP32 Dual-Core</h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Core 0 manages Wi-Fi TLS telemetry and cloud polling, while Core 1 handles sub-millisecond ultrasonic pulse timings and PWM servo control.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
            <Radio className="w-5 h-5 text-emerald-500" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Ultrasonic Array</h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Calibrated gate barrier trigger (&le;7cm) and parking bay presence detection (&le;9cm) with acoustic settling filters for extended wire harnesses.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
            <Layers className="w-5 h-5 text-cyan-500" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Cloud Orchestration</h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Next.js 15 server runtime with Supabase PostgreSQL live subscriptions, dynamic hourly pricing, and full administrative remote gate overrides.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
