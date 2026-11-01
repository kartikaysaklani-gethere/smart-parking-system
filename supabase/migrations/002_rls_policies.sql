-- Smart Parking System Database Schema
-- Migration 002: Row Level Security (RLS) Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.telemetry_log enable row level security;
alter table public.settings enable row level security;

-- Helper function to check if the current user is an admin or staff
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

-- 1. Profiles Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2. Slots Policies (Public read, Admin/Staff update)
create policy "Anyone can view slots"
  on public.slots for select
  using (true);

create policy "Admin or staff can update slots"
  on public.slots for update
  using (public.is_admin_or_staff());

create policy "Admin can insert or delete slots"
  on public.slots for all
  using (public.is_admin());

-- 3. Bookings Policies
create policy "Users can view own bookings, staff/admin can view all"
  on public.bookings for select
  using (auth.uid() = user_id or public.is_admin_or_staff());

create policy "Authenticated users can create bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id or user_id is null or public.is_admin_or_staff());

create policy "Users can cancel own pending bookings before start, staff/admin can update"
  on public.bookings for update
  using (
    (auth.uid() = user_id and status = 'booked' and start_time > now())
    or public.is_admin_or_staff()
  );

-- 4. Settings Policies
create policy "Anyone can view settings"
  on public.settings for select
  using (true);

create policy "Admin can modify settings"
  on public.settings for all
  using (public.is_admin());

-- 5. Telemetry Log Policies
create policy "Staff and admin can view telemetry logs"
  on public.telemetry_log for select
  using (public.is_admin_or_staff());

create policy "System can insert telemetry logs"
  on public.telemetry_log for insert
  with check (true);
