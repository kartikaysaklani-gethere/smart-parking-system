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
  Tv,
  Radio,
  Layers,
  DollarSign,
  BarChart3,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'slots' | 'bookings' | 'analytics'>('simulator');

  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number>(40);
  const [newRateInput, setNewRateInput] = useState<number>(40);
  const [deviceOnline, setDeviceOnline] = useState<boolean>(false);
  const [deviceLastSeen, setDeviceLastSeen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        setNewRateInput(rate);
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
    const interval = setInterval(loadAdminData, 4000);
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
      toast.success(`Slot ${slotId} updated to ${status}`);
      loadAdminData();
    } catch (err: unknown) {
      toast.error('Failed to override slot status.');
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
      toast.success(`Parking rate updated to ₹${newRateInput}/hr!`);
    } catch (err: unknown) {
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
          distance_cm: simGateCar ? 15 : 180,
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
      toast.success('Simulated ESP32 telemetry delivered to server!');
      loadAdminData();
    } catch (err: unknown) {
      toast.error('Simulation error');
    } finally {
      setSimulating(false);
    }
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#0F9D9A]" />
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B2545] dark:text-white tracking-tight">
              Management & Hardware Console
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete management of 6 slots, hardware diagnostics, dynamic pricing, and an interactive ESP32 simulator.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'simulator'
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Demo Simulator
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'slots'
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Slot Controls
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'bookings'
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Analytics & Price
          </button>
        </div>
      </div>

      {/* 1. HARDWARE SIMULATOR TAB */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F9D9A] block">
                  IoT Telemetry Testing Suite
                </span>
                <h2 className="text-xl font-black text-[#0B2545] dark:text-white mt-0.5">
                  ESP32 Microcontroller Simulator
                </h2>
                <p className="text-xs text-slate-500">
                  Mimic physical ultrasonic sensors and entrance gate trigger. Test LED output and 16x2 LCD messaging.
                </p>
              </div>

              <button
                onClick={triggerSimulationTelemetry}
                disabled={simulating}
                className="px-5 py-3 rounded-2xl bg-[#0F9D9A] hover:bg-[#0c827f] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{simulating ? 'Sending Telemetry...' : 'Send Sensor Ping to API'}</span>
              </button>
            </div>

            {/* Sensor Toggles Grid */}
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
                    {simSensors.G1 ? 'CAR PRESENT (true)' : 'EMPTY (false)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Click to toggle physical car arrival/departure on slot G1.
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
                    {simSensors.G2 ? 'CAR PRESENT (true)' : 'EMPTY (false)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Click to toggle physical car arrival/departure on slot G2.
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
                    {simSensors.F1 ? 'CAR PRESENT (true)' : 'EMPTY (false)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Click to toggle physical car arrival/departure on slot F1.
                </p>
              </div>
            </div>

            {/* Entrance Gate Servo Trigger */}
            <div
              onClick={() => setSimGateCar(!simGateCar)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                simGateCar
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Radio className={`w-5 h-5 ${simGateCar ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <h4 className="font-bold text-xs">Entrance Gate Sensor: Car Detected</h4>
                  <p className="text-[11px] text-slate-500">
                    {simGateCar ? 'Car at gate (SG90 Servo holds gate open)' : 'Gate entrance clear'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold underline">
                {simGateCar ? 'Set Clear' : 'Set Car Present'}
              </span>
            </div>

            {/* Simulated 16x2 LCD Display & LED Bulbs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Retro 16x2 LCD Display Screen */}
              <div className="bg-[#1b3d2f] text-[#33ff88] font-mono p-5 rounded-2xl border-4 border-[#0e241c] shadow-inner space-y-2 select-none">
                <div className="flex items-center justify-between text-[10px] text-[#22aa55] uppercase tracking-wider pb-1 border-b border-[#22aa55]/30">
                  <span>HD44780 16x2 I2C LCD</span>
                  <span>5V IoT Display</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold tracking-widest leading-none py-1">
                  {simResponse?.lcd?.[0] || 'ParkSmart System'}
                </div>
                <div className="text-xl sm:text-2xl font-bold tracking-widest leading-none py-1">
                  {simResponse?.lcd?.[1] || 'Ready for entry'}
                </div>
              </div>

              {/* Physical LEDs Output Status */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
                  <span>Guidance Slot LEDs (Physical Pinouts)</span>
                  <span className="text-emerald-400 text-[10px]">Active Low / High</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {['G1', 'G2', 'F1'].map((slotId) => {
                    const isOn = Boolean(simResponse?.leds?.[slotId]);
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

            {/* Live Server Payload Inspector */}
            {simResponse && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Raw ESP32 Server Response (JSON)
                </span>
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(simResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SLOT CONTROLS TAB */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-black text-[#0B2545] dark:text-white">
                Slot Management & Administrative Override
              </h2>
              <p className="text-xs text-slate-500">
                Directly override any slot status or toggle maintenance.
              </p>
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

      {/* 3. BOOKINGS TABLE TAB */}
      {activeTab === 'bookings' && (
        <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-[#0B2545] dark:text-white">
            Comprehensive Bookings Ledger
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Slot</th>
                  <th className="p-3">Driver & Vehicle</th>
                  <th className="p-3">Schedule</th>
                  <th className="p-3">Duration & Fee</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-[#0B2545] dark:text-white">
                      Slot {b.slot_code}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold block">{b.driver_name}</span>
                      <span className="font-mono text-slate-500 uppercase">{b.vehicle_number}</span>
                    </td>
                    <td className="p-3">{formatDate(b.start_time)}</td>
                    <td className="p-3 font-bold text-[#0F9D9A]">
                      {b.hours} hrs ({formatINR(b.amount)})
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.walk_in ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {b.walk_in ? 'Walk-In' : 'Online'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ANALYTICS & PRICING TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Gross Revenue</span>
              <div className="text-3xl font-black text-emerald-600 mt-1">{formatINR(totalRevenue)}</div>
              <span className="text-[11px] text-slate-500">{completedCount} Completed Sessions</span>
            </div>

            <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Occupancy Rate</span>
              <div className="text-3xl font-black text-[#0B2545] dark:text-white mt-1">
                {occupancyRate}%
              </div>
              <span className="text-[11px] text-slate-500">6 Slots Available</span>
            </div>

            <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Active Sessions</span>
              <div className="text-3xl font-black text-[#0F9D9A] mt-1">{activeCount} Cars</div>
              <span className="text-[11px] text-slate-500">Parked or en route</span>
            </div>

            <div className="bg-white dark:bg-[#0c182a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-500">Current Tariff</span>
              <div className="text-3xl font-black text-[#F2A541] mt-1">₹{hourlyRate}/hr</div>
              <span className="text-[11px] text-slate-500">Configured in DB</span>
            </div>
          </div>

          {/* Price Modifier Card */}
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-[#0B2545] dark:text-white">
              Dynamic Hourly Tariff Settings
            </h3>
            <p className="text-xs text-slate-500">
              Modify the standard parking rate stored in the database settings table.
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
                className="px-5 py-2.5 rounded-xl bg-[#0F9D9A] text-white font-bold text-xs hover:bg-[#0c827f] transition-colors"
              >
                Update Price
              </button>
            </form>
          </div>

          {/* Busy Hours Visual Bar Graph */}
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-[#0B2545] dark:text-white">
              Busy Hours Distribution (08:00 to 20:00)
            </h3>
            <div className="h-44 flex items-end gap-2 pt-6">
              {[
                { hr: '8 AM', val: 35 },
                { hr: '10 AM', val: 75 },
                { hr: '12 PM', val: 95 },
                { hr: '2 PM', val: 80 },
                { hr: '4 PM', val: 90 },
                { hr: '6 PM', val: 100 },
                { hr: '8 PM', val: 60 },
              ].map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-bold text-[#0F9D9A]">{item.val}%</span>
                  <div
                    style={{ height: `${item.val}%` }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#0B2545] to-[#0F9D9A] transition-all hover:opacity-80"
                  />
                  <span className="text-[10px] text-slate-500 font-semibold">{item.hr}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
