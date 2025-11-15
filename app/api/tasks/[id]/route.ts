import { NextRequest, NextResponse } from 'next/server';
import { getTask } from '../../../../lib/aegisMock';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const task = getTask(params.id);
  if (!task) {
    return NextResponse.json(
      { code: 'TASK_NOT_FOUND', message: 'Task not found' },
      { status: 404 },
    );
  }
  return NextResponse.json(task);
}
