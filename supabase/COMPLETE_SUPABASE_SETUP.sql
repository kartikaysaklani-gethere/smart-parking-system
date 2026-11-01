-- ==========================================================
-- SMART PARKING SYSTEM: COMPLETE ALL-IN-ONE SUPABASE SQL SETUP
-- Copy all of this file and paste it into the Supabase SQL Editor,
-- then click "Run".
-- ==========================================================

-- 1. Enable Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "btree_gist";

-- 2. Tables
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  phone text default '',
  role text not null default 'user' check (role in ('user', 'staff', 'admin')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.slots (
  id text primary key, -- 'G1', 'G2', 'G3', 'F1', 'F2', 'F3'
  code text not null,
  floor integer not null check (floor in (0, 1)), -- 0: Ground, 1: First
  type text not null check (type in ('sensor', 'virtual')),
  status text not null default 'free' check (status in ('free', 'booked', 'assigned', 'occupied', 'reserved', 'maintenance')),
  assigned_booking_id uuid,
  notes text,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slot_code text not null references public.slots(id) on delete restrict,
  driver_name text not null,
  phone text not null,
  vehicle_number text not null,
  car_model text,
  car_color text,
  start_time timestamptz not null,
  hours integer not null check (hours >= 1 and hours <= 24),
  amount numeric(10, 2) not null default 0.00,
  status text not null default 'booked' check (status in ('booked', 'active', 'completed', 'cancelled', 'expired', 'no_show')),
  qr_token text,
  walk_in boolean not null default false,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.slots
  drop constraint if exists fk_slots_assigned_booking,
  add constraint fk_slots_assigned_booking foreign key (assigned_booking_id) references public.bookings(id) on delete set null;

create table if not exists public.telemetry_log (
  id bigint generated always as identity primary key,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  slots jsonb not null,
  gate jsonb,
  device_ip text
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.telemetry_log enable row level security;
alter table public.settings enable row level security;

create or replace function public.is_admin_or_staff()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- RLS Policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Anyone can view slots" on public.slots;
create policy "Anyone can view slots" on public.slots for select using (true);

drop policy if exists "Admin or staff can update slots" on public.slots;
create policy "Admin or staff can update slots" on public.slots for update using (public.is_admin_or_staff());

drop policy if exists "Admin can insert or delete slots" on public.slots;
create policy "Admin can insert or delete slots" on public.slots for all using (public.is_admin());

drop policy if exists "Users can view own bookings, staff/admin can view all" on public.bookings;
create policy "Users can view own bookings, staff/admin can view all" on public.bookings for select using (auth.uid() = user_id or public.is_admin_or_staff());

drop policy if exists "Authenticated users can create bookings" on public.bookings;
create policy "Authenticated users can create bookings" on public.bookings for insert with check (auth.uid() = user_id or user_id is null or public.is_admin_or_staff());

drop policy if exists "Users can cancel own pending bookings before start, staff/admin can update" on public.bookings;
create policy "Users can cancel own pending bookings before start, staff/admin can update" on public.bookings for update using (
  (auth.uid() = user_id and status = 'booked' and start_time > now()) or public.is_admin_or_staff()
);

drop policy if exists "Anyone can view settings" on public.settings;
create policy "Anyone can view settings" on public.settings for select using (true);

drop policy if exists "Admin can modify settings" on public.settings;
create policy "Admin can modify settings" on public.settings for all using (public.is_admin());

drop policy if exists "Staff and admin can view telemetry logs" on public.telemetry_log;
create policy "Staff and admin can view telemetry logs" on public.telemetry_log for select using (public.is_admin_or_staff());

drop policy if exists "System can insert telemetry logs" on public.telemetry_log;
create policy "System can insert telemetry logs" on public.telemetry_log for insert with check (true);

-- 4. Overlap Prevention & Transactional Reservation
create or replace function public.book_slot_transactional(
  p_user_id uuid,
  p_slot_code text,
  p_driver_name text,
  p_phone text,
  p_vehicle_number text,
  p_car_model text,
  p_car_color text,
  p_start_time timestamptz,
  p_hours integer,
  p_amount numeric,
  p_qr_token text,
  p_walk_in boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_slot_record record;
  v_booking_id uuid;
  v_end_time timestamptz;
  v_conflict_count integer;
begin
  select * into v_slot_record from public.slots where id = p_slot_code for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND: Slot % does not exist.', p_slot_code;
  end if;

  if v_slot_record.status = 'maintenance' then
    raise exception 'SLOT_MAINTENANCE: Slot % is currently under maintenance.', p_slot_code;
  end if;

  if v_slot_record.status = 'reserved' and not p_walk_in then
    raise exception 'SLOT_RESERVED: Slot % is permanently reserved.', p_slot_code;
  end if;

  v_end_time := p_start_time + (p_hours || ' hours')::interval;

  select count(*) into v_conflict_count
  from public.bookings
  where slot_code = p_slot_code
    and status in ('booked', 'active')
    and tstzrange(start_time, start_time + (hours || ' hours')::interval) && tstzrange(p_start_time, v_end_time);

  if v_conflict_count > 0 then
    raise exception 'SLOT_ALREADY_BOOKED: Slot % is already booked for this interval.', p_slot_code;
  end if;

  insert into public.bookings (
    user_id, slot_code, driver_name, phone, vehicle_number, car_model, car_color, start_time, hours, amount, status, qr_token, walk_in
  ) values (
    p_user_id, p_slot_code, p_driver_name, p_phone, upper(trim(p_vehicle_number)), p_car_model, p_car_color, p_start_time, p_hours, p_amount, 'booked', p_qr_token, p_walk_in
  )
  returning id into v_booking_id;

  if p_walk_in or (p_start_time <= now() and v_end_time >= now() and v_slot_record.status = 'free') then
    update public.slots
    set status = 'booked', assigned_booking_id = v_booking_id, updated_at = now()
    where id = p_slot_code;
  end if;

  return v_booking_id;
end;
$$;

-- 5. Cleanup Cron
create or replace function public.cleanup_expired_bookings()
returns table(expired_count integer)
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.bookings
    set status = 'no_show', updated_at = now()
    where status = 'booked' and start_time + interval '30 minutes' < now()
    returning id, slot_code
  )
  update public.slots s
  set status = 'free', assigned_booking_id = null, updated_at = now()
  from expired e
  where s.id = e.slot_code and s.assigned_booking_id = e.id and s.status in ('booked', 'assigned');

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;

-- 6. Initial Seed Data (6 Slots & Pricing)
insert into public.slots (id, code, floor, type, status, notes)
values
  ('G1', 'G1', 0, 'sensor', 'free', 'Ground Floor - ESP32 Ultrasonic Sensor'),
  ('G2', 'G2', 0, 'sensor', 'free', 'Ground Floor - ESP32 Ultrasonic Sensor'),
  ('G3', 'G3', 0, 'virtual', 'occupied', 'Ground Floor - Dummy Car Model (Always Occupied)'),
  ('F1', 'F1', 1, 'sensor', 'free', '1st Floor - ESP32 Ultrasonic Sensor'),
  ('F2', 'F2', 1, 'virtual', 'free', '1st Floor - Online Bookable Slot'),
  ('F3', 'F3', 1, 'virtual', 'reserved', '1st Floor - Permanently Reserved')
on conflict (id) do update set
  floor = excluded.floor, type = excluded.type, status = excluded.status, notes = excluded.notes;

insert into public.settings (key, value, updated_at)
values
  ('price_per_hour', '40'::jsonb, now()),
  ('device_last_seen', 'null'::jsonb, now()),
  ('latest_assignment', 'null'::jsonb, now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 7. Enable Realtime Publications
alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.telemetry_log;
