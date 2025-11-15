import { NextRequest, NextResponse } from 'next/server';
import { getMonitor, deleteMonitor } from '../../../../lib/aegisMock';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const monitor = getMonitor(params.id);
  if (!monitor) {
    return NextResponse.json(
      { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      { status: 404 },
    );
  }
  return NextResponse.json(monitor);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const deleted = deleteMonitor(params.id);
  if (!deleted) {
    return NextResponse.json(
      { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      { status: 404 },
    );
  }
  return NextResponse.json({}, { status: 204 });
}
