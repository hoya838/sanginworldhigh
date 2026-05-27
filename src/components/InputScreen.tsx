'use client'
import { useRef } from 'react'
import type { ImageItem, Topic, PersonSetting, NarrationSetting, InputPhase } from '../types'

interface InputScreenProps {
  ratio: '9:16' | '16:9'
  images: ImageItem[]
  description: string
  inputPhase: InputPhase
  studioSheet: string
  studioSheetLoading: boolean
  personSetting: PersonSetting
  narrationSetting: NarrationSetting
  topics: Topic[]
  selectedTopicId: number | null
  topicsLoading: boolean
  onRatioChange: (r: '9:16' | '16:9') => void
  onImagesAdd: (files: File[]) => void
  onImageRemove: (idx: number) => void
  onDescriptionChange: (v: string) => void
  onGenerateStudio: () => void
  onPersonSettingChange: (s: PersonSetting) => void
  onNarrationSettingChange: (s: NarrationSetting) => void
  onRecommend: () => void
  onTopicSelect: (t: Topic) => void
  onGenerate: () => void
  generateEnabled: boolean
  showImageHint: boolean
  showTopicHint: boolean
}

const TYPE_LABELS = ['훅·확산형', '신뢰·전환형', '공감·관계형']

const OPTION_LABELS: Record<string, string> = {
  random: '랜덤',
  use: '사용',
  none: '미사용',
}

