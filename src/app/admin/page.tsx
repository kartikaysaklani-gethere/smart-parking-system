'use client';

import React, { useState, useEffect } from 'react';
import { ParkingSlot, Booking, SlotStatus, SlotId, TelemetryResponse } from '@/lib/types';
import { SlotCard } from '@/components/SlotCard';
import { formatINR, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Settings,
  Cpu,
  Radio,
  Layers,
  DollarSign,
  BarChart3,
  RefreshCw,
  Search,
  Filter,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Play,
  Zap,
  DoorOpen,
  Car,
  Clock,
  User,
  CreditCard,
  Ban,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'slots' | 'bookings' | 'hardware' | 'analytics'>('slots');

  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number>(40);
  const [newRateInput, setNewRateInput] = useState<number>(40);
  const [deviceOnline, setDeviceOnline] = useState<boolean>(false);
  const [deviceLastSeen, setDeviceLastSeen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bookings Filter & Search
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'booked' | 'active' | 'completed' | 'cancelled'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Hardware Simulator States
  const [simSensors, setSimSensors] = useState<{
    G1: boolean;
    G2: boolean;
    F1: boolean;
  }>({
    G1: false,
    G2: false,
    F1: false,
  });
  const [simGateCar, setSimGateCar] = useState<boolean>(false);
  const [simResponse, setSimResponse] = useState<TelemetryResponse | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);

  const loadAdminData = async () => {
    try {
      const [slotsRes, bookingsRes, settingsRes] = await Promise.all([
        fetch('/api/slots'),
        fetch('/api/bookings'),
        fetch('/api/settings'),
      ]);

      if (slotsRes.ok) {
        const sData = await slotsRes.json();
        setSlots(sData.slots || []);
      }

      if (bookingsRes.ok) {
        const bData = await bookingsRes.json();
        setBookings(bData.bookings || []);
      }

      if (settingsRes.ok) {
        const setts = await settingsRes.json();
        const rate = setts.settings?.price_per_hour || 40;
        setHourlyRate(rate);
        setDeviceOnline(Boolean(setts.hardware?.online));
        setDeviceLastSeen(setts.hardware?.lastSeen);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    // Fast 1-second background refresh
    const interval = setInterval(loadAdminData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update Slot Status Override
  const handleSlotOverride = async (slotId: string, status: SlotStatus) => {
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slotId, status }),
      });
      if (!res.ok) throw new Error('Failed to update slot');
      toast.success(`Slot ${slotId} status set to ${status.toUpperCase()}`);
      loadAdminData();
    } catch {
      toast.error('Failed to override slot status.');
    }
  };

  // Cancel Booking Handler
  const handleCancelBooking = async (bookingId: string, slotCode: string) => {
    if (!confirm(`Are you sure you want to cancel booking #${bookingId.slice(0, 8)} for Slot ${slotCode}? This will free the slot immediately.`)) {
      return;
    }

    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to cancel booking');
      }

      toast.success(`Booking cancelled! Slot ${slotCode} is now released.`);
      loadAdminData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error cancelling booking');
    } finally {
      setCancellingId(null);
    }
  };

  // Complete / Check-Out Booking Handler
  const handleCompleteBooking = async (bookingId: string, slotCode: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!res.ok) throw new Error('Failed to checkout');

      // Also free the slot
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slotCode, status: 'free' }),
      });

      toast.success(`Session completed. Slot ${slotCode} freed.`);
      loadAdminData();
    } catch {
      toast.error('Failed to complete session.');
    }
  };

  // Update Price
  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_hour: Number(newRateInput) }),
      });
      if (!res.ok) throw new Error('Failed to update rate');
      setHourlyRate(Number(newRateInput));
      toast.success(`Standard tariff updated to ₹${newRateInput}/hr!`);
    } catch {
      toast.error('Failed to update rate.');
    }
  };

  // Execute Hardware Simulation Telemetry Call
  const triggerSimulationTelemetry = async () => {
    setSimulating(true);
    try {
      const payload = {
        slots: {
          G1: simSensors.G1,
          G2: simSensors.G2,
          F1: simSensors.F1,
        },
        gate: {
          car_present: simGateCar,
          distance_cm: simGateCar ? 12 : 180,
        },
      };

      const res = await fetch('/api/device/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': 'esp32_smart_parking_secret_key_2026',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSimResponse(data);
      toast.success('Telemetry packet delivered to server!');
      loadAdminData();
    } catch {
      toast.error('Simulation error');
    } finally {
      setSimulating(false);
    }
  };

  // Filtered Bookings List
  const filteredBookings = bookings.filter((b) => {
    const matchesFilter = bookingFilter === 'all' || b.status === bookingFilter;
    const q = bookingSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.driver_name.toLowerCase().includes(q) ||
      b.vehicle_number.toLowerCase().includes(q) ||
      b.slot_code.toLowerCase().includes(q) ||
      b.phone.includes(q);
    return matchesFilter && matchesSearch;
  });

  // Analytics Calculations
  const totalRevenue = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.amount || 0), 0);

  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'booked').length;
  const occupancyRate = Math.round(
    ((6 - slots.filter((s) => s.status === 'free').length) / 6) * 100
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Enterprise Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                Operations Command Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Real-time parking facility administration, booking overrides, and IoT hardware diagnostics.
              </p>
            </div>
          </div>
        </div>

        {/* Console Tab Switcher */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'slots'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Slot Controls</span>
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Bookings & Cancel ({bookings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'hardware'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Hardware Diagnostics</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics & Tariffs</span>
          </button>
        </div>
      </div>

      {/* 1. SLOT CONTROLS TAB */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Real-Time Slot Manager
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any slot card below to force override state, set maintenance, or release assigned reservations.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {slots.filter((s) => s.status === 'free').length} Free
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {slots.filter((s) => s.status === 'occupied').length} Occupied
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  showAdminControls={true}
                  onStatusChange={handleSlotOverride}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. BOOKINGS & CANCELLATION MANAGER TAB */}
      {activeTab === 'bookings' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Bookings Administration & Cancellation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review all online and walk-in reservations. Cancel any active booking to instantly free the designated parking bay.
              </p>
            </div>

            {/* Status Pills Filter */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold overflow-x-auto">
              {(['all', 'booked', 'active', 'completed', 'cancelled'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setBookingFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    bookingFilter === filter
                      ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by driver, vehicle plate, phone, or slot..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Slot</th>
                  <th className="p-3.5">Driver & Vehicle</th>
                  <th className="p-3.5">Schedule</th>
                  <th className="p-3.5">Fee</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No matching bookings found.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => {
                    const isCancellable = b.status === 'booked' || b.status === 'active';
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-lg font-black text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Slot {b.slot_code}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {b.driver_name}
                          </span>
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-wider block">
                            {b.vehicle_number}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {b.phone}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDate(b.start_time)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">Duration: {b.hours} hr(s)</span>
                        </td>
                        <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {formatINR(b.amount || 0)}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.walk_in
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {b.walk_in ? 'Walk-In' : 'Online'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                              b.status === 'active'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                                : b.status === 'booked'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300'
                                : b.status === 'completed'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isCancellable && (
                              <>
                                <button
                                  onClick={() => handleCancelBooking(b.id, b.slot_code)}
                                  disabled={cancellingId === b.id}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1.5"
                                  title="Cancel this reservation and immediately free the slot"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>{cancellingId === b.id ? 'Cancelling...' : 'Cancel'}</span>
                                </button>
                                {b.status === 'active' && (
                                  <button
                                    onClick={() => handleCompleteBooking(b.id, b.slot_code)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 transition-colors"
                                    title="Mark car as departed and complete session"
                                  >
                                    Check Out
                                  </button>
                                )}
                              </>
                            )}
                            {!isCancellable && (
                              <span className="text-slate-400 text-xs italic">Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. HARDWARE & DIAGNOSTICS TAB */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 block">
                  Hardware Console
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  ESP32 Microcontroller & Gate Diagnostics
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect sensor responses, test 16x2 LCD output lines, and pulse the entry barrier servo.
                </p>
              </div>

              <button
                onClick={triggerSimulationTelemetry}
                disabled={simulating}
                className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{simulating ? 'Sending Telemetry...' : 'Send Test Ping to Server'}</span>
              </button>
            </div>

            {/* Sensor Diagnostic Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* G1 Sensor */}
              <div
                onClick={() => setSimSensors({ ...simSensors, G1: !simSensors.G1 })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  simSensors.G1
                    ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">G1 Sensor (Ground)</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      simSensors.G1 ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                    }`}
                  >
                    {simSensors.G1 ? 'OCCUPIED' : 'FREE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Toggle car arrival simulation on slot G1.
                </p>
              </div>

              {/* G2 Sensor */}
              <div
                onClick={() => setSimSensors({ ...simSensors, G2: !simSensors.G2 })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  simSensors.G2
                    ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">G2 Sensor (Ground)</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      simSensors.G2 ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                    }`}
                  >
                    {simSensors.G2 ? 'OCCUPIED' : 'FREE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Toggle car arrival simulation on slot G2.
                </p>
              </div>

              {/* F1 Sensor */}
              <div
                onClick={() => setSimSensors({ ...simSensors, F1: !simSensors.F1 })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  simSensors.F1
                    ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">F1 Sensor (1st Floor)</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      simSensors.F1 ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                    }`}
                  >
                    {simSensors.F1 ? 'OCCUPIED' : 'FREE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Toggle car arrival simulation on slot F1.
                </p>
              </div>
            </div>

            {/* Entrance Barrier Sensor Toggle */}
            <div
              onClick={() => setSimGateCar(!simGateCar)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                simGateCar
                  ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <DoorOpen className={`w-6 h-6 ${simGateCar ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-black text-sm block">Entrance Barrier Sensor (Gate Servo: 150°)</span>
                  <span className="text-xs text-slate-500">
                    {simGateCar
                      ? 'Car detected (<15cm) - Servo opens to 150°'
                      : 'Gate idle / clear (>25cm) - Servo closed (0°)'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold underline">
                {simGateCar ? 'Set Clear' : 'Simulate Vehicle Arrival'}
              </span>
            </div>

            {/* LCD Screen Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-[#1b3d2f] text-[#33ff88] font-mono p-5 rounded-2xl border-4 border-[#0e241c] shadow-inner space-y-2 select-none">
                <div className="flex items-center justify-between text-[10px] text-[#22aa55] uppercase tracking-wider pb-1 border-b border-[#22aa55]/30">
                  <span>HD44780 16x2 I2C Display</span>
                  <span>Hardware Preview</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold tracking-widest leading-none py-1">
                  {simResponse?.lcd?.[0] || 'ParkPulse Live'}
                </div>
                <div className="text-xl sm:text-2xl font-bold tracking-widest leading-none py-1">
                  {simResponse?.lcd?.[1] || 'Welcome Driver'}
                </div>
              </div>

              {/* Physical Guidance LEDs */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
                  <span>Slot Guidance LEDs (GPIO16, GPIO17, GPIO19)</span>
                  <span className="text-emerald-400 text-[10px]">Free = ON | Occupied = OFF</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {['G1', 'G2', 'F1'].map((slotId) => {
                    const isOn = simResponse?.leds ? Boolean(simResponse.leds[slotId]) : true;
                    return (
                      <div
                        key={slotId}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 ${
                          isOn
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                            : 'border-slate-800 bg-slate-950 text-slate-500'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full ${
                            isOn
                              ? 'bg-emerald-400 shadow-lg shadow-emerald-400/80 animate-pulse'
                              : 'bg-slate-700'
                          }`}
                        />
                        <span className="text-xs font-black">LED {slotId}</span>
                        <span className="text-[10px] font-mono">{isOn ? 'HIGH (ON)' : 'LOW (OFF)'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ANALYTICS & PRICING TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Gross Revenue</span>
              <div className="text-3xl font-black text-emerald-600 mt-1">{formatINR(totalRevenue)}</div>
              <span className="text-[11px] text-slate-500">{completedCount} Completed Sessions</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Facility Occupancy</span>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {occupancyRate}%
              </div>
              <span className="text-[11px] text-slate-500">6 Dual-Floor Slots</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Active Vehicles</span>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {activeCount} Cars
              </div>
              <span className="text-[11px] text-slate-500">Parked or en route</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Standard Tariff</span>
              <div className="text-3xl font-black text-amber-500 mt-1">₹{hourlyRate}/hr</div>
              <span className="text-[11px] text-slate-500">Configured in DB</span>
            </div>
          </div>

          {/* Price Modifier Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Dynamic Hourly Tariff Settings
            </h3>
            <p className="text-xs text-slate-500">
              Update the standard parking fee applied to all online and walk-in reservations.
            </p>

            <form onSubmit={handleUpdatePrice} className="flex items-center gap-3 max-w-sm">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(Number(e.target.value))}
                  aria-label="Hourly tariff rate in rupees"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Update Price
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
