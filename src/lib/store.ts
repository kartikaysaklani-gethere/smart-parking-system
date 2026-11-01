import { ParkingSlot, Booking, SlotId, TelemetryPayload, TelemetryResponse, SettingsMap } from './types';
import { generateSignedQRToken } from './qr';
import { DEFAULT_HOURLY_RATE } from './pricing';
import { createAdminClient } from './supabase/server';

// Initial 6 Slots Configuration
const INITIAL_SLOTS: Record<SlotId, ParkingSlot> = {
  G1: {
    id: 'G1',
    code: 'G1',
    floor: 0,
    type: 'sensor',
    status: 'free',
    notes: 'Ground Floor - ESP32 Ultrasonic Sensor',
    updated_at: new Date().toISOString(),
  },
  G2: {
    id: 'G2',
    code: 'G2',
    floor: 0,
    type: 'sensor',
    status: 'free',
    notes: 'Ground Floor - ESP32 Ultrasonic Sensor',
    updated_at: new Date().toISOString(),
  },
  G3: {
    id: 'G3',
    code: 'G3',
    floor: 0,
    type: 'virtual',
    status: 'occupied',
    notes: 'Ground Floor - Dummy Car Pasted (Always Occupied)',
    updated_at: new Date().toISOString(),
  },
  F1: {
    id: 'F1',
    code: 'F1',
    floor: 1,
    type: 'sensor',
    status: 'free',
    notes: '1st Floor - ESP32 Ultrasonic Sensor',
    updated_at: new Date().toISOString(),
  },
  F2: {
    id: 'F2',
    code: 'F2',
    floor: 1,
    type: 'virtual',
    status: 'free',
    notes: '1st Floor - Virtual Slot for Online Booking',
    updated_at: new Date().toISOString(),
  },
  F3: {
    id: 'F3',
    code: 'F3',
    floor: 1,
    type: 'virtual',
    status: 'reserved',
    notes: '1st Floor - Virtual Slot Permanently Reserved',
    updated_at: new Date().toISOString(),
  },
};

// Global in-memory storage (shared across Next.js API requests in development)
interface MemoryStore {
  slots: Record<SlotId, ParkingSlot>;
  bookings: Booking[];
  settings: SettingsMap;
  lastTelemetry: {
    timestamp: number;
    payload: TelemetryPayload;
  } | null;
  telemetryLogs: Array<{ id: number; created_at: string; slots: Record<string, boolean>; gate?: Record<string, unknown> }>;
}

const globalForStore = globalThis as unknown as {
  __smartParkingStore?: MemoryStore;
};

if (!globalForStore.__smartParkingStore) {
  globalForStore.__smartParkingStore = {
    slots: { ...INITIAL_SLOTS },
    bookings: [
      {
        id: '11111111-1111-1111-1111-111111111101',
        slot_code: 'G1',
        driver_name: 'Aarav Sharma',
        phone: '+91 98765 43210',
        vehicle_number: 'DL 01 AB 1234',
        car_model: 'Honda City',
        car_color: 'Silver',
        start_time: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        hours: 2,
        amount: 80,
        status: 'completed',
        walk_in: false,
        checked_in_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        checked_out_at: new Date(Date.now() - 46 * 3600 * 1000).toISOString(),
        created_at: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
      },
      {
        id: '11111111-1111-1111-1111-111111111102',
        slot_code: 'G2',
        driver_name: 'Rohan Verma',
        phone: '+91 98123 45678',
        vehicle_number: 'MH 02 CD 5678',
        car_model: 'Hyundai Creta',
        car_color: 'White',
        start_time: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        hours: 3,
        amount: 120,
        status: 'completed',
        walk_in: false,
        checked_in_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        checked_out_at: new Date(Date.now() - 21 * 3600 * 1000).toISOString(),
        created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      },
      {
        id: '11111111-1111-1111-1111-111111111103',
        slot_code: 'F1',
        driver_name: 'Pooja Nair',
        phone: '+91 97234 56789',
        vehicle_number: 'KA 05 EF 9012',
        car_model: 'Tata Nexon EV',
        car_color: 'Blue',
        start_time: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        hours: 2,
        amount: 80,
        status: 'completed',
        walk_in: true,
        checked_in_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        checked_out_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      },
    ],
    settings: {
      price_per_hour: DEFAULT_HOURLY_RATE,
      device_last_seen: null,
      latest_assignment: null,
      garage_name: 'Smart Parking Campus Garage',
    },
    lastTelemetry: null,
    telemetryLogs: [],
  };
}

