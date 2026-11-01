export type SlotId = 'G1' | 'G2' | 'G3' | 'F1' | 'F2' | 'F3';

export type SlotType = 'sensor' | 'virtual';

export type SlotStatus = 'free' | 'booked' | 'assigned' | 'occupied' | 'reserved' | 'maintenance';

export interface ParkingSlot {
  id: SlotId;
  code: SlotId;
  floor: 0 | 1; // 0: Ground, 1: First
  type: SlotType;
  status: SlotStatus;
  assigned_booking_id?: string | null;
  notes?: string;
  updated_at: string;
}

export type BookingStatus =
  | 'booked'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_show';

export interface Booking {
  id: string;
  user_id?: string | null;
  slot_code: SlotId;
  driver_name: string;
  phone: string;
  vehicle_number: string;
  car_model?: string;
  car_color?: string;
  start_time: string; // ISO String
  hours: number;
  amount: number;
  status: BookingStatus;
  qr_token?: string;
  walk_in: boolean;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface QRPayloadData {
  bookingId: string;
  driverName: string;
  phone: string;
  vehicleNumber: string;
  carModel?: string;
  carColor?: string;
  slotCode: SlotId;
  startTime: string;
  hours: number;
  amount: number;
  issuedAt: number;
}

export interface SignedQRToken {
  data: QRPayloadData;
  signature: string;
}

export interface TelemetryPayload {
  slots: {
    G1?: boolean;
    G2?: boolean;
    F1?: boolean;
    [key: string]: boolean | undefined;
  };
  gate?: {
    car_present?: boolean;
    distance_cm?: number;
  };
}

export interface TelemetryResponse {
  leds: {
    G1: boolean;
    G2: boolean;
    F1: boolean;
    [key: string]: boolean;
  };
  lcd: [string, string]; // Exactly 2 lines for 16x2 LCD
  gate_hold: boolean;
  server_time: string;
}

export interface SettingsMap {
  price_per_hour: number;
  device_last_seen: string | null;
  latest_assignment: {
    slot_code: SlotId;
    assigned_at: string;
    booking_id: string;
  } | null;
  garage_name?: string;
}
