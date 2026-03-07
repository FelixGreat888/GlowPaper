import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ASPECT_RATIO_OPTIONS,
  BACKGROUND_OPTIONS,
  CREDIT_COSTS,
  GLOWPAPER_CONFIG,
  QUALITY_OPTIONS,
  STYLE_PARAM_OPTIONS,
} from './config.js';
import {
  createSvgPreviewDataUrl,
  downloadPng,
  downloadSvg,
  editSvg,
  generateSvg,
} from './lib/svgmaker.js';
import {
  getCurrentSession,
  login,
  logout,
  register,
} from './lib/auth.js';
import {
  addHistoryRecord,
  buildHistoryRecord,
  loadHistory,
} from './lib/history.js';
import {
  getOptionPreviewMeta,
  OptionPreviewArtwork,
} from './lib/option-previews.jsx';

const THEME_STORAGE_KEY = 'glowpaper:v2:theme';
const AUTH_FORM_INITIAL_STATE = {
  email: '',
  password: '',
  inviteCode: '',
};

const TAB_OPTIONS = [
  { id: 'generate', label: '生成' },
  { id: 'edit', label: '编辑' },
];

const STYLE_PARAM_FIELDS = [
  { key: 'style', label: '风格' },
  { key: 'color_mode', label: '配色模式' },
  { key: 'image_complexity', label: '画面复杂度' },
  { key: 'text', label: '文字策略' },
  { key: 'composition', label: '构图方式' },
];

const EMPTY_RESULT = {
  svgText: '',
  pngDataUrl: '',
};

const INSUFFICIENT_CREDITS_MESSAGE = '算粒不足，请联系佐糖团队充值';
const TRUST_ITEMS = [
  { value: '单次输出', label: '每次生成 1 张成品，更适合快速确认方向' },
  { value: '50 条历史', label: '最近记录自动缓存，方便回看与复用' },
  { value: '双格式下载', label: '生成后可直接下载 SVG 与 PNG' },
  { value: '透明底预览', label: '黑底 / 白底切换，深色素材也能看清效果' },
];
const SHOWCASE_ITEMS = [
  {
    title: '整组主视觉',
    kicker: '完整构图',
    src: '/showcase/showcase-02.svg',
    accent: 'rgba(255, 174, 94, 0.2)',
  },
  {
    title: '少色线稿套组',
    kicker: '线稿少色',
    src: '/showcase/showcase-03.svg',
    accent: 'rgba(117, 179, 255, 0.2)',
  },
  {
    title: '拟真插画风',
    kicker: '厚涂质感',
    src: '/showcase/showcase-05.svg',
    accent: 'rgba(255, 152, 102, 0.2)',
  },
  {
    title: '城市节庆套组',
    kicker: '伦敦主题',
    src: '/showcase/showcase-06.svg',
    accent: 'rgba(111, 166, 255, 0.22)',
  },
  {
    title: '元素拆分素材',
    kicker: '四宫格',
    src: '/showcase/showcase-01.svg',
    accent: 'rgba(255, 196, 91, 0.18)',
  },
  {
    title: '宠物贴纸风',
    kicker: '扁平可爱',
    src: '/showcase/showcase-04.svg',
    accent: 'rgba(255, 134, 134, 0.16)',
  },
  {
    title: '城市线稿组合',
    kicker: '活动素材',
    src: '/showcase/showcase-07.svg',
    accent: 'rgba(126, 174, 255, 0.18)',
  },
  {
    title: '礼赠氛围元素',
    kicker: '节庆组合',
    src: '/showcase/showcase-08.svg',
    accent: 'rgba(255, 184, 120, 0.16)',
  },
];
const WORKFLOW_STEPS = [
  {
    index: '01',
    title: '输入你想要的画面内容',
    description: '直接用中文描述主题、元素和风格方向，先快速生成一版可编辑结果。',
  },
  {
    index: '02',
    title: '调整参数，快速试不同风格',
    description: '风格、配色、复杂度和构图都能直接切换，悬停还能先看示意效果。',
  },
  {
    index: '03',
    title: '满意就下载，不满意继续编辑',
    description: '生成结果可以直接带入编辑页继续调整，SVG / PNG 都能衔接下一步工作。',
  },
];
const FEATURE_ITEMS = [
  {
    title: '生成和编辑集中在一个页面',
    description: '从第一次出图到继续修改，都不需要来回切换页面。',
  },
  {
    title: '参数说明更容易看懂',
    description: '常用风格参数集中展示，质量、背景和比例也都放在同一处设置。',
  },
  {
    title: '悬停就能看效果示意',
    description: '不用只看名字猜风格，能更快判断是不是你想要的效果。',
  },
  {
    title: '透明底素材也能清楚检查',
    description: '预览画布支持黑底和白底切换，深色元素不会看不清。',
  },
  {
    title: '历史记录自动保存在浏览器',
    description: '最近 50 条生成和编辑结果会自动缓存，方便回看与复用。',
  },
  {
    title: '下载与交付更直接',
    description: 'SVG 适合继续编辑，PNG 适合预览确认，两种格式都能直接拿走。',
  },
];
const SCENARIO_ITEMS = [
  {
    title: '电子烟系列主题',
    description: '节日、城市、口味、联名四类主题，可以快速试多个方向。',
  },
  {
    title: '鼠标垫视觉延展',
    description: '适合做平铺图案、中心主图或一组可拼合的小元素。',
  },
  {
    title: '电商活动素材',
    description: '限时活动、节庆节点、站内 banner 和详情页点缀都能复用。',
  },
  {
    title: '印刷与包装前稿',
    description: '少色、线稿、透明底素材更方便继续进入印刷或包装设计流程。',
  },
];

