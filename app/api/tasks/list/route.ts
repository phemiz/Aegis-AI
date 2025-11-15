import { NextResponse } from 'next/server';
import { listTasks } from '../../../../lib/aegisMock';

export async function GET() {
  const tasks = listTasks();
  return NextResponse.json({ tasks });
}
