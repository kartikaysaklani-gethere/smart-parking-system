'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Booking, ParkingSlot, SlotId } from '@/lib/types';
import { formatINR, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Camera,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Car,
  User,
  Phone,
  DoorOpen,
  LogOut,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function GatePage() {
  const [activeTab, setActiveTab] = useState<'entry' | 'exit'>('entry');

  // Scanner & Entry states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedToken, setScannedToken] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    booking?: Booking;
    error?: string;
  } | null>(null);

  const [confirmingEntry, setConfirmingEntry] = useState(false);
  const [entrySuccessMessage, setEntrySuccessMessage] = useState<string | null>(null);

  // Walk-in modal states
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [freeSlots, setFreeSlots] = useState<ParkingSlot[]>([]);
  const [walkInSlot, setWalkInSlot] = useState<SlotId | null>(null);
  const [walkInDriver, setWalkInDriver] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPlate, setWalkInPlate] = useState('');
  const [walkInHours, setWalkInHours] = useState(1);
  const [assigningWalkIn, setAssigningWalkIn] = useState(false);

  // Exit / Checkout states
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [checkoutVehicle, setCheckoutVehicle] = useState('');
  const [selectedForCheckout, setSelectedForCheckout] = useState<Booking | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    booking?: Booking;
    feeBreakdown?: {
      durationMinutes: number;
      billedHours: number;
      amount: number;
    };
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Fetch free slots & active sessions
  const loadGateData = async () => {
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        fetch('/api/slots'),
        fetch('/api/bookings'),
      ]);

      if (slotsRes.ok) {
        const sData = await slotsRes.json();
        const available = (sData.slots as ParkingSlot[]).filter(
          (s) => s.status === 'free' && s.id !== 'G3' && s.id !== 'F3'
        );
        // Sensor slots first: G1, G2, F1, then F2
        available.sort((a, b) => {
          if (a.type === 'sensor' && b.type !== 'sensor') return -1;
          if (a.type !== 'sensor' && b.type === 'sensor') return 1;
          return a.code.localeCompare(b.code);
        });
        setFreeSlots(available);
        if (available.length > 0 && !walkInSlot) {
          setWalkInSlot(available[0].id);
        }
      }

      if (bookingsRes.ok) {
        const bData = await bookingsRes.json();
        const activeList = (bData.bookings as Booking[]).filter(
          (b) => b.status === 'active' || b.status === 'booked'
        );
        setActiveBookings(activeList);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadGateData();
  }, []);

  // Initialize and toggle camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader-container');
      }

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('No webcam detected on this device.');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleTokenScanned(decodedText);
          stopCamera();
        },
        () => {
          // Frame scan error, ignore
        }
      );

      setCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webcam access failed';
      setCameraError(`${msg}. You can also paste or click a test booking token.`);
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && cameraActive) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignored
      }
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Handle scanned token
  const handleTokenScanned = async (token: string) => {
    setScannedToken(token);
    setVerifying(true);
    setVerificationResult(null);
    setEntrySuccessMessage(null);

    try {
      const res = await fetch('/api/bookings/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setVerificationResult({
          valid: false,
          booking: data.booking,
          error: data.error || 'QR Verification failed.',
        });
        toast.error(data.error || 'Invalid QR code.');
      } else {
        setVerificationResult({
          valid: true,
          booking: data.booking,
        });
        toast.success('Valid Cryptographic QR Pass!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification error';
      setVerificationResult({ valid: false, error: msg });
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  // Confirm Entry
  const handleConfirmEntry = async () => {
    if (!verificationResult?.booking) return;

    setConfirmingEntry(true);
    try {
      const res = await fetch('/api/gate/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: verificationResult.booking.id,
          isWalkIn: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      setEntrySuccessMessage(data.message);
      toast.success(data.message);
      loadGateData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      toast.error(msg);
    } finally {
      setConfirmingEntry(false);
    }
  };

  // Assign Walk-in
  const handleAssignWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInSlot || !walkInPlate.trim()) {
      toast.error('Please fill in vehicle number and select a slot.');
      return;
    }

    setAssigningWalkIn(true);
    try {
      const res = await fetch('/api/gate/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isWalkIn: true,
          walkInData: {
            slot_code: walkInSlot,
            driver_name: walkInDriver.trim() || 'Walk-In Guest',
            phone: walkInPhone.trim() || '9999999999',
            vehicle_number: walkInPlate.trim().toUpperCase(),
            hours: walkInHours,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Walk-in failed');

      toast.success(data.message);
      setWalkInOpen(false);
      setWalkInPlate('');
      setWalkInDriver('');
      loadGateData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Walk-in failed';
      toast.error(msg);
    } finally {
      setAssigningWalkIn(false);
    }
  };

  // Perform Check Out
  const handleCheckOut = async (bookingId: string) => {
    setCheckingOut(true);
    setCheckoutSuccess(null);

    try {
      const res = await fetch('/api/gate/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setCheckoutSuccess(data);
      toast.success('Vehicle successfully checked out!');
      loadGateData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      toast.error(msg);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c182a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-[#0F9D9A]" />
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B2545] dark:text-white tracking-tight">
              Gate Staff Kiosk
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Scan booking QR codes via webcam, assign walk-ins, and process exits with fee calculation.
          </p>
        </div>

        {/* Tab switch */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('entry')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'entry'
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Entrance Gate
          </button>
          <button
            onClick={() => setActiveTab('exit')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'exit'
                ? 'bg-[#0B2545] dark:bg-[#0F9D9A] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Exit / Check Out
          </button>
        </div>
      </div>

      {/* ENTRANCE GATE TAB */}
      {activeTab === 'entry' && (
        <div className="space-y-6">
          {/* Action Bar: Start Camera & Walk-in button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0c827f] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Scanner</span>
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <span>Stop Camera</span>
                </button>
              )}

              <button
                onClick={() => setWalkInOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0B2545] dark:text-white text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Car className="w-4 h-4 text-[#F2A541]" />
                <span>No Booking? Walk-in Driver</span>
              </button>
            </div>

            <span className="text-xs font-semibold text-slate-500">
              {freeSlots.length} Free Slots Available
            </span>
          </div>

          {/* Camera Viewport */}
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center justify-center">
            <div
              id="qr-reader-container"
              className={`w-full max-w-sm rounded-2xl overflow-hidden border-2 border-dashed ${
                cameraActive ? 'border-[#0F9D9A]' : 'border-slate-300 dark:border-slate-700'
              }`}
            />

            {!cameraActive && (
              <div className="py-8 text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <QrCode className="w-8 h-8" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Camera is currently off
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Click &quot;Start Camera Scanner&quot; above to scan with your MacBook/phone webcam, or select a booked pass below.
                </p>
              </div>
            )}

            {cameraError && (
              <p className="mt-3 text-xs text-rose-500 text-center font-medium">{cameraError}</p>
            )}

            {/* Quick Demo QR Test Selector */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-2 text-center">
                Quick Scan Shortcut: Test with active bookings
              </span>
              <div className="flex flex-wrap gap-2 justify-center">
                {activeBookings.slice(0, 4).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      if (b.qr_token) handleTokenScanned(b.qr_token);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Simulate Scan: Slot {b.slot_code} ({b.vehicle_number})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Verification Result Card */}
          {verifying && (
            <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800/80 text-center text-xs font-bold text-slate-500 animate-pulse">
              Verifying Cryptographic HMAC Signature on Server...
            </div>
          )}

          {verificationResult && (
            <div
              className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
                verificationResult.valid
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {verificationResult.valid ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                  )}
                  <h3
                    className={`font-black text-lg ${
                      verificationResult.valid ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {verificationResult.valid ? 'QR Verified & Valid for Entry' : 'QR Verification Rejected'}
                  </h3>
                </div>

                {verificationResult.valid && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                    Signature Valid
                  </span>
                )}
              </div>

              {verificationResult.valid && verificationResult.booking && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
                  <div>
                    <span className="text-slate-500 block">Assigned Slot:</span>
                    <span className="font-black text-xl text-[#0B2545] dark:text-white">
                      Slot {verificationResult.booking.slot_code}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Driver Name:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {verificationResult.booking.driver_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Vehicle Plate:</span>
                    <span className="font-bold uppercase tracking-wider text-[#0F9D9A]">
                      {verificationResult.booking.vehicle_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration / Fee:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {verificationResult.booking.hours} hrs ({formatINR(verificationResult.booking.amount)})
                    </span>
                  </div>
                </div>
              )}

              {!verificationResult.valid && (
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {verificationResult.error}
                </p>
              )}

              {/* Confirm Entry CTA */}
              {verificationResult.valid && (
                <div className="pt-2">
                  <button
                    onClick={handleConfirmEntry}
                    disabled={confirmingEntry}
                    className="w-full py-3.5 rounded-2xl bg-[#0B2545] dark:bg-[#0F9D9A] text-white dark:text-[#08111e] font-black text-sm shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2"
                  >
                    <DoorOpen className="w-5 h-5" />
                    <span>
                      {confirmingEntry
                        ? 'Triggering Servo & Slot LED...'
                        : 'Confirm Entry & Open Gate Servo'}
                    </span>
                  </button>
                </div>
              )}

              {entrySuccessMessage && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 text-xs text-emerald-800 dark:text-emerald-200 font-bold">
                  ✓ {entrySuccessMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXIT / CHECK OUT TAB */}
      {activeTab === 'exit' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-[#0B2545] dark:text-white">
              Exit Gate Checkout & Fee Settlement
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an active vehicle below or enter plate number to calculate final bill (walk-in durations rounded up to next hour).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-[#0B2545] dark:text-white">
                        Slot {b.slot_code}
                      </span>
                      <span className="text-xs font-semibold text-[#0F9D9A]">
                        {b.vehicle_number}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {b.driver_name} • {b.walk_in ? 'Walk-in' : 'Pre-booked'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCheckOut(b.id)}
                    disabled={checkingOut}
                    className="px-3.5 py-2 rounded-xl bg-[#0B2545] dark:bg-[#0F9D9A] text-white dark:text-[#08111e] text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Check Out</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {checkoutSuccess && (
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base">Session Completed & Billed</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block">Duration</span>
                  <span className="font-bold">{checkoutSuccess.feeBreakdown?.durationMinutes} mins</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Billed Hours</span>
                  <span className="font-bold">{checkoutSuccess.feeBreakdown?.billedHours} hr(s)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Final Tariff</span>
                  <span className="font-black text-lg text-emerald-700 dark:text-emerald-400">
                    {formatINR(checkoutSuccess.feeBreakdown?.amount ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Slot Released</span>
                  <span className="font-bold text-[#0F9D9A]">
                    Slot {checkoutSuccess.booking?.slot_code}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WALK-IN ALLOCATION MODAL */}
      {walkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0c182a] rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-[#0B2545] dark:text-white">
                Walk-In Slot Assignment
              </h3>
              <button
                onClick={() => setWalkInOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleAssignWalkIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Available Slots (Sensor Slots First)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {freeSlots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setWalkInSlot(s.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        walkInSlot === s.id
                          ? 'border-[#0F9D9A] bg-[#0F9D9A]/10 text-[#0F9D9A] font-black ring-2 ring-[#0F9D9A]/40'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="block font-bold text-sm">Slot {s.id}</span>
                      <span className="text-[10px] text-slate-500">
                        {s.type === 'sensor' ? 'Sensor' : 'Virtual'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="walkin-vehicle-plate-number" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Vehicle Plate Number *
                </label>
                <input
                  id="walkin-vehicle-plate-number"
                  type="text"
                  placeholder="e.g. MH 04 CD 1234"
                  value={walkInPlate}
                  onChange={(e) => setWalkInPlate(e.target.value.toUpperCase())}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold tracking-wider uppercase focus:ring-2 focus:ring-[#0F9D9A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="walkin-driver-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                    Driver Name
                  </label>
                  <input
                    id="walkin-driver-name"
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={walkInDriver}
                    onChange={(e) => setWalkInDriver(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="walkin-driver-phone" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                    Phone (Optional)
                  </label>
                  <input
                    id="walkin-driver-phone"
                    type="tel"
                    placeholder="+91..."
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={assigningWalkIn || !walkInSlot}
                  className="w-full py-3.5 rounded-2xl bg-[#0F9D9A] hover:bg-[#0c827f] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {assigningWalkIn ? 'Assigning...' : `Assign Slot ${walkInSlot || ''} & Open Gate`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
