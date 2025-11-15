import { NextRequest, NextResponse } from 'next/server';
import { createMockTask } from '../../../lib/aegisMock';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.taskType !== 'string') {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'taskType is required' },
      { status: 400 },
    );
  }

  const task = createMockTask({
    taskType: body.taskType,
    instructions: typeof body.instructions === 'string' ? body.instructions : undefined,
  });

  return NextResponse.json(task, { status: 202 });
}
