import { NextRequest, NextResponse } from 'next/server';
import { cancelTask } from '../../../../../lib/aegisMock';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const task = cancelTask(params.id);
  if (!task) {
    return NextResponse.json(
      { code: 'TASK_NOT_FOUND', message: 'Task not found' },
      { status: 404 },
    );
  }
  return NextResponse.json(task);
}
