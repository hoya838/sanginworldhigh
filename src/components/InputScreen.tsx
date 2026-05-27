'use client'
import { useRef } from 'react'
import type { ImageItem, Topic, PersonSetting, NarrationSetting, InputPhase } from '../types'

interface InputScreenProps {
  ratio: '9:16' | '16:9'
  images: ImageItem[]
  subjectDescription: string
  videoDescription: string
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
  onSubjectDescriptionChange: (v: string) => void
  onVideoDescriptionChange: (v: string) => void
  onGenerateStudio: () => void
  onPersonSettingChange: (s: PersonSetting) => void
  onNarrationSettingChange: (s: NarrationSetting) => void
  backgroundImage: ImageItem | null
  onBackgroundImageAdd: (file: File) => void
  onBackgroundImageRemove: () => void
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
  ratio, images, subjectDescription, videoDescription,
  inputPhase, studioSheet, studioSheetLoading,
  personSetting, narrationSetting,
  topics, selectedTopicId, topicsLoading,
  onRatioChange, onImagesAdd, onImageRemove,
  onSubjectDescriptionChange, onVideoDescriptionChange,
  onGenerateStudio, onPersonSettingChange, onNarrationSettingChange,
  backgroundImage, onBackgroundImageAdd, onBackgroundImageRemove,
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
          <span className="section-title">이미지 업로드</span>
        </div>
        <p className="section-sub">제품·인물·음식 이미지를 올려주세요. 최대 2장까지 업로드 가능합니다.</p>

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

        {/* 02 피사체 설명 */}
        <div className="section-label">
          <span className="section-num">02</span>
          <span className="section-title">피사체 설명</span>
        </div>
        <p className="section-sub">이미지 속 피사체가 무엇인지 간단히 설명해주세요. 스튜디오 샷 품질에 반영됩니다.</p>
        <textarea
          className="desc-textarea"
          placeholder="예: 토마토 발효청, 유리병 패키지, 붉은색 라벨"
          value={subjectDescription}
          onChange={e => onSubjectDescriptionChange(e.target.value)}
        />

        {/* Phase A 버튼 */}
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

        {/* Phase B: Studio sheet onwards */}
        {inputPhase === 'studio' && (
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
            <p className="section-sub">4가지 각도로 촬영한 스튜디오 시트예요. 영상 일관성의 기반이 됩니다.</p>
            {studioSheetLoading ? (
              <div className="topics-loading">
                <div className="spinner" />
                <div>스튜디오 샷을 생성하고 있어요...</div>
              </div>
            ) : studioSheet ? (
              <div className="studio-img-wrap">
                <img src={studioSheet} alt="다각도 스튜디오 시트" />
              </div>
            ) : null}

            <div className="divider" />

            {/* 04 영상 설정 */}
            <div className="section-label">
              <span className="section-num">04</span>
              <span className="section-title">영상 설정</span>
            </div>
            <p className="section-sub">영상 비율과 인물·나레이션 사용 여부를 설정해주세요.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
              <div className="option-group">
                <span className="option-label">비율</span>
                <div className="option-btns">
                  <button
                    className={`option-btn${ratio === '16:9' ? ' active' : ''}`}
                    onClick={() => onRatioChange('16:9')}
                  >가로형</button>
                  <button
                    className={`option-btn${ratio === '9:16' ? ' active' : ''}`}
                    onClick={() => onRatioChange('9:16')}
                  >세로형</button>
                </div>
              </div>
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
              <div className="option-group">
                <span className="option-label">배경</span>
                {backgroundImage ? (
                  <div className="bg-img-preview">
                    <img src={backgroundImage.dataUrl} alt="배경 이미지" />
                    <button className="remove-btn" onClick={onBackgroundImageRemove}>✕</button>
                  </div>
                ) : (
                  <label className="bg-img-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        if (e.target.files?.[0]) { onBackgroundImageAdd(e.target.files[0]); e.target.value = '' }
                      }}
                    />
                    + 이미지 추가
                  </label>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* 05 영상 설명 */}
            <div className="section-label">
              <span className="section-num">05</span>
              <span className="section-title">영상 설명 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--soft)' }}>(선택)</span></span>
            </div>
            <p className="section-sub">어떤 광고 영상을 원하시나요? 타겟·분위기·메시지를 자유롭게 입력해주세요.</p>
            <textarea
              className="desc-textarea"
              placeholder="예: 자연 친화적 분위기, 30대 여성 타겟, 감성적인 광고"
              value={videoDescription}
              onChange={e => onVideoDescriptionChange(e.target.value)}
            />

            <div className="divider" />

            {/* 06 주제 추천 */}
            <div className="recommend-header">
              <div>
                <h3>주제 추천</h3>
                <p>설정을 반영한 광고 주제 3개를 추천해 드려요.</p>
              </div>
              <button
                className="btn-recommend"
                onClick={onRecommend}
                disabled={topicsLoading}
              >
                {topicsLoading ? '분석 중...' : topics.length > 0 ? '다시 추천하기' : '주제 추천'}
              </button>
            </div>

            {(topicsLoading || topics.length > 0) && (
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
              </div>
            )}

            <p className={`hint${showTopicHint ? ' visible' : ''}`} style={{ marginTop: 8 }}>
              ⚠ 영상 설명 또는 추천 주제를 선택해주세요.
            </p>

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