function buildLabelMap(options) {
  return options.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
  }, {});
}

const QUALITY_LABEL_MAP = buildLabelMap(QUALITY_OPTIONS);
const BACKGROUND_LABEL_MAP = buildLabelMap(BACKGROUND_OPTIONS);
const ASPECT_RATIO_LABEL_MAP = buildLabelMap(ASPECT_RATIO_OPTIONS);
const STYLE_PARAM_LABEL_MAP = {
  style: buildLabelMap(STYLE_PARAM_OPTIONS.style),
  color_mode: buildLabelMap(STYLE_PARAM_OPTIONS.color_mode),
  image_complexity: buildLabelMap(STYLE_PARAM_OPTIONS.image_complexity),
  text: buildLabelMap(STYLE_PARAM_OPTIONS.text),
  composition: buildLabelMap(STYLE_PARAM_OPTIONS.composition),
};

function findLabel(labelMap, value) {
  if (value === null || value === undefined) {
    return '-';
  }

  const normalized = String(value);
  return labelMap[normalized] || normalized || '-';
}

function isAcceptedImage(file) {
  if (!file) {
    return false;
  }

  if (file.type === 'image/png' || file.type === 'image/svg+xml') {
    return true;
  }

  return /\.(png|svg)$/i.test(file.name);
}

function toReadableError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return '请求失败，请稍后重试';
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getPreviewSrcByResult(result) {
  if (result.pngDataUrl) {
    return result.pngDataUrl;
  }

  return createSvgPreviewDataUrl(result.svgText);
}

function getModeLabel(mode) {
  return mode === 'edit' ? '编辑' : '生成';
}

function getCreditCost(mode, quality) {
  const nextMode = mode === 'edit' ? 'edit' : 'generate';
  return CREDIT_COSTS[nextMode]?.[quality] ?? null;
}

function parseCreditsAmount(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).replace(/[^0-9.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInsufficientCreditsError(error) {
  if (!error) {
    return false;
  }

  const code = String(error.code || '').trim().toUpperCase();
  const message = String(error.message || error || '').trim().toLowerCase();

  if (code === 'INSUFFICIENT_CREDITS') {
    return true;
  }

  return (
    message.includes('insufficient credits') ||
    message.includes('not enough credits') ||
    message.includes('余额不足') ||
    message.includes('算粒不足')
  );
}

function isUnauthorizedError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '').trim().toUpperCase();

  return status === 401 || code === 'UNAUTHORIZED' || code === 'INVALID_CREDENTIALS';
}

function isAccountDisabledError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '').trim().toUpperCase();

  return status === 403 && code === 'ACCOUNT_DISABLED';
}

async function buildEditableFileFromResult(result) {
  if (result.svgText) {
    return new File([result.svgText], `glowpaper-edit-source-${Date.now()}.svg`, {
      type: 'image/svg+xml',
    });
  }

  if (result.pngDataUrl) {
    const response = await fetch(result.pngDataUrl);
    const blob = await response.blob();
    return new File([blob], `glowpaper-edit-source-${Date.now()}.png`, {
      type: blob.type || 'image/png',
    });
  }

  return null;
}

function PlaceholderIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="6" y="7" width="36" height="34" rx="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="19" r="3" fill="currentColor" opacity="0.7" />
      <path
        d="M11 33 19 24l6 6 5-4 7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThemeIcon({ theme }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.3 6.3l1.6 1.6M16.1 16.1l1.6 1.6M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15.8 4.2a7.8 7.8 0 1 0 4 13.9 8.4 8.4 0 1 1-4-13.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="m13 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.4-5.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l2.7 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PillSelect({ label, value, options, onChange, compact = false }) {
  return (
    <label className={`pill-field ${compact ? 'compact' : ''}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewPillSelect({ label, fieldKey, value, options, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState(value);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const activeValue = hoveredValue || value;
  const activeMeta = getOptionPreviewMeta(fieldKey, activeValue);
  const selectedLabel = findLabel(buildLabelMap(options), value);

  useEffect(() => {
    if (!open) {
      setHoveredValue(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      const clickedInsideTrigger = rootRef.current?.contains(event.target);
      const clickedInsideMenu = menuRef.current?.contains(event.target);

      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setOpen(false);
        setHoveredValue(value);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        setHoveredValue(value);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, value]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return undefined;
    }

    function updateMenuPosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportPadding = 12;
      const panelGap = 6;
      const requestedWidth = 560;
      const availableWidth = Math.max(320, window.innerWidth - viewportPadding * 2);
      const width = Math.min(requestedWidth, availableWidth);
      const preferredHeight = Math.min(360, window.innerHeight - viewportPadding * 2);
      const minimumComfortHeight = 280;
      const belowSpace = window.innerHeight - triggerRect.bottom - viewportPadding;
      const aboveSpace = triggerRect.top - viewportPadding;
      const openAbove = belowSpace < minimumComfortHeight && aboveSpace >= minimumComfortHeight;
      const height = Math.min(preferredHeight, openAbove ? aboveSpace : belowSpace);

      const rawLeft =
        align === 'right' ? triggerRect.right - width : triggerRect.left;
      const left = Math.min(
        Math.max(viewportPadding, rawLeft),
        window.innerWidth - width - viewportPadding,
      );

      const top = openAbove
        ? triggerRect.top - height - panelGap
        : triggerRect.bottom + panelGap;

      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 4000,
      });
    }

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [align, open, options.length]);

  return (
    <div ref={rootRef} className={`pill-field preview-select ${open ? 'open' : ''}`}>
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="preview-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selectedLabel}</span>
        <ChevronIcon />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              className={`preview-select-menu align-${align}`}
              style={menuStyle}
              onMouseLeave={() => setHoveredValue(value)}
            >
              <div className="preview-select-options" role="listbox" aria-label={label}>
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    className={`preview-select-option ${
                      activeValue === option.value ? 'previewing' : ''
                    } ${value === option.value ? 'selected' : ''}`}
                    onMouseEnter={() => setHoveredValue(option.value)}
                    onFocus={() => setHoveredValue(option.value)}
                    onClick={() => {
                      onChange(option.value);
                      setHoveredValue(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="preview-select-aside">
                <div className="preview-select-art">
                  <OptionPreviewArtwork fieldKey={fieldKey} value={activeValue} />
                </div>
                <div className="preview-select-copy">
                  <strong>{activeMeta.title}</strong>
                  <p>{activeMeta.description}</p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function UploadDropzone({ file, previewUrl, onPickFile, onClearFile }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFileList(fileList) {
    const nextFile = fileList?.[0];
    if (nextFile) {
      onPickFile(nextFile);
    }
  }

  return (
    <div
      className={`upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        handleFileList(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".svg,.png,image/svg+xml,image/png"
        hidden
        onChange={(event) => handleFileList(event.target.files)}
      />

      {file ? (
        <div className="upload-picked">
          {previewUrl ? <img src={previewUrl} alt={file.name} /> : null}
          <div className="upload-meta">
            <p>{file.name}</p>
            <small>{(file.size / 1024).toFixed(1)} KB</small>
          </div>
          <button
            type="button"
            className="ghost-action"
            onClick={(event) => {
              event.stopPropagation();
              onClearFile();
            }}
          >
            移除
          </button>
        </div>
      ) : (
        <div className="upload-empty">
          <PlaceholderIcon />
          <p>拖拽 SVG / PNG 到这里，或点击上传</p>
          <small>支持 .svg 和 .png</small>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ record, onDownloadSvg, onDownloadPng, onViewParams }) {
  const previewSrc = getPreviewSrcByResult(record.result);

  return (
    <article className="history-card">
      <div className="history-thumb">
        <button
          type="button"
          className="history-thumb-button"
          onClick={() => {
            if (previewSrc) {
              onViewParams(record, 'preview');
            }
          }}
          disabled={!previewSrc}
          aria-label="放大查看历史图片"
        >
          {previewSrc ? <img src={previewSrc} alt="历史结果" /> : <PlaceholderIcon />}
        </button>
      </div>
      <div className="history-meta">
        <p>{record.prompt}</p>
        <small>
          {formatDateTime(record.createdAt)} · {getModeLabel(record.mode)}
        </small>
      </div>
      <div className="history-actions">
        <button type="button" onClick={() => onDownloadSvg(record)} disabled={!record.result.svgText}>
          下载SVG
        </button>
        <button type="button" onClick={() => onDownloadPng(record)} disabled={!record.result.pngDataUrl}>
          下载PNG
        </button>
        <button type="button" onClick={() => onViewParams(record)}>
          查看参数
        </button>
      </div>
    </article>
  );
}

function HistoryPreviewModal({ record, onClose }) {
  if (!record) {
    return null;
  }

  const previewSrc = getPreviewSrcByResult(record.result);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="history-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="历史图片预览"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>历史记录预览</small>
            <h3>
              {getModeLabel(record.mode)} · {formatDateTime(record.createdAt)}
            </h3>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="history-preview-canvas">
          {previewSrc ? <img src={previewSrc} alt="历史记录预览" /> : <PlaceholderIcon />}
        </div>
      </div>
    </div>
  );
}

function ParamsModal({
  record,
  copied,
  onClose,
  onCopyPrompt,
}) {
  if (!record) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="params-modal"
        role="dialog"
        aria-modal="true"
        aria-label="历史参数"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h3>参数详情</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="params-grid">
          <div>
            <span>记录时间</span>
            <p>{formatDateTime(record.createdAt)}</p>
          </div>
          <div>
            <span>操作类型</span>
            <p>{getModeLabel(record.mode)}</p>
          </div>
          <div>
            <span>质量</span>
            <p>{findLabel(QUALITY_LABEL_MAP, record.params.quality)}</p>
          </div>
          <div>
            <span>背景</span>
            <p>{findLabel(BACKGROUND_LABEL_MAP, record.params.background)}</p>
          </div>
          <div>
            <span>比例</span>
            <p>{findLabel(ASPECT_RATIO_LABEL_MAP, record.params.aspectRatio)}</p>
          </div>
          <div>
            <span>源文件</span>
            <p>{record.sourceFileName || '无'}</p>
          </div>
          <div>
            <span>风格</span>
            <p>{findLabel(STYLE_PARAM_LABEL_MAP.style, record.params.styleParams.style)}</p>
          </div>
          <div>
            <span>配色模式</span>
            <p>{findLabel(STYLE_PARAM_LABEL_MAP.color_mode, record.params.styleParams.color_mode)}</p>
          </div>
          <div>
            <span>画面复杂度</span>
            <p>
              {findLabel(
                STYLE_PARAM_LABEL_MAP.image_complexity,
                record.params.styleParams.image_complexity,
              )}
            </p>
          </div>
          <div>
            <span>文字策略</span>
            <p>{findLabel(STYLE_PARAM_LABEL_MAP.text, record.params.styleParams.text)}</p>
          </div>
          <div>
            <span>构图方式</span>
            <p>
              {findLabel(
                STYLE_PARAM_LABEL_MAP.composition,
                record.params.styleParams.composition,
              )}
            </p>
          </div>
        </div>

        <section className="prompt-detail">
          <div className="prompt-title-row">
            <span>提示词</span>
            <button type="button" onClick={() => onCopyPrompt(record.prompt, record.id)}>
              {copied ? '已复制' : '复制提示词'}
            </button>
          </div>
          <pre>{record.prompt}</pre>
        </section>
      </div>
    </div>
  );
}

function LandingSectionHeader({ eyebrow, title, description }) {
  return (
    <div className="landing-section-header">
      <span className="section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function AuthWorkbenchGate({
  mode,
  form,
  error,
  configured,
  submitting,
  onModeChange,
  onFieldChange,
  onSubmit,
}) {
  return (
    <div className="auth-gate">
      <div className="auth-gate-copy">
        <span className="section-eyebrow">登录后使用</span>
        <h2>登录后即可开始生成和编辑 SVG</h2>
        <p>
          首次注册需要邀请码。注册成功后会自动获赠 10 算粒，后续生成和编辑都会从当前账号余额里扣减。
        </p>
      </div>

      <div className="auth-gate-card">
        <div className="auth-mode-switch" role="tablist" aria-label="登录注册切换">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => onModeChange('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => onModeChange('register')}
          >
            注册
          </button>
        </div>

        <div className="auth-form-grid">
          <label>
            <span>邮箱</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => onFieldChange('email', event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label>
            <span>密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => onFieldChange('password', event.target.value)}
              placeholder="至少 6 位"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {mode === 'register' ? (
            <label className="auth-form-wide">
              <span>邀请码</span>
              <input
                type="text"
                value={form.inviteCode}
                onChange={(event) => onFieldChange('inviteCode', event.target.value)}
                placeholder="请输入邀请码"
                autoComplete="off"
              />
            </label>
          ) : null}
        </div>

        {!configured ? (
          <div className="auth-inline-hint">服务端尚未完成配置，暂时不能登录或注册。</div>
        ) : null}
        {error ? <div className="auth-inline-error">{error}</div> : null}

        <button
          type="button"
          className="auth-submit-button"
          onClick={onSubmit}
          disabled={submitting || !configured}
        >
          {submitting ? '提交中...' : mode === 'login' ? '登录并进入工作台' : '注册并开始使用'}
        </button>
      </div>
    </div>
  );
}

function ShowcaseCard({ item }) {
  return (
    <article
      className={`showcase-card size-${item.size || 'square'}`}
      style={{ '--showcase-accent': item.accent || 'rgba(184, 61, 255, 0.18)' }}
    >
      <div className="showcase-art">
        <img src={item.src} alt={item.title} loading="lazy" />
      </div>
      <div className="showcase-copy">
        <span>{item.kicker}</span>
        <h3>{item.title}</h3>
      </div>
    </article>
  );
}

function WorkflowVisual() {
  return (
    <div className="workflow-visual">
      <div className="workflow-visual-header">
        <span>流光工作台</span>
        <div className="workflow-visual-pills">
          <i />
          <i />
          <i />
        </div>
      </div>

      <div className="workflow-visual-body">
        <div className="workflow-visual-main">
          <div className="workflow-visual-stage">
            <OptionPreviewArtwork fieldKey="composition" value="objects_in_grid" />
          </div>
        </div>

        <div className="workflow-visual-side">
          <div className="workflow-side-card">
            <strong>生成参数</strong>
            <ul>
              <li>线稿</li>
              <li>少色</li>
              <li>插画级</li>
              <li>网格排布</li>
            </ul>
          </div>
          <div className="workflow-side-card">
            <strong>交付结果</strong>
            <p>SVG 源文件 + PNG 预览图</p>
          </div>
          <div className="workflow-side-card chips">
            <span>生成</span>
            <span>编辑</span>
            <span>历史</span>
            <span>透明底检查</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(GLOWPAPER_CONFIG.defaults.tab);
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [credits, setCredits] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(AUTH_FORM_INITIAL_STATE);
  const [authError, setAuthError] = useState('');
  const [authStatus, setAuthStatus] = useState('loading');
  const [authConfigured, setAuthConfigured] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [generatePrompt, setGeneratePrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  const [quality, setQuality] = useState(GLOWPAPER_CONFIG.defaults.quality);
  const [background, setBackground] = useState(GLOWPAPER_CONFIG.defaults.background);
  const [aspectRatio, setAspectRatio] = useState(GLOWPAPER_CONFIG.defaults.aspectRatio);
  const [styleParams, setStyleParams] = useState({
    ...GLOWPAPER_CONFIG.defaults.styleParams,
  });

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState('');

  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('准备就绪，可以开始生成或编辑。');
  const [result, setResult] = useState(EMPTY_RESULT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewBackdrop, setPreviewBackdrop] = useState('dark');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState(() => loadHistory());
  const [activeHistoryRecord, setActiveHistoryRecord] = useState(null);
  const [activeHistoryPreview, setActiveHistoryPreview] = useState(null);
  const [copiedPromptRecordId, setCopiedPromptRecordId] = useState('');

  const retryActionRef = useRef(null);
  const lastStudioTabRef = useRef(GLOWPAPER_CONFIG.defaults.tab);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Ignore storage errors.
    }
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      try {
        const payload = await getCurrentSession();
        if (cancelled) {
          return;
        }

        const authenticated = Boolean(payload?.authenticated && payload?.user);
        setAuthConfigured(payload?.configured !== false);
        setAuthStatus(authenticated ? 'authenticated' : 'guest');
        setCurrentUser(authenticated ? payload.user : null);
        setCredits(
          payload?.creditBalance !== null && payload?.creditBalance !== undefined
            ? String(payload.creditBalance)
            : null,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAuthConfigured(true);
        setAuthStatus('guest');
        setCurrentUser(null);
        setCredits(null);

        if (isAccountDisabledError(error)) {
          setAuthError('账号已被停用，请联系管理员。');
        }
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uploadedFile) {
      setUploadedPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(uploadedFile);
    setUploadedPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [uploadedFile]);

  const previewSrc = useMemo(() => {
    return getPreviewSrcByResult(result);
  }, [result]);

  const hasSuccessResult = status === 'success' && Boolean(previewSrc);
  const hasRetry = status === 'error' && typeof retryActionRef.current === 'function';
  const generateCreditCost = getCreditCost('generate', quality);
  const editCreditCost = getCreditCost('edit', quality);
  const isAuthenticated = authStatus === 'authenticated' && Boolean(currentUser);

  function updateStyleParam(key, value) {
    setStyleParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateCredits(value) {
    if (value !== null && value !== undefined && value !== '') {
      setCredits(String(value));
      return;
    }

    setCredits(null);
  }

  function resetPreviewState() {
    setStatus('idle');
    setStatusMessage('准备就绪，可以开始生成或编辑。');
    setResult(EMPTY_RESULT);
    retryActionRef.current = null;
  }

  function updateAuthField(key, value) {
    setAuthForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetAuthForm(nextMode) {
    setAuthMode(nextMode);
    setAuthError('');
    setAuthForm(AUTH_FORM_INITIAL_STATE);
  }

  async function handleAuthSubmit() {
    if (authSubmitting) {
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');

    try {
      const payload =
        authMode === 'login'
          ? await login({
              email: authForm.email,
              password: authForm.password,
            })
          : await register({
              email: authForm.email,
              password: authForm.password,
              inviteCode: authForm.inviteCode,
            });

      setCurrentUser(payload.user || null);
      setAuthStatus(payload?.authenticated ? 'authenticated' : 'guest');
      updateCredits(payload?.creditBalance ?? null);
      setAuthForm(AUTH_FORM_INITIAL_STATE);
      setHistoryOpen(false);
      resetPreviewState();
    } catch (error) {
      setAuthError(toReadableError(error));

      if (isAccountDisabledError(error)) {
        setAuthStatus('guest');
        setCurrentUser(null);
        updateCredits(null);
      }
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Ignore logout failures and clear local auth state anyway.
    }

    setAuthStatus('guest');
    setCurrentUser(null);
    updateCredits(null);
    setAuthError('');
    setHistoryOpen(false);
    resetPreviewState();
  }

  function hasEnoughCredits(mode) {
    const currentCredits = parseCreditsAmount(credits);
    const requiredCredits = getCreditCost(mode, quality);

    if (currentCredits === null || requiredCredits === null) {
      return true;
    }

    return currentCredits >= requiredCredits;
  }

  function setInsufficientCreditsState() {
    retryActionRef.current = null;
    setStatus('error');
    setStatusMessage(INSUFFICIENT_CREDITS_MESSAGE);
  }

  function handleRequestError(error) {
    if (error?.creditBalance !== undefined) {
      updateCredits(error.creditBalance);
    }

    if (error?.creditsRemaining !== undefined) {
      updateCredits(error.creditsRemaining);
    }

    if (isInsufficientCreditsError(error)) {
      setInsufficientCreditsState();
      return;
    }

    if (isUnauthorizedError(error) || isAccountDisabledError(error)) {
      setAuthStatus('guest');
      setCurrentUser(null);
      updateCredits(null);
      if (isAccountDisabledError(error)) {
        setAuthError('账号已被停用，请联系管理员。');
      }
    }

    setStatus('error');
    setStatusMessage(toReadableError(error));
  }

  async function syncEditUploadFromResult() {
    if (status !== 'success' || (!result.svgText && !result.pngDataUrl)) {
      return;
    }

    try {
      const nextFile = await buildEditableFileFromResult(result);
      if (nextFile) {
        setUploadedFile(nextFile);
      }
    } catch {
      // Ignore auto-fill failures and allow manual upload fallback.
    }
  }

  function appendHistory({ mode, prompt, sourceFileName, nextResult }) {
    const record = buildHistoryRecord({
      mode,
      prompt,
      sourceFileName,
      params: {
        quality,
        background,
        aspectRatio,
        styleParams: {
          ...styleParams,
        },
      },
      result: nextResult,
    });

    setHistoryItems((prev) => addHistoryRecord(prev, record));
  }

  async function runGenerate(payload) {
    setIsSubmitting(true);
    setStatus('loading');
    setStatusMessage('已收到请求，正在生成 SVG...');
    setResult(EMPTY_RESULT);

    try {
      const { result: nextResult, credits: nextCredits } = await generateSvg(payload);
      setResult(nextResult);
      setStatus('success');
      setStatusMessage('生成完成。');
      updateCredits(nextCredits);
      appendHistory({ mode: 'generate', prompt: payload.prompt, nextResult });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runEdit(payload) {
    setIsSubmitting(true);
    setStatus('loading');
    setStatusMessage('已收到请求，正在执行编辑...');
    setResult(EMPTY_RESULT);

    try {
      const { result: nextResult, credits: nextCredits } = await editSvg(payload);
      setResult(nextResult);
      setStatus('success');
      setStatusMessage('编辑完成。');
      updateCredits(nextCredits);
      appendHistory({
        mode: 'edit',
        prompt: payload.prompt,
        sourceFileName: payload.image?.name || '',
        nextResult,
      });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerate() {
    if (isSubmitting) {
      return;
    }

    const prompt = generatePrompt.trim();
    if (!prompt) {
      setStatus('error');
      setStatusMessage('请先输入生成描述。');
      retryActionRef.current = null;
      return;
    }

    if (!hasEnoughCredits('generate')) {
      setInsufficientCreditsState();
      return;
    }

    const payload = {
      prompt,
      quality,
      aspectRatio,
      background,
      svgText: true,
      base64Png: true,
      storage: false,
      styleParams,
    };

    retryActionRef.current = () => runGenerate(payload);
    await runGenerate(payload);
  }

  async function handleEdit() {
    if (isSubmitting) {
      return;
    }

    if (!uploadedFile) {
      setStatus('error');
      setStatusMessage('请先上传需要编辑的 SVG 或 PNG。');
      retryActionRef.current = null;
      return;
    }

    const prompt = editPrompt.trim();
    if (!prompt) {
      setStatus('error');
      setStatusMessage('请描述你想要的修改方向。');
      retryActionRef.current = null;
      return;
    }

    if (!hasEnoughCredits('edit')) {
      setInsufficientCreditsState();
      return;
    }

    const payload = {
      image: uploadedFile,
      prompt,
      quality,
      aspectRatio,
      background,
      styleParams,
    };

    retryActionRef.current = () => runEdit(payload);
    await runEdit(payload);
  }

  async function handleRetry() {
    if (isSubmitting || !retryActionRef.current) {
      return;
    }

    await retryActionRef.current();
  }

  function showErrorMessage(error) {
    setStatus('error');
    setStatusMessage(toReadableError(error));
  }

  async function handleDownloadSvgCurrent() {
    try {
      downloadSvg(result.svgText);
    } catch (error) {
      showErrorMessage(error);
    }
  }

  async function handleDownloadPngCurrent() {
    try {
      await downloadPng(result.pngDataUrl);
    } catch (error) {
      showErrorMessage(error);
    }
  }

  async function handleHistoryDownloadSvg(record) {
    try {
      downloadSvg(record.result.svgText);
    } catch (error) {
      showErrorMessage(error);
    }
  }

  async function handleHistoryDownloadPng(record) {
    try {
      await downloadPng(record.result.pngDataUrl);
    } catch (error) {
      showErrorMessage(error);
    }
  }

  async function handleCopyPrompt(prompt, recordId) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPromptRecordId(recordId);
      window.setTimeout(() => {
        setCopiedPromptRecordId((prev) => (prev === recordId ? '' : prev));
      }, 1500);
    } catch {
      setStatus('error');
      setStatusMessage('复制失败，请手动复制。');
    }
  }

  function handleStudioTabChange(nextTab) {
    lastStudioTabRef.current = nextTab;
    setActiveTab(nextTab);
    if (historyOpen) {
      setHistoryOpen(false);
    }

    if (nextTab === 'edit' && activeTab !== 'edit') {
      void syncEditUploadFromResult();
    }
  }

  function handleToggleHistory() {
    setHistoryOpen((prev) => {
      if (!prev) {
        if (activeTab === 'generate' || activeTab === 'edit') {
          lastStudioTabRef.current = activeTab;
        }
        setActiveTab('');
        return true;
      }

      setActiveTab(lastStudioTabRef.current || GLOWPAPER_CONFIG.defaults.tab);
      return false;
    });
  }

  return (
    <div className={`glowpaper-root theme-${themeMode}`}>
      <div className="background-glow" aria-hidden="true">
        <span className="starfield starfield-drift" />
        <span className="starfield starfield-bursts" />
      </div>
      <div className="noise-overlay" aria-hidden="true" />

      <header className="app-header">
        <div className="brand-area">
          <span className="brand-logo" aria-hidden="true">
            <img src="/logo.png" alt="" />
          </span>
          <span className="brand-name">{GLOWPAPER_CONFIG.brandName}</span>
        </div>

        <div className="header-right">
          {isAuthenticated ? (
            <>
              <span className="credits-chip">剩余算粒：{credits ?? '--'}</span>
              <span className="user-chip" title={currentUser.email}>
                {currentUser.email}
              </span>
              {currentUser.role === 'admin' ? (
                <a className="admin-link-chip" href={GLOWPAPER_CONFIG.adminPath}>
                  后台管理
                </a>
              ) : null}
              <button type="button" className="ghost-header-button" onClick={handleLogout}>
                退出登录
              </button>
            </>
          ) : authStatus === 'loading' ? (
            <span className="credits-chip">正在检查登录状态...</span>
          ) : (
            <button
              type="button"
              className="ghost-header-button"
              onClick={() => {
                document
                  .getElementById('studio-workbench')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              登录 / 注册
            </button>
          )}
          <button
            type="button"
            className="theme-button"
            onClick={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            title={themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            <ThemeIcon theme={themeMode} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="hero">
          <h1>一键生成精美 SVG</h1>
          <p>
            用自然语言快速产出可编辑的矢量图，支持上传二次编辑，结果可直接下载 SVG 与 PNG。
          </p>
        </section>

        <section id="studio-workbench" className="studio-card">
          {isAuthenticated ? (
            <>
              <div className="top-toolbar">
                <div className="tab-row" role="tablist" aria-label="模式切换">
                  {TAB_OPTIONS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => handleStudioTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={`history-toggle ${historyOpen ? 'active' : ''}`}
                  onClick={handleToggleHistory}
                  title="历史记录"
                >
                  <HistoryIcon />
                  历史记录（{historyItems.length}）
                </button>
              </div>

              {historyOpen ? (
                <div className="history-panel history-panel-only">
                  {historyItems.length ? (
                    <div className="history-grid">
                      {historyItems.map((record) => (
                        <HistoryCard
                          key={record.id}
                          record={record}
                          onDownloadSvg={handleHistoryDownloadSvg}
                          onDownloadPng={handleHistoryDownloadPng}
                          onViewParams={(nextRecord, mode = 'params') => {
                            if (mode === 'preview') {
                              setActiveHistoryPreview(nextRecord);
                              return;
                            }

                            setActiveHistoryRecord(nextRecord);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="history-empty">
                      <p>还没有历史记录。</p>
                      <small>生成或编辑完成后，会按时间自动缓存到浏览器（最多 50 条）。</small>
                    </div>
                  )}
                </div>
              ) : null}

              {!historyOpen && (activeTab === 'generate' || activeTab === 'edit') ? (
                <div className="workspace-grid">
                  <section className="left-pane">
                    {activeTab === 'generate' ? (
                      <div className="control-block">
                        <label className="field-title" htmlFor="generate-prompt">
                          创作描述
                        </label>
                        <div className="prompt-shell">
                          <textarea
                            id="generate-prompt"
                            value={generatePrompt}
                            onChange={(event) => setGeneratePrompt(event.target.value)}
                            placeholder={GLOWPAPER_CONFIG.generatePlaceholder}
                            rows={6}
                          />
                          <div className="prompt-controls">
                            <span className="credit-hint">消耗{generateCreditCost ?? '--'}算粒</span>
                            <button
                              type="button"
                              className="send-button"
                              disabled={isSubmitting}
                              onClick={handleGenerate}
                              title="生成"
                            >
                              {isSubmitting ? '...' : <SendIcon />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="control-block">
                        <label className="field-title">上传素材</label>
                        <UploadDropzone
                          file={uploadedFile}
                          previewUrl={uploadedPreviewUrl}
                          onPickFile={(file) => {
                            if (!isAcceptedImage(file)) {
                              setStatus('error');
                              setStatusMessage('仅支持 SVG 和 PNG 文件。');
                              return;
                            }
                            setUploadedFile(file);
                          }}
                          onClearFile={() => setUploadedFile(null)}
                        />

                        <label className="field-title" htmlFor="edit-prompt">
                          修改说明
                        </label>
                        <div className="prompt-shell">
                          <textarea
                            id="edit-prompt"
                            value={editPrompt}
                            onChange={(event) => setEditPrompt(event.target.value)}
                            placeholder="描述你想怎么改，比如改配色、加元素、调整风格。"
                            rows={4}
                          />
                          <div className="prompt-controls">
                            <span className="credit-hint">消耗{editCreditCost ?? '--'}算粒</span>
                            <button
                              type="button"
                              className="send-button edit"
                              disabled={isSubmitting}
                              onClick={handleEdit}
                              title="编辑"
                            >
                              {isSubmitting ? '...' : <SendIcon />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="control-block">
                      <h3 className="field-title">生成参数</h3>
                      <div className="pill-grid">
                        {STYLE_PARAM_FIELDS.map((field, index) => (
                          <PreviewPillSelect
                            key={field.key}
                            fieldKey={field.key}
                            label={field.label}
                            value={styleParams[field.key]}
                            options={STYLE_PARAM_OPTIONS[field.key]}
                            align={index % 2 === 0 ? 'left' : 'right'}
                            onChange={(value) => updateStyleParam(field.key, value)}
                          />
                        ))}
                        <PillSelect
                          label="质量"
                          value={quality}
                          options={QUALITY_OPTIONS}
                          onChange={setQuality}
                        />
                        <PillSelect
                          label="背景"
                          value={background}
                          options={BACKGROUND_OPTIONS}
                          onChange={setBackground}
                        />
                        <PillSelect
                          label="比例"
                          value={aspectRatio}
                          options={ASPECT_RATIO_OPTIONS}
                          onChange={setAspectRatio}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="right-pane">
                    <div className="control-block preview-card">
                      <div className="preview-head">
                        <span>预览画布</span>
                        {(status === 'success' || status === 'error' || status === 'loading') && (
                          <button type="button" className="clear-button" onClick={resetPreviewState} title="清空结果">
                            ×
                          </button>
                        )}
                      </div>

                      <div
                        className={`preview-canvas state-${status} ${
                          hasSuccessResult ? `preview-bg-${previewBackdrop}` : ''
                        }`}
                      >
                        {status === 'idle' ? (
                          <div className="status-view">
                            <PlaceholderIcon />
                            <p>还没有结果</p>
                            <small>提交请求后，结果会显示在这里。</small>
                          </div>
                        ) : null}

                        {status === 'loading' ? (
                          <div className="status-view">
                            <div className="spinner" />
                            <p>{statusMessage || '已收到请求，正在处理中...'}</p>
                          </div>
                        ) : null}

                        {status === 'error' ? (
                          <div className="status-view error">
                            <p>{statusMessage}</p>
                            {hasRetry ? (
                              <button
                                type="button"
                                className="retry-button"
                                onClick={handleRetry}
                                disabled={isSubmitting}
                              >
                                重试
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {status === 'success' ? (
                          <div className="result-view">
                            {previewSrc ? <img src={previewSrc} alt="生成结果" /> : null}
                          </div>
                        ) : null}

                        {hasSuccessResult ? (
                          <div className="preview-bg-toggle" role="group" aria-label="预览背景切换">
                            <button
                              type="button"
                              className={`preview-bg-button ${previewBackdrop === 'dark' ? 'active' : ''}`}
                              onClick={() => setPreviewBackdrop('dark')}
                              title="切换到深色背景"
                              aria-label="深色背景"
                            >
                              <span className="preview-bg-dot dark" />
                            </button>
                            <button
                              type="button"
                              className={`preview-bg-button ${previewBackdrop === 'light' ? 'active' : ''}`}
                              onClick={() => setPreviewBackdrop('light')}
                              title="切换到白色背景"
                              aria-label="白色背景"
                            >
                              <span className="preview-bg-dot light" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="download-row">
                      <button
                        type="button"
                        className="download-button"
                        onClick={handleDownloadSvgCurrent}
                        disabled={!hasSuccessResult || !result.svgText}
                      >
                        下载 SVG
                      </button>
                      <button
                        type="button"
                        className="download-button"
                        onClick={handleDownloadPngCurrent}
                        disabled={!hasSuccessResult || !result.pngDataUrl}
                      >
                        下载 PNG
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          ) : authStatus === 'loading' ? (
            <div className="auth-loading-state">正在准备登录环境...</div>
          ) : (
            <AuthWorkbenchGate
              mode={authMode}
              form={authForm}
              error={authError}
              configured={authConfigured}
              submitting={authSubmitting}
              onModeChange={resetAuthForm}
              onFieldChange={updateAuthField}
              onSubmit={handleAuthSubmit}
            />
          )}
        </section>

        <section className="proof-band">
          {TRUST_ITEMS.map((item) => (
            <article key={item.label} className="proof-item">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </section>

        <section id="landing-showcase" className="landing-section">
          <LandingSectionHeader
            eyebrow="案例墙"
            title="看看真实生成效果，大致就能知道适不适合你的场景"
            description="这里展示的是实际生成结果示例，适合用来判断风格方向、元素组合和画面完成度。"
          />
          <div className="showcase-grid">
            {SHOWCASE_ITEMS.map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="landing-section workflow-section">
          <LandingSectionHeader
            eyebrow="工作流"
            title="从一句描述到成品素材，常用步骤都能顺着做完"
            description="输入需求、调整参数、预览确认、继续编辑和下载交付，都可以在同一个页面里完成。"
          />

          <div className="workflow-layout">
            <div className="workflow-steps">
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.index} className="workflow-step-card">
                  <span>{step.index}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>

            <WorkflowVisual />
          </div>
        </section>

        <section className="landing-section">
          <LandingSectionHeader
            eyebrow="核心能力"
            title="覆盖从出图到交付的关键步骤"
            description="把常用动作集中在一个页面里，减少切换页面和来回确认的时间。"
          />
          <div className="feature-grid">
            {FEATURE_ITEMS.map((item) => (
              <article key={item.title} className="feature-card">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <LandingSectionHeader
            eyebrow="适用场景"
            title="适合这些常见素材需求"
            description="无论是贴纸元素、活动主题图还是包装点缀，都可以先快速出一版再继续细化。"
          />
          <div className="scenario-grid">
            {SCENARIO_ITEMS.map((item) => (
              <article key={item.title} className="scenario-card">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          <div className="site-footer-brand">
            <strong>{GLOWPAPER_CONFIG.brandName}</strong>
            <span>SVG 素材创作工具，支持生成、编辑、历史缓存与透明底预览。</span>
          </div>
        </footer>
      </main>

      <HistoryPreviewModal
        record={activeHistoryPreview}
        onClose={() => setActiveHistoryPreview(null)}
      />
      <ParamsModal
        record={activeHistoryRecord}
        copied={copiedPromptRecordId === activeHistoryRecord?.id}
        onClose={() => {
          setActiveHistoryRecord(null);
          setCopiedPromptRecordId('');
        }}
        onCopyPrompt={handleCopyPrompt}
      />
    </div>
  );
}

export default App;
