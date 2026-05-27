'use client'

import { useState, useEffect } from 'react'
import type {
  AppConfig, ImageItem, Prompts, Topic, ImagePrompt,
  Screen, StepInfo, PersonSetting, NarrationSetting, ContentMode, MarketMode, InputPhase,
} from '../types'
import InputScreen from '../components/InputScreen'
import ProcessingScreen from '../components/ProcessingScreen'
import ResultScreen from '../components/ResultScreen'
import SettingsModal from '../components/SettingsModal'
import ErrorModal from '../components/ErrorModal'
import Toast from '../components/Toast'

const DEFAULT_CONFIG: AppConfig = {
  geminiKey: '', kieKey: '', username: '사용자',
  modelLite: 'gemini-2.5-flash-preview-05-20',
  modelFlash: 'gemini-2.5-flash-preview-05-20',
  imageModel: 'gpt-image-2-image-to-image',
  videoModel: 'seedance2',
}

const DEFAULT_STEPS: StepInfo[] = [
  { name: '콘티보드 생성', desc: '광고 콘티보드를 제작하고 있어요.', status: 'pending' },
  { name: '영상 생성중',   desc: '이미지와 콘티보드를 바탕으로 영상을 만들고 있어요.', status: 'pending' },
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export default function Home() {
  const [screen, setScreen] = useState<Screen>('input')
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [prompts, setPrompts] = useState<Prompts | null>(null)
  const [ratio, setRatio] = useState<'9:16' | '16:9'>('16:9')
  const [images, setImages] = useState<ImageItem[]>([])
  const [subjectDescription, setSubjectDescription] = useState('')
  const [videoDescription, setVideoDescription] = useState('')

  // Input phase
  const [inputPhase, setInputPhase] = useState<InputPhase>('initial')
  const [studioSheet, setStudioSheet] = useState('')
  const [studioSheetLoading, setStudioSheetLoading] = useState(false)
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([])
  const [personSetting, setPersonSetting] = useState<PersonSetting>('random')
  const [narrationSetting, setNarrationSetting] = useState<NarrationSetting>('random')
  const [contentMode, setContentMode] = useState<ContentMode>('random')
  const [marketMode, setMarketMode] = useState<MarketMode>('domestic')
  const [backgroundImage, setBackgroundImage] = useState<ImageItem | null>(null)

  // Topic recommendation
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [topicsLoading, setTopicsLoading] = useState(false)

  // Processing
  const [steps, setSteps] = useState<StepInfo[]>(DEFAULT_STEPS)
  const [startTime, setStartTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Result outputs
  const [videoUrl, setVideoUrl] = useState('')
  const [genContiScript, setGenContiScript] = useState('')
  const [genVideoPrompt, setGenVideoPrompt] = useState('')
  const [genReferenceImages, setGenReferenceImages] = useState<string[]>([])

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showImageHint, setShowImageHint] = useState(false)
  const [showTopicHint, setShowTopicHint] = useState(false)
  const [toast, setToast] = useState({ message: '', visible: false })
  const [error, setError] = useState({ step: '', message: '', visible: false })

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then((c: AppConfig) => {
      setConfig(c)
      if (!c.geminiKey || !c.kieKey) setTimeout(() => setSettingsOpen(true), 300)
    })
    fetch('/api/prompts').then(r => r.json()).then(setPrompts)
  }, [])

  function showToast(message: string) {
    setToast({ message, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500)
  }

  async function handleSaveSettings(updated: AppConfig) {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setConfig(updated)
    setSettingsOpen(false)
    showToast('저장되었습니다.')
  }

  // ─── IMAGE UPLOAD ───
  async function addImages(files: File[]) {
    const newImages = [...images]
    for (const file of files) {
      if (newImages.length >= 6) { showToast('최대 6장까지 업로드 가능합니다.'); break }
      const dataUrl = await readFileAsDataURL(file)
      const base64 = dataUrl.split(',')[1]
      newImages.push({ file, dataUrl, base64, mimeType: file.type })
    }
    setImages(newImages)
    setShowImageHint(false)
    // Reset to initial when new images are added
    if (inputPhase !== 'initial') {
      setInputPhase('initial')
      setStudioSheet('')
      setOriginalImageUrls([])
      setTopics([])
      setSelectedTopic(null)
      setVideoDescription('')
    }
  }

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => {
        const original = e.target!.result as string
        const img = new Image()
        img.onload = () => {
          const MAX = 1280
          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
            else { width = Math.round(width * MAX / height); height = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width; canvas.height = height
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
          res(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = () => res(original)
        img.src = original
      }
      r.onerror = rej
      r.readAsDataURL(file)
    })
  }

  async function addBackgroundImage(file: File) {
    const dataUrl = await readFileAsDataURL(file)
    const base64 = dataUrl.split(',')[1]
    setBackgroundImage({ file, dataUrl, base64, mimeType: file.type })
  }

  function removeBackgroundImage() {
    setBackgroundImage(null)
  }

  function removeImage(idx: number) {
    setImages(imgs => imgs.filter((_, i) => i !== idx))
    if (inputPhase !== 'initial') {
      setInputPhase('initial')
      setStudioSheet('')
      setOriginalImageUrls([])
      setTopics([])
      setSelectedTopic(null)
      setVideoDescription('')
    }
  }

  // ─── GEMINI API ───
  async function callGemini(model: string, systemPrompt: string, imgs: ImageItem[], extraText = '') {
    const parts: object[] = [{ text: systemPrompt + (extraText ? '\n\n' + extraText : '') }]
    for (const img of imgs) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Gemini API 오류: ${(err as any)?.error?.message || res.statusText}`)
    }
    const data = await res.json()
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '') as string
  }

  // ─── SETTINGS CONTEXT ───
  function buildSettingsContext() {
    const personMap: Record<PersonSetting, string> = {
      random: '랜덤 (스토리 맥락에 맞게 결정)',
      use: '사용',
      none: '미사용',
    }
    const narMap: Record<NarrationSetting, string> = {
      random: '랜덤 (스토리 맥락에 맞게 결정)',
      use: '사용',
      none: '미사용',
    }
    const modeMap: Record<ContentMode, string> = {
      reels: '릴스용 (먹방/언박싱/챌린지/바이럴 포맷)',
      ad: '광고용 (TV/브랜드 광고, 시네마틱)',
      random: '랜덤',
    }
    const marketMap: Record<MarketMode, string> = {
      domestic: '국내 — 등장 인물은 반드시 한국인(동아시아 한국계) 외모·스타일로 설정',
      global: '글로벌 — 등장 인물은 외국인/다양한 인종으로 설정',
    }
    return [
      `[인물 설정] ${personMap[personSetting]}`,
      `[나레이션 설정] ${narMap[narrationSetting]}`,
      `[콘텐츠 모드] ${modeMap[contentMode]}`,
      `[지역 설정] ${marketMap[marketMode]}`,
    ].join('\n')
  }

  function buildTopicContext(topic: Topic) {
    return `[선택 주제] ${topic.title} / ${topic.description} / story_arc: ${topic.story_arc?.opening} → ${topic.story_arc?.build} → ${topic.story_arc?.payoff} / emotional_journey: ${topic.emotional_journey}`
  }

  // ─── STEP 0: STUDIO SHEET ───
  async function generateStudioSheet() {
    if (images.length === 0) { setShowImageHint(true); return }
    if (!prompts?.step0_studio) { showToast('프롬프트 로딩 중입니다.'); return }
    if (!config.geminiKey) { setSettingsOpen(true); return }
    if (!config.kieKey) { setSettingsOpen(true); return }

    setStudioSheetLoading(true)
    try {
      // Upload original images to kie.ai CDN first
      const uploaded = await uploadOriginalImages(images)
      setOriginalImageUrls(uploaded)

      // Gemini: analyze image → studio sheet image prompt
      const extra = subjectDescription.trim() ? `[피사체 설명]\n${subjectDescription.trim()}` : ''
      const raw = await callGemini(config.modelLite, prompts.step0_studio, images, extra)
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      const studioPrompt: ImagePrompt = {
        prompt: parsed.prompt || '',
        negativePrompt: parsed.negativePrompt || 'text, watermark, CGI, 3D render',
      }
      if (!studioPrompt.prompt) throw new Error('스튜디오 시트 프롬프트 생성 실패')

      // kie.ai: generate 4-angle studio sheet (16:9, 2x2 grid)
      const t0 = Date.now()
      const url = await generateOneImage(config.imageModel, studioPrompt, uploaded, t0, '16:9')
      setStudioSheet(url)
      setInputPhase('studio')
      showToast('스튜디오 시트가 생성되었어요!')
    } catch (e: any) {
      showToast(`스튜디오 시트 생성 오류: ${e.message}`)
    } finally {
      setStudioSheetLoading(false)
    }
  }

  // ─── STEP 1: TOPIC RECOMMENDATION ───
  async function runStep1() {
    if (images.length === 0) { setShowImageHint(true); return }
    if (!prompts) { showToast('프롬프트 로딩 중입니다.'); return }
    if (inputPhase === 'initial') { showToast('스튜디오 샷을 먼저 생성해주세요.'); return }

    setTopicsLoading(true)
    setTopics([])
    setSelectedTopic(null)

    try {
      const desc = videoDescription.trim()
      const subjectCtx = subjectDescription.trim() ? `[피사체 설명]\n${subjectDescription.trim()}` : ''
      const settingsCtx = buildSettingsContext()
      const extra = [
        subjectCtx,
        desc ? `[영상 방향]\n${desc}` : '',
        settingsCtx,
      ].filter(Boolean).join('\n')

      const raw = await callGemini(config.modelLite, prompts.step1 + '\nmode: detail', images, extra)
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      setTopics(parsed.topics || [])
    } catch (e: any) {
      showToast(`오류: ${e.message}`)
    } finally {
      setTopicsLoading(false)
    }
  }

  // ─── STEP STATE ───
  function updateStep(idx: number, status: StepInfo['status'], desc?: string, time?: string) {
    setSteps(prev => prev.map((s, i) =>
      i === idx ? { ...s, status, ...(desc ? { desc } : {}), ...(time ? { time } : {}) } : s
    ))
  }

  // ─── STORYBOARD PARSING ───
  function parseStoryboardImagePrompt(text: string): ImagePrompt {
    const block = text.match(/\[STORYBOARD IMAGE PROMPT\]([\s\S]*?)\[\/STORYBOARD IMAGE PROMPT\]/)
    if (!block) return {
      prompt: 'Professional advertising storyboard production document, A3 landscape format, multi-section editorial layout, white paper background, dark header bar with campaign title and tagline, left section: subject reference poses labeled front/side/back/detail, key visual elements with text labels, center section: 6 numbered cinematic storyboard frames in vertical sequence, each frame photorealistic film still thumbnail, short scene caption below each frame, right section: brand color palette swatches, cinematography notes per scene, thin dark dividers between sections, labeled annotations in clean sans-serif type, professional production layout, high detail',
      negativePrompt: 'blurry, watermark, low quality, CGI cartoon, misaligned sections, portrait orientation, pencil sketch, simple grid',
    }
    const promptMatch = block[1].match(/Prompt:\s*([\s\S]+?)(?:\nNegative:|$)/)
    const negMatch = block[1].match(/Negative:\s*(.+?)(?:\n|$)/)
    return {
      prompt: promptMatch?.[1]?.trim() || block[1].trim().substring(0, 500),
      negativePrompt: negMatch?.[1]?.trim() || 'blurry, watermark, low quality, CGI, 3D render, misaligned grid, extra panels, portrait orientation',
    }
  }

  // ─── IMAGE GENERATION ───
  function buildImageInput(model: string, p: ImagePrompt, refUrls: string[], imgRatio?: string) {
    const r = imgRatio || ratio
    const validRefs = refUrls.filter(Boolean)
    if (model === 'google/imagen4-fast')
      return { prompt: p.prompt, negative_prompt: p.negativePrompt, aspect_ratio: r, num_images: '1' }
    if (model === 'gpt-image-2-image-to-image')
      return { prompt: p.prompt, aspect_ratio: r, resolution: '2K', ...(validRefs.length > 0 && { input_urls: validRefs }) }
    return { prompt: p.prompt, aspect_ratio: r, resolution: '2K', output_format: 'jpg', ...(validRefs.length > 0 && { image_input: validRefs }) }
  }

  async function generateOneImage(model: string, p: ImagePrompt, refUrls: string[], t0: number, imgRatio?: string): Promise<string> {
    const input = buildImageInput(model, p, refUrls, imgRatio)
    console.log('[generateOneImage] model:', model, '| refs:', refUrls.filter(Boolean).length, '| ratio:', imgRatio || ratio)

    const attempt = async () => {
      const taskRes = await fetch('/api/kie/image/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input }),
      }).then(r => r.json())
      const taskId = taskRes?.data?.taskId
      if (!taskId) throw new Error(`kie.ai 이미지: taskId를 받지 못했습니다. 응답: ${JSON.stringify(taskRes)}`)
      return pollImageTask(taskId, t0)
    }

    try {
      return await attempt()
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('internal error')) {
        console.warn('[generateOneImage] 서버 오류, 10초 후 재시도:', err.message)
        await sleep(10000)
        return attempt()
      }
      throw err
    }
  }

  async function pollImageTask(taskId: string, t0: number, maxWaitMs = 360000) {
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
      await sleep(2000)
      let res: any
      try {
        res = await fetch(`/api/kie/image/poll?taskId=${taskId}`).then(r => r.json())
      } catch (e: any) {
        console.warn('[pollImageTask] 네트워크 오류, 재시도:', e.message)
        continue
      }
      const d = res?.data
      const s = d?.state
      if (s === 'success') {
        let result: any = {}
        try { result = JSON.parse(d.resultJson || '{}') } catch {}
        const url = result.resultUrls?.[0]
        if (!url) throw new Error('kie.ai 이미지: resultUrls가 비어 있습니다. (resultJson: ' + d.resultJson + ')')
        return url as string
      }
      if (s === 'fail') throw new Error(`kie.ai 이미지 실패: ${d?.failMsg || d?.failCode || taskId}`)
      console.log(`[pollImageTask] state="${s}", 경과=${Math.round((Date.now() - start) / 1000)}s`)
    }
    throw new Error('kie.ai 이미지 작업 시간 초과 (6분)')
  }

  // ─── UPLOAD ORIGINAL IMAGES ───
  async function uploadOriginalImages(imgs: ImageItem[]): Promise<string[]> {
    const urls: string[] = []
    for (const img of imgs) {
      const ext = img.mimeType.split('/')[1] || 'jpg'
      const raw = await fetch('/api/kie/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: img.dataUrl,
          fileName: `ref_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`,
        }),
      })
      const text = await raw.text()
      let res: any
      try { res = JSON.parse(text) } catch {
        throw new Error(`원본 이미지 업로드 실패 (HTTP ${raw.status}): ${text.slice(0, 200)}`)
      }
      if (res.error) throw new Error(`원본 이미지 업로드 실패: ${res.error}`)
      urls.push(res.url)
    }
    return urls
  }

  // ─── VIDEO GENERATION ───
  async function runVideoGenerationNew(
    prompt: string,
    firstFrameUrl: string,
    refUrls: string[],
    t0: number
  ): Promise<string> {
    const model = config.videoModel
    let requestBody: Record<string, unknown>
    let provider: string

    if (model === 'seedance2') {
      provider = 'seedance'
      requestBody = {
        model: 'bytedance/seedance-2',
        input: {
          prompt,
          aspect_ratio: ratio,
          duration: 10,
          resolution: '1080p',
          generate_audio: true,
          ...(firstFrameUrl && { first_frame_url: firstFrameUrl }),
          ...(refUrls.length > 0 && { reference_image_urls: refUrls }),
        },
      }
    } else if (model === 'kling' || model === 'kling-pro') {
      provider = 'kling'
      requestBody = {
        model: 'kling-3.0/video',
        input: {
          prompt,
          aspect_ratio: ratio,
          duration: '10',
          mode: model === 'kling-pro' ? 'pro' : 'std',
          sound: false,
          ...(refUrls.length >= 1 && { image_urls: refUrls.slice(0, 2) }),
        },
      }
    } else {
      provider = 'veo'
      requestBody = {
        prompt,
        model,
        aspect_ratio: ratio,
        resolution: '1080p',
        enableTranslation: false,
        ...(refUrls.length >= 2 && { imageUrls: refUrls.slice(0, 2), generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO' }),
        ...(refUrls.length === 1 && { imageUrls: refUrls, generationType: 'REFERENCE_2_VIDEO' }),
      }
    }

    console.log('[runVideoGenerationNew] model:', model, '| refs:', refUrls.length, '| firstFrame:', !!firstFrameUrl)
    console.log('[runVideoGenerationNew] prompt:', prompt.slice(0, 200))

    const attempt = async () => {
      const taskRes = await fetch('/api/kie/video/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...requestBody }),
      }).then(r => r.json())
      const taskId = taskRes?.data?.taskId
      if (!taskId) throw new Error(`kie.ai 영상: taskId를 받지 못했습니다. 응답: ${JSON.stringify(taskRes)}`)
      return pollVideoTask(taskId, t0, provider)
    }

    try {
      return await attempt()
    } catch (firstErr: any) {
      console.warn('[video] 1차 실패, 10초 후 재시도:', firstErr.message)
      await sleep(10000)
      return attempt()
    }
  }

  async function pollVideoTask(taskId: string, t0: number, provider: string = 'kling', maxWaitMs = 480000) {
    const start = Date.now()
    await sleep(10000)
    while (Date.now() - start < maxWaitMs) {
      await sleep(5000)
      const res: any = await fetch(`/api/kie/video/poll?taskId=${taskId}&provider=${provider}`).then(r => r.json())
      console.log('[pollVideoTask]', JSON.stringify(res))

      if (provider !== 'veo') {
        const d = res?.data
        const state = d?.state
        if (state === 'success') {
          let resultUrls: string[] = []
          try { resultUrls = JSON.parse(d.resultJson || '{}').resultUrls || [] } catch {}
          const url = resultUrls[0]
          if (!url) throw new Error('영상: resultUrls가 비어 있습니다.')
          return url as string
        }
        if (state === 'fail') throw new Error(`영상 생성 실패\n${d?.failMsg || d?.failCode || taskId}`)
        console.log(`[pollVideoTask] state="${state}", 경과=${Math.round((Date.now() - start) / 1000)}s`)
      } else {
        const flag = res?.data?.successFlag
        const response = res?.data?.response
        if (flag === 1 || flag === 0) {
          let urls = response?.resultUrls
          let urlArr = urls
          if (typeof urls === 'string') { try { urlArr = JSON.parse(urls) } catch { urlArr = [urls] } }
          let url = Array.isArray(urlArr) ? urlArr[0] : urlArr
          if (!url) {
            const origins = response?.originUrls
            url = Array.isArray(origins) ? origins[0] : origins
          }
          if (flag === 1 && !url) throw new Error('kie.ai 영상: resultUrls가 비어 있습니다.')
          if (url) return url as string
        }
        if (flag === 2 || flag === 3) {
          const d = res?.data
          throw new Error(`kie.ai 영상 생성 실패\n${d?.failMsg || d?.failCode || response?.errorMessage || JSON.stringify(d)}`)
        }
      }
    }
    throw new Error('영상 작업 시간 초과 (8분)')
  }

  // ─── MAIN GENERATION FLOW ───
  async function startGeneration() {
    if (!studioSheet) { showToast('스튜디오 샷을 먼저 생성해주세요.'); return }
    if (!prompts?.step_storyboard) { showToast('프롬프트 로딩 중입니다.'); return }
    if (!config.geminiKey) { setSettingsOpen(true); return }

    const desc = videoDescription.trim()
    if (!selectedTopic && !desc) { setShowTopicHint(true); return }

    const t0 = Date.now()
    setStartTime(t0)
    setSteps(DEFAULT_STEPS.map(s => ({ ...s })))
    setScreen('processing')

    let currentStep = 'unknown'
    let storyboardImageUrl = ''

    try {
      // ── STEP 1: STORYBOARD ──
      currentStep = 'conti'
      updateStep(0, 'active', '주제와 이미지를 분석하고 있어요.')

      // Resolve topic (auto-generate if not selected)
      let topic = selectedTopic
      if (!topic) {
        currentStep = 'step1b'
        const settingsCtx = buildSettingsContext()
        const subjectCtx = subjectDescription.trim() ? `[피사체 설명]\n${subjectDescription.trim()}` : ''
        const extra = [subjectCtx, desc ? `[영상 방향]\n${desc}` : '', `[영상 비율]\n${ratio}`, settingsCtx].filter(Boolean).join('\n')
        const raw = await callGemini(config.modelLite, prompts.step1b, images, extra)
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(jsonStr)
        topic = parsed.topics?.[0] || null
        if (!topic) throw new Error('주제 생성에 실패했습니다.')
        currentStep = 'conti'
      }

      // Upload background image if provided
      let backgroundImageUrl = ''
      if (backgroundImage) {
        updateStep(0, 'active', '배경 이미지를 업로드하고 있어요.')
        const [bgUrl] = await uploadOriginalImages([backgroundImage])
        backgroundImageUrl = bgUrl
      }

      // Gemini: generate storyboard via 스토리보드.md prompt
      updateStep(0, 'active', '스토리보드를 제작하고 있어요.')
      const settingsCtx = buildSettingsContext()
      const topicCtx = buildTopicContext(topic)
      const storyboardImgs = [...images, ...(backgroundImage ? [backgroundImage] : [])]
      const storyboardExtra = [
        topicCtx,
        settingsCtx,
        `[영상 비율] ${ratio}`,
        desc ? `[영상 방향] ${desc}` : '',
        backgroundImageUrl ? '[배경 이미지] 마지막 이미지가 배경입니다. SECTION 4 환경 설계에 반영해주세요.' : '',
      ].filter(Boolean).join('\n')

      const storyboardRaw = await callGemini(config.modelFlash, prompts.step_storyboard, storyboardImgs, storyboardExtra)
      if (!storyboardRaw) throw new Error('스토리보드 생성에 실패했습니다.')
      setGenContiScript(storyboardRaw)

      // kie.ai: generate storyboard image (16:9, gpt-image model, studioSheet as ref)
      updateStep(0, 'active', '스토리보드 이미지를 생성하고 있어요.')
      const storyboardImgPrompt = parseStoryboardImagePrompt(storyboardRaw)
      storyboardImageUrl = await generateOneImage(
        config.imageModel,
        storyboardImgPrompt,
        [studioSheet].filter(Boolean),
        t0,
        '16:9'
      )
      setGenVideoPrompt('이 스토리보드 가이드를 준수해서 영상을 만들어주세요.')
      updateStep(0, 'done', '스토리보드 생성 완료', `${Math.round((Date.now() - t0) / 1000)}s`)

      // ── STEP 2: VIDEO GENERATION ──
      currentStep = 'video'
      const modelLabel = config.videoModel === 'seedance2' ? 'Seedance 2.0'
        : config.videoModel === 'kling-pro' ? 'Kling 3.0 Pro'
        : config.videoModel === 'kling' ? 'Kling 3.0'
        : 'Veo 3.1 Fast'
      updateStep(1, 'active', `${modelLabel}로 영상을 생성하고 있어요.`)

      // Seedance: refs only — original embedded in storyboard chain, no first_frame constraint
      const refUrls = [storyboardImageUrl, backgroundImageUrl].filter(Boolean)
      const videoPrompt = 'Create a cinematic advertising video following the provided storyboard and reference images exactly.'
      const url = await runVideoGenerationNew(videoPrompt, '', refUrls, t0)

      updateStep(1, 'done', '영상 생성 완료!', `${Math.round((Date.now() - t0) / 1000)}s`)

      setVideoUrl(url)
      setElapsed(Math.round((Date.now() - t0) / 1000))
      setGenReferenceImages([storyboardImageUrl].filter(Boolean))
      setScreen('result')

    } catch (e: any) {
      console.error('[오류 단계:', currentStep, ']', e)
      setScreen('input')
      setError({ step: currentStep, message: e.message || String(e), visible: true })
    }
  }

  function resetToInput() {
    setImages([])
    setTopics([])
    setSelectedTopic(null)
    setTopicsLoading(false)
    setSubjectDescription('')
    setVideoDescription('')
    setVideoUrl('')
    setGenContiScript('')
    setGenVideoPrompt('')
    setGenReferenceImages([])
    setSteps(DEFAULT_STEPS.map(s => ({ ...s })))
    setShowImageHint(false)
    setShowTopicHint(false)
    setInputPhase('initial')
    setStudioSheet('')
    setStudioSheetLoading(false)
    setOriginalImageUrls([])
    setPersonSetting('random')
    setNarrationSetting('random')
    setContentMode('random')
    setMarketMode('domestic')
    setBackgroundImage(null)
    setScreen('input')
  }

  function handleDelete() {
    if (window.confirm('영상을 삭제하시겠습니까?')) resetToInput()
  }

  const generateEnabled = studioSheet !== '' && (videoDescription.trim().length > 0 || selectedTopic !== null)

  return (
    <>
      {screen === 'input' && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 50 }}>
          <button className="btn-settings" onClick={() => setSettingsOpen(true)}>⚙ API 설정</button>
        </div>
      )}

      {screen === 'input' && (
        <InputScreen
          ratio={ratio}
          images={images}
          subjectDescription={subjectDescription}
          videoDescription={videoDescription}
          inputPhase={inputPhase}
          studioSheet={studioSheet}
          studioSheetLoading={studioSheetLoading}
          personSetting={personSetting}
          narrationSetting={narrationSetting}
          topics={topics}
          selectedTopicId={selectedTopic?.id ?? null}
          topicsLoading={topicsLoading}
          onRatioChange={setRatio}
          onImagesAdd={addImages}
          onImageRemove={removeImage}
          onSubjectDescriptionChange={setSubjectDescription}
          onVideoDescriptionChange={setVideoDescription}
          onGenerateStudio={generateStudioSheet}
          onPersonSettingChange={setPersonSetting}
          onNarrationSettingChange={setNarrationSetting}
          contentMode={contentMode}
          onContentModeChange={setContentMode}
          marketMode={marketMode}
          onMarketModeChange={setMarketMode}
          backgroundImage={backgroundImage}
          onBackgroundImageAdd={addBackgroundImage}
          onBackgroundImageRemove={removeBackgroundImage}
          onRecommend={runStep1}
          onTopicSelect={t => { setSelectedTopic(t); setShowTopicHint(false) }}
          onGenerate={startGeneration}
          generateEnabled={generateEnabled}
          showImageHint={showImageHint}
          showTopicHint={showTopicHint}
        />
      )}

      {screen === 'processing' && (
        <ProcessingScreen username={config.username} steps={steps} />
      )}

      {screen === 'result' && (
        <ResultScreen
          username={config.username}
          elapsed={elapsed}
          videoUrl={videoUrl}
          studioSheet={studioSheet}
          referenceImages={genReferenceImages}
          contiScript={genContiScript}
          videoPrompt={genVideoPrompt}
          onNew={resetToInput}
          onDelete={handleDelete}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      <ErrorModal
        open={error.visible}
        step={error.step}
        message={error.message}
        onRetry={() => { setError(e => ({ ...e, visible: false })); resetToInput() }}
        onClose={() => setError(e => ({ ...e, visible: false }))}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </>
  )
}