const memoryStore = globalForStore.__smartParkingStore;

function isLiveSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && !url.includes('dummy') && key && !key.includes('dummy'));
}

/**
 * Get all slots
 */
export async function getSlots(): Promise<ParkingSlot[]> {
  if (isLiveSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('slots').select('*').order('code');
      if (!error && data && data.length > 0) {
        return data as ParkingSlot[];
      }
    } catch {
      // Fallback
    }
  }
  return Object.values(memoryStore.slots).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Get a single slot by ID
 */
export async function getSlotById(id: SlotId): Promise<ParkingSlot | null> {
  const slots = await getSlots();
  return slots.find((s) => s.id === id) || null;
}

/**
 * Update a slot's status or attributes
 */
export async function updateSlot(id: SlotId, updates: Partial<ParkingSlot>): Promise<ParkingSlot> {
  const existing = memoryStore.slots[id] || INITIAL_SLOTS[id];
  const updated: ParkingSlot = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  memoryStore.slots[id] = updated;

  if (isLiveSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('slots').update(updated).eq('id', id);
    } catch {
      // Ignore fallback
    }
  }

  return updated;
}

/**
 * Get all bookings
 */
export async function getBookings(userId?: string): Promise<Booking[]> {
  if (isLiveSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      let query = supabase.from('bookings').select('*').order('start_time', { ascending: false });
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Booking[];
      }
    } catch {
      // Fallback
    }
  }

  let list = [...memoryStore.bookings];
  if (userId) {
    list = list.filter((b) => b.user_id === userId);
  }
  return list.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

/**
 * Get booking by ID
 */
export async function getBookingById(id: string): Promise<Booking | null> {
  if (isLiveSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
      if (!error && data) {
        return data as Booking;
      }
    } catch {
      // Fallback
    }
  }
  return memoryStore.bookings.find((b) => b.id === id) || null;
}

/**
 * Overlap check and transactional booking creation
 */
export interface CreateBookingParams {
  user_id?: string | null;
  slot_code: SlotId;
  driver_name: string;
  phone: string;
  vehicle_number: string;
  car_model?: string;
  car_color?: string;
  start_time: string; // ISO String
  hours: number;
  amount?: number;
  walk_in?: boolean;
}

export async function createBooking(params: CreateBookingParams): Promise<Booking> {
  const slot = await getSlotById(params.slot_code);
  if (!slot) {
    throw new Error(`Slot ${params.slot_code} does not exist.`);
  }

  if (slot.status === 'maintenance') {
    throw new Error(`Slot ${params.slot_code} is currently under maintenance.`);
  }

  if (slot.status === 'reserved' && !params.walk_in) {
    throw new Error(`Slot ${params.slot_code} is permanently reserved.`);
  }

  if (slot.id === 'G3' && !params.walk_in) {
    throw new Error(`Slot G3 is a dummy occupied slot and cannot be booked online.`);
  }

  const requestedStart = new Date(params.start_time).getTime();
  const requestedEnd = requestedStart + params.hours * 3600 * 1000;

  // Overlap verification with active/booked entries
  const existingBookings = await getBookings();
  const conflict = existingBookings.find((b) => {
    if (b.slot_code !== params.slot_code) return false;
    if (b.status !== 'booked' && b.status !== 'active') return false;

    const bStart = new Date(b.start_time).getTime();
    const bEnd = bStart + b.hours * 3600 * 1000;

    // Overlap condition: bStart < requestedEnd && requestedStart < bEnd
    return bStart < requestedEnd && requestedStart < bEnd;
  });

  if (conflict) {
    throw new Error(
      `Slot ${params.slot_code} is already booked from ${new Date(conflict.start_time).toLocaleTimeString()} to ${new Date(new Date(conflict.start_time).getTime() + conflict.hours * 3600 * 1000).toLocaleTimeString()}. Please select a different slot or time.`
    );
  }

  const settings = await getSettings();
  const calculatedAmount = params.amount ?? params.hours * settings.price_per_hour;
  const bookingId = crypto.randomUUID();

  // Generate cryptographically signed QR token
  const qrToken = generateSignedQRToken({
    bookingId,
    driverName: params.driver_name,
    phone: params.phone,
    vehicleNumber: params.vehicle_number.toUpperCase().trim(),
    carModel: params.car_model,
    carColor: params.car_color,
    slotCode: params.slot_code,
    startTime: params.start_time,
    hours: params.hours,
    amount: calculatedAmount,
    issuedAt: Date.now(),
  });

  const now = new Date().toISOString();
  const newBooking: Booking = {
    id: bookingId,
    user_id: params.user_id || null,
    slot_code: params.slot_code,
    driver_name: params.driver_name,
    phone: params.phone,
    vehicle_number: params.vehicle_number.toUpperCase().trim(),
    car_model: params.car_model || '',
    car_color: params.car_color || '',
    start_time: params.start_time,
    hours: params.hours,
    amount: calculatedAmount,
    status: 'booked',
    qr_token: qrToken,
    walk_in: Boolean(params.walk_in),
    created_at: now,
    updated_at: now,
  };

  memoryStore.bookings.push(newBooking);

  // If this is an immediate booking or walk-in, update slot status
  if (params.walk_in || requestedStart <= Date.now()) {
    await updateSlot(params.slot_code, {
      status: 'booked',
      assigned_booking_id: bookingId,
    });
  }

  if (isLiveSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('bookings').insert(newBooking);
    } catch {
      // Fallback handled
    }
  }

  return newBooking;
}

