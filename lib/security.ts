import { NextResponse } from 'next/server'

const isProduction = process.env.NODE_ENV === 'production'
const allowDevApiTools = process.env.ENABLE_DEV_API_TOOLS === 'true'

export function blockDevOnlyRoute() {
  if (isProduction && !allowDevApiTools) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return null
}

export function safeErrorLog(context: string, error: unknown) {
  if (!isProduction) {
    console.error(context, error)
    return
  }

  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`${context} (${message})`)
}