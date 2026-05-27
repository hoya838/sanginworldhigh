'use client'
import { useState } from 'react'
import PromptsDrawer from './PromptsDrawer'

interface ResultScreenProps {
  username: string
  elapsed: number
  videoUrl: string
  studioSheet: string
  referenceImages: string[]
  contiScript: string
  videoPrompt: string
  onNew: () => void
  onDelete: () => void
}

export default function ResultScreen({
  username, elapsed, videoUrl, studioSheet, referenceImages,
  contiScript, videoPrompt,
  onNew, onDelete,
}: ResultScreenProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  function makeDownloadUrl(url: string, filename: string) {
    return `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  }

  const contiBoardUrl = referenceImages[0] || ''

  return (
    <div className="screen active" id="screen-result">
      <div className="result-card">
        <h2><span className="username">{username}</span>님의 영상을<br />완성했어요.</h2>
        <p className="result-elapsed">소요시간 · {elapsed}초</p>

        <div className="video-wrapper">
          <video src={videoUrl} controls playsInline />
        </div>

        <div className="result-actions">
          <a
            className="btn-download"
            href={makeDownloadUrl(videoUrl, '영상.mp4')}
            download="영상.mp4"
          >
            ↓ 영상 다운로드
          </a>

          {/* Studio Sheet */}
          {studioSheet && (
            <div className="ref-images-section">
              <p className="ref-images-label">다각도 스튜디오 시트</p>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                <img src={studioSheet} alt="스튜디오 시트" style={{ width: '100%', display: 'block' }} />
                <a
                  className="ref-image-download"
                  href={makeDownloadUrl(studioSheet, '스튜디오_시트.jpg')}
                  download="스튜디오_시트.jpg"
                >
                  ↓
                </a>
              </div>
            </div>
          )}

          {/* Conti Board */}
          {contiBoardUrl && (
            <div className="ref-images-section">
              <p className="ref-images-label">스토리보드 이미지</p>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                <img src={contiBoardUrl} alt="스토리보드" style={{ width: '100%', display: 'block' }} />
                <a
                  className="ref-image-download"
                  href={makeDownloadUrl(contiBoardUrl, '스토리보드.jpg')}
                  download="스토리보드.jpg"
                >
                  ↓
                </a>
              </div>
            </div>
          )}

          <button className="btn-prompt-view" onClick={() => setDrawerOpen(true)}>
            생성 프롬프트 보기
          </button>

          <div className="result-secondary">
            <button className="btn-secondary btn-new" onClick={onNew}>↺ 새로 만들기</button>
            <button className="btn-secondary btn-delete" onClick={onDelete}>🗑 삭제</button>
          </div>
        </div>
      </div>

      <PromptsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        contiScript={contiScript}
        videoPrompt={videoPrompt}
      />
    </div>
  )
}