/**
 * Cancel a booking (allowed before start time)
 */
export async function cancelBooking(bookingId: string): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error('Booking not found.');
  }

  if (booking.status !== 'booked') {
    throw new Error(`Cannot cancel booking with status '${booking.status}'.`);
  }

  const updated: Booking = {
    ...booking,
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  };

  const idx = memoryStore.bookings.findIndex((b) => b.id === bookingId);
  if (idx !== -1) {
    memoryStore.bookings[idx] = updated;
  }

  // Release slot if assigned
  const slot = await getSlotById(booking.slot_code);
  if (slot && slot.assigned_booking_id === bookingId && slot.status === 'booked') {
    await updateSlot(booking.slot_code, {
      status: 'free',
      assigned_booking_id: null,
    });
  }

  return updated;
}

/**
 * Update booking status
 */
export async function updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
  const booking = await getBookingById(id);
  if (!booking) {
    throw new Error(`Booking ${id} not found.`);
  }

  const updated: Booking = {
    ...booking,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const idx = memoryStore.bookings.findIndex((b) => b.id === id);
  if (idx !== -1) {
    memoryStore.bookings[idx] = updated;
  }

  if (isLiveSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('bookings').update(updates).eq('id', id);
    } catch {
      // Ignore
    }
  }

  return updated;
}

/**
 * Get Settings
 */
export async function getSettings(): Promise<SettingsMap> {
  return memoryStore.settings;
}

/**
 * Update Settings
 */
export async function updateSettings(newSettings: Partial<SettingsMap>): Promise<SettingsMap> {
  memoryStore.settings = {
    ...memoryStore.settings,
    ...newSettings,
  };
  return memoryStore.settings;
}

/**
 * Log Telemetry & Update Device Last Seen
 */
export async function recordTelemetry(payload: TelemetryPayload): Promise<void> {
  memoryStore.lastTelemetry = {
    timestamp: Date.now(),
    payload,
  };
  memoryStore.settings.device_last_seen = new Date().toISOString();

  // Keep last 100 telemetry logs
  memoryStore.telemetryLogs.unshift({
    id: Date.now(),
    created_at: new Date().toISOString(),
    slots: (payload.slots as Record<string, boolean>) || {},
    gate: payload.gate as Record<string, unknown>,
  });
  if (memoryStore.telemetryLogs.length > 100) {
    memoryStore.telemetryLogs.pop();
  }
}

export function getTelemetryLogs() {
  return memoryStore.telemetryLogs;
}

export function isHardwareOnline(): boolean {
  if (!memoryStore.lastTelemetry) return false;
  // Hardware considered online if telemetry received within 6 seconds
  return Date.now() - memoryStore.lastTelemetry.timestamp <= 6000;
}
