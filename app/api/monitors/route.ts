import { NextRequest, NextResponse } from 'next/server';
import { listMonitors, createMonitor } from '../../../lib/aegisMock';

export async function GET() {
  const monitors = listMonitors();
  return NextResponse.json({ monitors });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.name !== 'string' ||
    typeof body.taskType !== 'string' ||
    typeof body.instructions !== 'string' ||
    typeof body.intervalMs !== 'number'
  ) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'name, taskType, instructions, and intervalMs are required' },
      { status: 400 },
    );
  }

  const monitor = createMonitor({
    name: body.name,
    taskType: body.taskType,
    instructions: body.instructions,
    intervalMs: body.intervalMs,
  });

  return NextResponse.json(monitor, { status: 201 });
}
