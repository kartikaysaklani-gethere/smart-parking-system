import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings, isHardwareOnline, getTelemetryLogs } from '@/lib/store';

export async function GET() {
  try {
    const settings = await getSettings();
    const online = isHardwareOnline();
    const logs = getTelemetryLogs();

    return NextResponse.json({
      settings,
      hardware: {
        online,
        lastSeen: settings.device_last_seen,
        recentTelemetryCount: logs.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error reading settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
