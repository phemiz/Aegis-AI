import { NextRequest, NextResponse } from 'next/server';
import { getTaskResult } from '../../../../../lib/aegisMock';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = getTaskResult(params.id);
  if (!result) {
    return NextResponse.json(
      { code: 'RESULT_NOT_FOUND', message: 'Task result not available yet' },
      { status: 404 },
    );
  }
  return NextResponse.json(result);
}
