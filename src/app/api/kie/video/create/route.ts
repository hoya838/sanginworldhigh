import { NextRequest, NextResponse } from 'next/server'
import { getServerConfig } from '../../../../../lib/config'

export async function POST(req: NextRequest) {
  const config = getServerConfig()
  if (!config.kieKey) return NextResponse.json({ error: 'kie.ai API 키가 설정되지 않았습니다.' }, { status: 400 })

  const body = await req.json()
  const { provider, ...videoBody } = body

  const endpoint = provider === 'kling'
    ? 'https://api.kie.ai/api/v1/jobs/createTask'
    : 'https://api.kie.ai/api/v1/veo/generate'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.kieKey}` },
    body: JSON.stringify(videoBody)
  })
  const data = await res.json()
  return NextResponse.json(data)
}
