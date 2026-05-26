import { NextRequest, NextResponse } from 'next/server'
import { getServerConfig } from '../../../../../lib/config'

export async function GET(req: NextRequest) {
  const config = getServerConfig()
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  const provider = searchParams.get('provider')

  const endpoint = provider === 'veo'
    ? `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`
    : `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${config.kieKey}` }
  })
  const data = await res.json()
  return NextResponse.json(data)
}
