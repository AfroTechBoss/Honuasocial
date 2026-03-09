import { NextResponse } from 'next/server'

const disabledResponse = NextResponse.json(
  {
    error: 'Referral maintenance API is disabled',
    message: 'This endpoint has been retired.',
  },
  { status: 410 }
)

export async function POST() {
  return disabledResponse
}

export async function GET() {
  return disabledResponse
}