export default function InputScreen({
  ratio, images, description, inputPhase, studioSheet, studioSheetLoading,
  personSetting, narrationSetting,
  topics, selectedTopicId, topicsLoading,
  onRatioChange, onImagesAdd, onImageRemove, onDescriptionChange,
  onGenerateStudio, onPersonSettingChange, onNarrationSettingChange,
  onRecommend, onTopicSelect, onGenerate,
  generateEnabled, showImageHint, showTopicHint,
}: InputScreenProps) {
  const mainInputRef = useRef<HTMLInputElement>(null)
  const addMoreRef = useRef<HTMLInputElement>(null)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }
  function handleDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove('drag-over')
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    onImagesAdd(files)
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      onImagesAdd(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const studioEnabled = images.length > 0 && !studioSheetLoading
  const sectionNum = (n: number) => inputPhase === 'initial' ? n : n

  return (
    <div className="screen active" id="screen-input">
      <div className="top-bar" />

      <div className="headline">
        <h1>가장 빠르게<br />영상을 생성해 드릴게요.</h1>
      </div>

      <div className="card">
        {/* 01 이미지업로드 */}
        <div className="section-label">
          <span className="section-num">01</span>
          <span className="section-title">이미지업로드</span>
          <div className="ratio-toggle">
            <button
              className={`ratio-btn${ratio === '9:16' ? ' active' : ''}`}
              onClick={() => onRatioChange('9:16')}
            >세로형</button>
            <button
              className={`ratio-btn${ratio === '16:9' ? ' active' : ''}`}
              onClick={() => onRatioChange('16:9')}
            >가로형</button>
          </div>
        </div>
        <p className="section-sub">제품·인물·음식 이미지를 올려주세요. 이미지는 최대 2장까지 업로드 가능합니다.</p>

        {images.length === 0 ? (
          <div
            className="upload-area"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input ref={mainInputRef} type="file" accept="image/*" multiple onChange={handleFileInput} />
            <div className="upload-placeholder">
              <div className="upload-icon">🖼</div>
              <div className="upload-text">이미지를 드래그하거나 클릭해서 업로드</div>
            </div>
          </div>
        ) : (
          <div className="image-preview-grid">
            {images.map((img, i) => (
              <div className="image-preview-item" key={i}>
                <img src={img.dataUrl} alt={`업로드 이미지 ${i + 1}`} />
                <button className="remove-btn" onClick={() => onImageRemove(i)}>✕</button>
              </div>
            ))}
            {images.length < 2 && (
              <div className="add-more-btn">
                <input ref={addMoreRef} type="file" accept="image/*" onChange={handleFileInput} />
                +
              </div>
            )}
          </div>
        )}
        <p className={`hint${showImageHint ? ' visible' : ''}`}>⚠ 이미지를 최소한 1장 업로드해주세요.</p>

        <div className="divider" />

        {/* 02 영상설명 */}
        <div className="section-label">
          <span className="section-num">02</span>
          <span className="section-title">영상설명</span>
        </div>
        <p className="section-sub">만들고 싶은 영상의 설명을 작성해 주세요. 짧고 간결하게 작성해도 괜찮아요!</p>
        <textarea
          className="desc-textarea"
          placeholder="예: 토마토 발효청 광고, 자연 친화적 분위기, 30대 여성 타겟"
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
        />

        {/* Phase A 완료 버튼 */}
        {inputPhase === 'initial' && (
          <div className="footer-actions" style={{ marginTop: 20 }}>
            <button
              className="btn-generate"
              onClick={onGenerateStudio}
              disabled={!studioEnabled}
            >
              {studioSheetLoading ? '스튜디오 샷 생성 중...' : '다각도 스튜디오 샷 생성하기'}
            </button>
          </div>
        )}

        {/* Phase B, C: Studio Sheet + Options + Recommend + Generate */}
        {(inputPhase === 'studio' || inputPhase === 'topics') && (
          <>
            <div className="divider" />

            {/* 03 다각도 스튜디오 시트 */}
            <div className="section-label">
              <span className="section-num">03</span>
              <span className="section-title">다각도 스튜디오 시트</span>
              <button
                className="btn-studio-regen"
                onClick={onGenerateStudio}
                disabled={studioSheetLoading}
                style={{ marginLeft: 'auto' }}
              >
                {studioSheetLoading ? '생성 중...' : '↺ 다시 생성'}
              </button>
            </div>
            <p className="section-sub">4가지 각도에서 촬영한 스튜디오 시트예요. 영상 일관성의 기반이 됩니다.</p>
            {studioSheet && (
              <div className="studio-img-wrap">
                <img src={studioSheet} alt="다각도 스튜디오 시트" />
              </div>
            )}
            {studioSheetLoading && (
              <div className="topics-loading">
                <div className="spinner" />
                <div>스튜디오 샷을 생성하고 있어요...</div>
              </div>
            )}

            <div className="divider" />

            {/* 04 영상 옵션 */}
            <div className="section-label">
              <span className="section-num">04</span>
              <span className="section-title">영상 옵션</span>
            </div>
            <p className="section-sub">인물과 나레이션 사용 여부를 선택해주세요. 랜덤은 AI가 스토리에 맞게 결정해요.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
              <div className="option-group">
                <span className="option-label">인물</span>
                <div className="option-btns">
                  {(['random', 'use', 'none'] as PersonSetting[]).map(v => (
                    <button
                      key={v}
                      className={`option-btn${personSetting === v ? ' active' : ''}`}
                      onClick={() => onPersonSettingChange(v)}
                    >
                      {OPTION_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="option-group">
                <span className="option-label">나레이션</span>
                <div className="option-btns">
                  {(['random', 'use', 'none'] as NarrationSetting[]).map(v => (
                    <button
                      key={v}
                      className={`option-btn${narrationSetting === v ? ' active' : ''}`}
                      onClick={() => onNarrationSettingChange(v)}
                    >
                      {OPTION_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* 05 주제 추천 */}
            <div className="recommend-header">
              <div>
                <h3>주제 추천</h3>
                <p>인물·나레이션 설정을 반영한 광고 주제 3개를 추천해 드려요.</p>
              </div>
              <button
                className="btn-recommend"
                onClick={onRecommend}
                disabled={topicsLoading}
              >
                {topicsLoading ? '분석 중...' : topics.length > 0 ? '다시 추천하기' : '주제 추천'}
              </button>
            </div>

            {(topicsLoading || inputPhase === 'topics') && (
              <div>
                {topicsLoading ? (
                  <div className="topics-loading">
                    <div className="spinner" />
                    <div>이미지를 분석하는 중...</div>
                  </div>
                ) : (
                  <div className="topics-list">
                    {topics.map((t, i) => (
                      <div
                        key={t.id}
                        className={`topic-card${selectedTopicId === t.id ? ' selected' : ''}`}
                        onClick={() => onTopicSelect(t)}
                      >
                        <span className="topic-card-badge">{t.content_type || TYPE_LABELS[i] || t.platform}</span>
                        <div className="topic-card-title">{t.title}</div>
                        <div className="topic-card-desc">{t.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                <p className={`hint${showTopicHint ? ' visible' : ''}`} style={{ marginTop: 8 }}>
                  ⚠ 영상 설명 또는 추천 주제를 선택해주세요.
                </p>
              </div>
            )}

            <div className="footer-actions">
              <p className="credit-note">영상 생성 <span>10크레딧</span>이 차감됩니다.</p>
              <button className="btn-generate" onClick={onGenerate} disabled={!generateEnabled}>
                영상 생성하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
