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
  INSPIRATION_LIBRARY,
  PROMPT_MAX_LENGTH,
} from './lib/inspiration-library.js';
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
const SHOWCASE_ITEMS = [
  {
    title: '整组主视觉',
    kicker: '完整构图',
    src: '/showcase/showcase-02.svg',
    prompt: '月亮、猫和狗、花朵，少色线稿，夜晚氛围，适合整组主视觉',
    accent: 'rgba(255, 174, 94, 0.2)',
  },
  {
    title: '少色线稿套组',
    kicker: '线稿少色',
    src: '/showcase/showcase-03.svg',
    prompt: '植物花卉组合，蓝黄少色，干净线条，适合整套贴纸与点缀素材',
    accent: 'rgba(117, 179, 255, 0.2)',
  },
  {
    title: '拟真插画风',
    kicker: '厚涂质感',
    src: '/showcase/showcase-05.svg',
    prompt: '复古绘本感动物插画，色彩柔和，保留细节层次，适合主画面呈现',
    accent: 'rgba(255, 152, 102, 0.2)',
  },
  {
    title: '城市节庆套组',
    kicker: '伦敦主题',
    src: '/showcase/showcase-06.svg',
    prompt: '伦敦眼、烟花、塔桥、月亮，夜晚节庆风格，网格排布的城市主题素材',
    accent: 'rgba(111, 166, 255, 0.22)',
  },
  {
    title: '元素拆分素材',
    kicker: '四宫格',
    src: '/showcase/showcase-01.svg',
    prompt: '把主题拆成可组合元素，适合主图、角标、贴纸和延展物料重复使用',
    accent: 'rgba(255, 196, 91, 0.18)',
  },
  {
    title: '宠物贴纸风',
    kicker: '扁平可爱',
    src: '/showcase/showcase-04.svg',
    prompt: '可爱宠物形象，轮廓清晰、构图完整，适合做贴纸和衍生小物',
    accent: 'rgba(255, 134, 134, 0.16)',
  },
  {
    title: '城市线稿组合',
    kicker: '活动素材',
    src: '/showcase/showcase-07.svg',
    prompt: '城市主题线稿素材，可用于节点活动、包装点缀和整组视觉延展',
    accent: 'rgba(126, 174, 255, 0.18)',
  },
  {
    title: '礼赠氛围元素',
    kicker: '节庆组合',
    src: '/showcase/showcase-08.svg',
    prompt: '节庆礼赠元素组合，适合详情页点缀、鼠标垫排版与包装辅助图形',
    accent: 'rgba(255, 184, 120, 0.16)',
  },
];
const WORKBENCH_BADGES = [
  { label: '一句话生成图像', icon: '✨', className: 'fb-1' },
  { label: '悬停预览风格示意', icon: '👁️', className: 'fb-2' },
  { label: '专业参数即时切换', icon: '🎛️', className: 'fb-3' },
  { label: 'SVG / PNG 双格式导出', icon: '⬇️', className: 'fb-4' },
];
const HISTORY_PREVIEW_ITEMS = [
  { src: '/showcase/showcase-02.svg', tone: 'light' },
  { src: '/showcase/showcase-06.svg', tone: 'dark' },
  { src: '/showcase/showcase-07.svg', tone: 'light' },
  { src: '/showcase/showcase-03.svg', tone: 'dark' },
  { src: '/showcase/showcase-08.svg', tone: 'light' },
  { src: '/showcase/showcase-01.svg', tone: 'dark' },
];
const CAPABILITY_ITEMS = [
  {
    title: '生成和编辑集于一面',
    accent: '#c084fc',
    visual: 'workspace',
    image: '/showcase/showcase-06.svg',
    paragraphs: [
      '从第一次出图到继续修改，都留在同一个工作区里完成，不需要反复切页找入口。',
      '常用参数集中展示，风格方向、构图方式和质量设置都能顺手完成，节奏更连贯。',
    ],
  },
  {
    title: '透明底素材也能清楚检查',
    accent: '#60a5fa',
    visual: 'preview',
    image: '/showcase/showcase-03.svg',
    paragraphs: [
      '预览画布支持黑底和白底切换，深色元素放在透明底上也能看清轮廓和层次。',
      '参数支持悬停查看示意效果，不再只能靠选项名字猜风格，更容易快速筛掉不合适的方向。',
    ],
  },
  {
    title: '历史记录自动保存与一键交付',
    accent: '#f472b6',
    visual: 'history',
    image: '/showcase/showcase-02.svg',
    secondaryImage: '/showcase/showcase-07.svg',
    paragraphs: [
      '最近 50 条生成和编辑记录会自动保存在浏览器里，随时回看之前的灵感和方案。',
      'SVG 适合继续源文件编辑，PNG 适合直接确认和交付，两种格式都能一键下载带走。',
    ],
  },
];
const USECASE_ITEMS = [
  {
    icon: '👕',
    title: 'POD 衍生品定制',
    description: 'T 恤、帆布袋、马克杯等周边图案可以直接生成 SVG，放大缩小都不损失清晰度。',
  },
  {
    icon: '📦',
    title: '包装与印刷物料',
    description: '线稿、少色和透明底素材更适合继续进入 Illustrator 等设计软件做印刷排版。',
  },
  {
    icon: '🎯',
    title: '品牌图形与标识探索',
    description: '一句话快速尝试多个方向，适合前期寻找 Logo 辅助图形和品牌插图的感觉。',
  },
  {
    icon: '📊',
    title: '汇报与信息展示',
    description: '适合给 PPT、商业提案和内部方案配图，用更统一的矢量视觉提升整体完成度。',
  },
  {
    icon: '📱',
    title: 'UI / Web 图标素材',
    description: '可以快速产出成套元素和图标方向，帮助前端页面、活动页和产品视觉更快落地。',
  },
  {
    icon: '🛒',
    title: '电商活动与营销视觉',
    description: '节点活动、详情页点缀、站内 banner 和专题页主视觉，都能先快速生成一版试方向。',
  },
];

const LOADING_STEPS = {
  auth: [
    {
      progress: 24,
      title: '同步账号状态',
      detail: '正在确认当前登录与算粒信息。',
      hint: '登录成功后会自动回到当前工作台。',
    },
  ],
  generate: [
    {
      progress: 8,
      title: '整理提示词',
      detail: '正在解析你的主题、构图和风格参数...',
      hint: '提示：关键词之间用逗号分隔，模型更容易拆解主体和元素关系。',
    },
    {
      progress: 34,
      title: '生成矢量草图',
      detail: '正在构建基础矢量骨架...',
      hint: '技巧：如果要成套贴纸或图标，构图方式建议选择“网格排布”。',
    },
    {
      progress: 62,
      title: '补齐图形细节',
      detail: '正在细化层次、装饰和画面完整度...',
      hint: '提示：少色和线稿通常更适合继续进入包装、印刷和矢量二改场景。',
    },
    {
      progress: 84,
      title: '整理交付格式',
      detail: '几乎完成了，正在输出 SVG...',
      hint: '技巧：生成结果会同时准备 SVG 和 PNG 预览，方便直接检查和下载。',
    },
  ],
  edit: [
    {
      progress: 8,
      title: '分析原图结构',
      detail: '正在识别上传素材的轮廓、层次与可编辑部分...',
      hint: '提示：轮廓更清晰的 SVG 或 PNG，编辑结果通常更稳定。',
    },
    {
      progress: 36,
      title: '套用修改方向',
      detail: '正在根据你的编辑描述重组图形与风格...',
      hint: '技巧：先说明“保留主体”，再写修改方向，局部编辑会更准确。',
    },
    {
      progress: 64,
      title: '细化局部变化',
      detail: '正在补齐局部变化和细节衔接...',
      hint: '提示：少色、线稿和透明底更适合继续进印刷与包装场景。',
    },
    {
      progress: 84,
      title: '输出新版本',
      detail: '几乎完成了，正在输出编辑结果...',
      hint: '技巧：结果支持 SVG 和 PNG 双下载，方便直接确认和交付。',
    },
  ],
};

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getActiveLoadingStep(mode, progress) {
  const steps = LOADING_STEPS[mode] || LOADING_STEPS.generate;
  let activeStep = steps[0];

  for (const step of steps) {
    if (progress >= step.progress) {
      activeStep = step;
    }
  }

  return activeStep;
}

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

function CreditCoinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="rgba(251, 191, 36, 0.14)" />
      <path d="M12 7v10M10 10h4M10 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SubmitCapsule({ cost, tooltip, disabled, onClick, actionLabel }) {
  const safeCost = cost ?? '--';

  return (
    <button
      type="button"
      className="submit-capsule"
      disabled={disabled}
      onClick={onClick}
      title={actionLabel}
      aria-label={`${actionLabel}，消耗 ${safeCost} 算粒`}
    >
      <div className="cost-display">
        <CreditCoinIcon />
        <span>{safeCost}</span>
      </div>
      <div className="submit-circle">{disabled ? <div className="submit-spinner" /> : <SendIcon />}</div>
      <div className="cost-tooltip">{tooltip}</div>
    </button>
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
      <div className="pill-select-shell">
        <select className="pill-select-input" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
    </label>
  );
}

function PreviewPillSelect({ label, fieldKey, value, options, onChange, align = 'left', themeMode = 'dark' }) {
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState(value);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const optionValues = options.map((option) => option.value);
  const menuThemeStyle =
    themeMode === 'light'
      ? {
          '--menu-bg': 'rgba(255, 255, 255, 0.99)',
          '--menu-border': 'rgba(232, 226, 240, 0.95)',
          '--menu-divider': 'rgba(26, 21, 37, 0.06)',
          '--menu-accent-soft': 'rgba(155, 77, 255, 0.1)',
          '--menu-text-primary': '#1a1525',
          '--menu-text-secondary': '#4a3f5e',
          '--menu-text-muted': '#8b79a3',
          '--menu-aside-bg':
            'radial-gradient(circle at top right, rgba(155, 77, 255, 0.08), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(248, 244, 252, 0.98))',
          '--menu-canvas-bg': 'rgba(247, 245, 250, 0.98)',
          '--menu-shadow':
            '0 18px 40px rgba(30, 20, 50, 0.12), 0 4px 14px rgba(30, 20, 50, 0.05)',
        }
      : {
          '--menu-bg': 'rgba(8, 6, 16, 0.98)',
          '--menu-border': 'rgba(174, 120, 244, 0.3)',
          '--menu-divider': 'rgba(255, 255, 255, 0.04)',
          '--menu-accent-soft': 'rgba(196, 87, 255, 0.2)',
          '--menu-text-primary': '#f5ebff',
          '--menu-text-secondary': '#b7a6cf',
          '--menu-text-muted': '#8c7ca7',
          '--menu-aside-bg':
            'radial-gradient(circle at 20% 18%, rgba(177, 89, 255, 0.14), transparent 34%), rgba(11, 8, 20, 0.98)',
          '--menu-canvas-bg': 'rgba(10, 8, 20, 0.9)',
          '--menu-shadow':
            '0 18px 50px rgba(5, 3, 10, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
        };

  const activeValue = hoveredValue || value;
  const activeMeta = getOptionPreviewMeta(fieldKey, activeValue);
  const selectedLabel = findLabel(buildLabelMap(options), value);

  function focusOption(nextValue) {
    if (!menuRef.current) {
      return;
    }

    const nextOption = Array.from(
      menuRef.current.querySelectorAll('[data-option-value]'),
    ).find((element) => element.getAttribute('data-option-value') === String(nextValue));

    if (nextOption instanceof HTMLButtonElement) {
      nextOption.focus();
    }
  }

  function getOptionIndex(targetValue) {
    const index = optionValues.indexOf(targetValue);
    return index === -1 ? 0 : index;
  }

  function previewOptionByIndex(targetIndex, shouldFocus = false) {
    const nextIndex = clampValue(targetIndex, 0, optionValues.length - 1);
    const nextValue = optionValues[nextIndex];
    setHoveredValue(nextValue);

    if (shouldFocus) {
      window.requestAnimationFrame(() => {
        focusOption(nextValue);
      });
    }

    return nextValue;
  }

  function nudgePreview(direction, shouldFocus = false) {
    const baseValue = open ? activeValue : value;
    return previewOptionByIndex(getOptionIndex(baseValue) + direction, shouldFocus);
  }

  function commitValue(nextValue) {
    onChange(nextValue);
    setHoveredValue(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      }
      nudgePreview(1, true);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      }
      nudgePreview(-1, true);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setOpen(true);
      previewOptionByIndex(0, true);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      previewOptionByIndex(optionValues.length - 1, true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHoveredValue(value);
        window.requestAnimationFrame(() => {
          focusOption(value);
        });
        return;
      }

      commitValue(activeValue);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setHoveredValue(value);
    }
  }

  function handleOptionKeyDown(event, optionValue) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudgePreview(1, true);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudgePreview(-1, true);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      previewOptionByIndex(0, true);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      previewOptionByIndex(optionValues.length - 1, true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitValue(optionValue);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setHoveredValue(value);
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }

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

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
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
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedLabel}</span>
        <ChevronIcon />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              className={`preview-select-menu align-${align} menu-theme-${themeMode}`}
              style={{ ...menuStyle, ...menuThemeStyle }}
              onMouseLeave={() => setHoveredValue(value)}
            >
              <div className="preview-select-options" role="listbox" aria-label={label}>
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    data-option-value={option.value}
                    className={`preview-select-option ${
                      activeValue === option.value ? 'previewing' : ''
                    } ${value === option.value ? 'selected' : ''}`}
                    onMouseEnter={() => setHoveredValue(option.value)}
                    onFocus={() => setHoveredValue(option.value)}
                    onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
                    onClick={() => commitValue(option.value)}
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

function LandingSectionHeader({ icon, eyebrow, title, description }) {
  return (
    <div className="landing-section-header">
      <span className="section-eyebrow">
        {icon ? <i>{icon}</i> : null}
        {eyebrow}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function AuthDialog({
  open,
  mode,
  form,
  error,
  submitting,
  onClose,
  onModeChange,
  onFieldChange,
  onSubmit,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="access-modal auth-dialog-modal"
        role="dialog"
        aria-modal="true"
        aria-label="登录或注册"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h3>{mode === 'login' ? '登录' : '注册'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </header>

        <div className="access-modal-body auth-dialog-body">
          {mode === 'register' ? <p>注册需要邀请码，新用户注册自动获赠10算粒</p> : null}

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

          {error ? <div className="auth-inline-error">{error}</div> : null}
        </div>

        <div className="access-modal-actions">
          <button type="button" className="access-secondary-button" onClick={onClose}>
            稍后再说
          </button>
          <button
            type="button"
            className="access-primary-button"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? '提交中...' : mode === 'login' ? '登录并继续' : '注册并继续'}
          </button>
        </div>
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
        <div className="showcase-overlay">
          <span className="showcase-tag"># {item.title}</span>
          <p>{item.prompt}</p>
        </div>
      </div>
      <div className="showcase-copy">
        <span>{item.kicker}</span>
        <h3>{item.title}</h3>
      </div>
    </article>
  );
}

function FerrisWheelSketch() {
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <g stroke="#0B4DA5" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="100" cy="76" r="46" />
        <circle cx="100" cy="76" r="8" fill="#F8F8FF" />
        <path d="M100 30v92M54 76h92M67 43l66 66M67 109l66-66" opacity="0.9" />
        <path d="M70 124 100 84l30 40M84 124h32M42 132h116" />
        <path d="M54 145c14-4 29-4 43 0M107 145c14-4 28-4 41 0" stroke="#1786FF" />
      </g>
      {[38, 58, 82, 118, 142, 162].map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy={index < 3 ? 48 + index * 16 : 48 + (index - 3) * 16}
          r="6"
          fill="#CFE6FF"
        />
      ))}
      <circle cx="100" cy="76" r="10" fill="#FF9E58" stroke="#0B4DA5" strokeWidth="4" />
    </svg>
  );
}

function FireworksSketch() {
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <g strokeLinecap="round">
        <g stroke="#FF7A3D" strokeWidth="5">
          <path d="M98 54 98 16M98 54 77 27M98 54 58 40M98 54 66 68M98 54 79 93M98 54 98 98M98 54 120 88M98 54 136 72M98 54 144 48M98 54 126 22" />
        </g>
        <g stroke="#FFD84E" strokeWidth="4.5">
          <path d="M152 78 152 49M152 78 131 58M152 78 122 82M152 78 131 101M152 78 152 109M152 78 174 98M152 78 182 78M152 78 173 58" />
        </g>
        <g stroke="#64B8FF" strokeWidth="4">
          <path d="M56 98 56 74M56 98 40 82M56 98 34 101M56 98 40 116M56 98 56 123M56 98 73 115M56 98 78 98M56 98 72 82" />
        </g>
      </g>
      <circle cx="98" cy="54" r="6" fill="#FFF3E8" />
      <circle cx="152" cy="78" r="5.5" fill="#FFF7D4" />
      <circle cx="56" cy="98" r="4.5" fill="#E6F4FF" />
    </svg>
  );
}

function BridgeSketch() {
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <g stroke="#0C4C9F" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 124V62h28v62M132 124V62h28v62" />
        <path d="M40 124h120M56 62l7-14h14l5 14M146 62l7-14h14l5 14" stroke="#FF9E58" />
        <path d="M54 124V88h22v36M124 124V88h22v36" />
        <path d="M72 124V83h56v41" />
        <path d="M72 92c10-18 24-30 28-30 4 0 19 12 28 30" />
        <path d="M32 142c18-5 36-5 54 0M93 142c15-5 31-5 48 0M148 142c8-3 16-3 24 0" stroke="#1786FF" />
      </g>
      <rect x="81" y="89" width="38" height="26" rx="4" fill="#F4F2F8" stroke="#0C4C9F" strokeWidth="4" />
    </svg>
  );
}

function MoonSketch() {
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <path
        d="M104 30c17 8 28 24 29 44-11 8-24 12-39 12-16 0-29-6-40-18 2-18 12-32 29-40 8-4 14-5 21-5Z"
        fill="#F8D94A"
        stroke="#0D295F"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M110 26c5 10 8 19 8 29 0 27-19 45-50 46" fill="#F8D94A" />
      <path d="M114 28c5 9 7 18 7 28 0 24-17 40-44 43" stroke="#0D295F" strokeWidth="5" strokeLinecap="round" />
      <g stroke="#0D4B9C" strokeLinecap="round" strokeLinejoin="round">
        <g transform="translate(147 60)">
          <path d="M0-18V18M-18 0H18M-10-10 10 10M10-10-10 10" strokeWidth="5" />
          <circle cx="0" cy="0" r="6.5" fill="#FFD253" strokeWidth="4.2" />
        </g>
        <g transform="translate(132 101)">
          <path d="M0-10V10M-10 0H10M-6-6 6 6M6-6-6 6" strokeWidth="4" />
          <circle cx="0" cy="0" r="3.8" fill="#FFE58A" strokeWidth="3.2" />
        </g>
        <g transform="translate(58 95)">
          <path d="M0-13V13M-13 0H13M-7-7 7 7M7-7-7 7" strokeWidth="4.6" />
          <circle cx="0" cy="0" r="4.8" fill="#FFD253" strokeWidth="3.6" />
        </g>
        <g transform="translate(76 58)">
          <path d="M0-7V7M-7 0H7" strokeWidth="3.6" />
          <circle cx="0" cy="0" r="2.8" fill="#FFE58A" strokeWidth="2.8" />
        </g>
      </g>
    </svg>
  );
}

function WorkbenchIllustration() {
  return (
    <div className="showcase-artboard">
      <div className="showcase-artboard-grid">
        <div className="showcase-material-tile tone-deep">
          <FerrisWheelSketch />
        </div>
        <div className="showcase-material-tile tone-slate">
          <FireworksSketch />
        </div>
        <div className="showcase-material-tile tone-deep">
          <BridgeSketch />
        </div>
        <div className="showcase-material-tile tone-slate">
          <MoonSketch />
        </div>
      </div>
    </div>
  );
}

function WorkbenchShowcase() {
  return (
    <div className="showcase-wrapper">
      <div className="showcase-inner">
        <div className="mac-bar">
          <div className="mac-dot r" />
          <div className="mac-dot y" />
          <div className="mac-dot g" />
          <span>流光工作台</span>
        </div>
        <div className="showcase-body">
          <div className="showcase-screen-card">
            <div className="showcase-screen-copy">
              <small>实时预览 / 参数联动</small>
              <strong>生成、编辑、预览和下载都在一个页面里完成</strong>
            </div>
            <div className="showcase-screen-art">
              <WorkbenchIllustration />
            </div>
          </div>
          {WORKBENCH_BADGES.map((badge) => (
            <div key={badge.label} className={`floating-badge ${badge.className}`}>
              <span>{badge.icon}</span>
              {badge.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapabilityVisual({ item }) {
  if (item.visual === 'preview') {
    return (
      <div className="zigzag-image visual-preview">
        <div className="visual-preview-split">
          <div className="visual-preview-half dark">
            <img src={item.image} alt={item.title} />
          </div>
          <div className="visual-preview-half light">
            <img src={item.image} alt={item.title} />
          </div>
        </div>
        <div className="visual-preview-switch">
          <i className="dark" />
          <i className="light" />
        </div>
      </div>
    );
  }

  if (item.visual === 'history') {
    return (
      <div className="zigzag-image visual-history">
        <div className="visual-history-grid">
          {HISTORY_PREVIEW_ITEMS.map((preview, index) => (
            <article
              key={`${preview.src}-${index}`}
              className={`visual-history-tile ${preview.tone === 'light' ? 'tone-light' : 'tone-dark'}`}
            >
              <img src={preview.src} alt={`${item.title} 示例 ${index + 1}`} />
            </article>
          ))}
        </div>
        <div className="visual-history-chips">
          <span>下载 SVG</span>
          <span>下载 PNG</span>
        </div>
      </div>
    );
  }

  return (
    <div className="zigzag-image visual-workspace">
      <div className="visual-workspace-shell">
        <div className="visual-workspace-head">
          <span>同页完成</span>
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="visual-workspace-body">
          <div className="visual-workspace-copy">
            <span>生成</span>
            <span>编辑</span>
            <span>交付</span>
          </div>
          <div className="visual-workspace-art">
            <img src={item.image} alt={item.title} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityRow({ item, reverse = false }) {
  return (
    <div className={`zigzag-row ${reverse ? 'reverse' : ''}`}>
      <div className="zigzag-text">
        <h3 style={{ color: item.accent }}>{item.title}</h3>
        {item.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <CapabilityVisual item={item} />
    </div>
  );
}

function UsecaseCard({ item }) {
  return (
    <article className="usecase-card">
      <div className="icon-box">{item.icon}</div>
      <h3 className="uc-title">{item.title}</h3>
      <p className="uc-desc">{item.description}</p>
    </article>
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
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const [generatePrompt, setGeneratePrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [inspirationOpen, setInspirationOpen] = useState(false);

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
  const [loadingMode, setLoadingMode] = useState('generate');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [previewBackdrop, setPreviewBackdrop] = useState('dark');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState(() => loadHistory());
  const [activeHistoryRecord, setActiveHistoryRecord] = useState(null);
  const [activeHistoryPreview, setActiveHistoryPreview] = useState(null);
  const [copiedPromptRecordId, setCopiedPromptRecordId] = useState('');

  const retryActionRef = useRef(null);
  const lastStudioTabRef = useRef(GLOWPAPER_CONFIG.defaults.tab);
  const pendingProtectedActionRef = useRef('');
  const requestVersionRef = useRef(0);
  const generatePromptRef = useRef(null);
  const inspirationMenuRef = useRef(null);
  const inspirationTriggerRef = useRef(null);
  const promptTypewriterRef = useRef(0);

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

  const hasPreviewAsset = Boolean(previewSrc);
  const hasSuccessResult = status === 'success' && Boolean(previewSrc);
  const hasRetry = status === 'error' && typeof retryActionRef.current === 'function';
  const generateCreditCost = getCreditCost('generate', quality);
  const editCreditCost = getCreditCost('edit', quality);
  const generatePromptCount = generatePrompt.length;
  const editPromptCount = editPrompt.length;
  const isAuthenticated = authStatus === 'authenticated' && Boolean(currentUser);
  const hasProgressOverlay =
    status === 'loading' && (loadingMode === 'generate' || loadingMode === 'edit');
  const activeLoadingStep = getActiveLoadingStep(loadingMode, loadingProgress);
  const loadingStatusText = activeLoadingStep?.detail || statusMessage;
  const loadingTipText = activeLoadingStep?.hint || '';

  useEffect(() => {
    if (status !== 'loading' || (loadingMode !== 'generate' && loadingMode !== 'edit')) {
      setLoadingProgress(0);
      return undefined;
    }

    setLoadingProgress(6);

    const intervalId = window.setInterval(() => {
      setLoadingProgress((current) => {
        const start = current < 6 ? 6 : current;
        const remaining = 96 - start;
        const increment = Math.max(1.2, remaining * (Math.random() * 0.12 + 0.05));
        return Number(Math.min(96, start + increment).toFixed(1));
      });
    }, 520);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadingMode, status]);

  useEffect(() => {
    return () => {
      if (promptTypewriterRef.current) {
        window.clearTimeout(promptTypewriterRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'generate') {
      return undefined;
    }

    stopPromptTypewriter();
    setInspirationOpen(false);
    return undefined;
  }, [activeTab]);

  useEffect(() => {
    if (!inspirationOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      const clickedMenu = inspirationMenuRef.current?.contains(event.target);
      const clickedTrigger = inspirationTriggerRef.current?.contains(event.target);

      if (!clickedMenu && !clickedTrigger) {
        setInspirationOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setInspirationOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [inspirationOpen]);

  function updateStyleParam(key, value) {
    setStyleParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function stopPromptTypewriter() {
    if (!promptTypewriterRef.current) {
      return;
    }

    window.clearTimeout(promptTypewriterRef.current);
    promptTypewriterRef.current = 0;
  }

  function handleGeneratePromptChange(event) {
    stopPromptTypewriter();
    setGeneratePrompt(event.target.value.slice(0, PROMPT_MAX_LENGTH));
  }

  function handleEditPromptChange(event) {
    setEditPrompt(event.target.value.slice(0, PROMPT_MAX_LENGTH));
  }

  function handleSelectInspiration(promptText) {
    const nextPrompt = String(promptText || '').slice(0, PROMPT_MAX_LENGTH);
    stopPromptTypewriter();
    setInspirationOpen(false);
    setGeneratePrompt('');

    if (!nextPrompt) {
      return;
    }

    let index = 0;
    const step = () => {
      index += 1;
      const partial = nextPrompt.slice(0, index);
      setGeneratePrompt(partial);
      window.requestAnimationFrame(() => {
        if (generatePromptRef.current) {
          generatePromptRef.current.scrollTop = generatePromptRef.current.scrollHeight;
        }
      });

      if (index < nextPrompt.length) {
        promptTypewriterRef.current = window.setTimeout(step, 16);
        return;
      }

      promptTypewriterRef.current = 0;
    };

    step();
  }

  function updateCredits(value) {
    if (value !== null && value !== undefined && value !== '') {
      setCredits(String(value));
      return;
    }

    setCredits(null);
  }

  function invalidatePendingRequests() {
    requestVersionRef.current += 1;
    setIsSubmitting(false);
  }

  function resetPreviewState() {
    invalidatePendingRequests();
    setStatus('idle');
    setStatusMessage('准备就绪，可以开始生成或编辑。');
    setResult(EMPTY_RESULT);
    setLoadingMode(activeTab === 'edit' ? 'edit' : 'generate');
    setLoadingProgress(0);
    retryActionRef.current = null;
  }

  function beginLoading(nextMode, message) {
    const requestId = requestVersionRef.current + 1;
    requestVersionRef.current = requestId;
    setLoadingMode(nextMode);
    setLoadingProgress(6);
    setStatus('loading');
    setStatusMessage(message);
    return requestId;
  }

  function updateAuthField(key, value) {
    setAuthForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function setNextAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthError('');
  }

  function openAuthDialog(nextMode = 'login', pendingAction = null) {
    if (pendingAction) {
      pendingProtectedActionRef.current = pendingAction;
    }
    setNextAuthMode(nextMode);
    setAuthDialogOpen(true);
  }

  function closeAuthDialog() {
    if (authSubmitting) {
      return;
    }

    pendingProtectedActionRef.current = '';
    setAuthError('');
    setAuthDialogOpen(false);
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
      setAuthError('');
      setAuthDialogOpen(false);
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
    pendingProtectedActionRef.current = '';
    setAuthStatus('guest');
    setCurrentUser(null);
    updateCredits(null);
    setAuthMode('login');
    setAuthForm(AUTH_FORM_INITIAL_STATE);
    setAuthError('');
    setAuthConfigured(true);
    setAuthSubmitting(false);
    setAuthDialogOpen(false);
    setHistoryOpen(false);
    setActiveHistoryRecord(null);
    setActiveHistoryPreview(null);
    setCopiedPromptRecordId('');
    resetPreviewState();

    try {
      await logout();
    } catch {
      // Ignore logout failures after local state is cleared.
    }
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
      } else {
        setAuthError('请先登录后再继续。');
        setAuthDialogOpen(true);
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
    const requestId = beginLoading('generate', '已收到请求，正在生成 SVG...');

    try {
      const { result: nextResult, credits: nextCredits } = await generateSvg(payload);
      if (requestId !== requestVersionRef.current) {
        return;
      }
      setLoadingProgress(100);
      setResult(nextResult);
      setStatus('success');
      setStatusMessage('生成完成。');
      updateCredits(nextCredits);
      appendHistory({ mode: 'generate', prompt: payload.prompt, nextResult });
    } catch (error) {
      if (requestId !== requestVersionRef.current) {
        return;
      }
      handleRequestError(error);
    } finally {
      if (requestId === requestVersionRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  async function runEdit(payload) {
    setIsSubmitting(true);
    const requestId = beginLoading('edit', '已收到请求，正在执行编辑...');

    try {
      const { result: nextResult, credits: nextCredits } = await editSvg(payload);
      if (requestId !== requestVersionRef.current) {
        return;
      }
      setLoadingProgress(100);
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
      if (requestId !== requestVersionRef.current) {
        return;
      }
      handleRequestError(error);
    } finally {
      if (requestId === requestVersionRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  async function handleGenerate() {
    if (isSubmitting) {
      return;
    }

    setInspirationOpen(false);

    if (authStatus === 'loading') {
      setLoadingMode('auth');
      setStatus('loading');
      setStatusMessage('正在检查登录状态，请稍后...');
      setLoadingProgress(0);
      retryActionRef.current = null;
      return;
    }

    if (!isAuthenticated) {
      openAuthDialog('login', 'generate');
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

    if (authStatus === 'loading') {
      setLoadingMode('auth');
      setStatus('loading');
      setStatusMessage('正在检查登录状态，请稍后...');
      setLoadingProgress(0);
      retryActionRef.current = null;
      return;
    }

    if (!isAuthenticated) {
      openAuthDialog('login', 'edit');
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

  useEffect(() => {
    if (authDialogOpen || authStatus !== 'authenticated' || !currentUser || !pendingProtectedActionRef.current) {
      return undefined;
    }

    const nextAction = pendingProtectedActionRef.current;
    pendingProtectedActionRef.current = '';

    const timeoutId = window.setTimeout(() => {
      if (nextAction === 'generate') {
        void handleGenerate();
        return;
      }

      if (nextAction === 'edit') {
        void handleEdit();
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authDialogOpen, authStatus, currentUser, handleEdit, handleGenerate]);

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
              onClick={() => openAuthDialog('login')}
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
                      <div className="prompt-shell prompt-shell-generate">
                        <textarea
                          ref={generatePromptRef}
                          id="generate-prompt"
                          value={generatePrompt}
                          onChange={handleGeneratePromptChange}
                          placeholder={GLOWPAPER_CONFIG.generatePlaceholder}
                          rows={6}
                          maxLength={PROMPT_MAX_LENGTH}
                        />
                        <div className="prompt-controls">
                          <div className="controls-left">
                            <button
                              ref={inspirationTriggerRef}
                              type="button"
                              className="inspire-btn"
                              onClick={() => setInspirationOpen((prev) => !prev)}
                              aria-haspopup="dialog"
                              aria-expanded={inspirationOpen}
                            >
                              <span aria-hidden="true">💡</span>
                              灵感库
                            </button>

                            <div
                              ref={inspirationMenuRef}
                              className={`inspiration-dropdown ${inspirationOpen ? 'show' : ''}`}
                            >
                              <div className="dropdown-scroll-area">
                                {INSPIRATION_LIBRARY.map((group) => (
                                  <div key={group.category}>
                                    <div className="category-title">{group.category}</div>
                                    {group.items.map((item, index) => (
                                      <button
                                        key={`${group.category}-${item.name}`}
                                        type="button"
                                        className="dropdown-item"
                                        onClick={() => handleSelectInspiration(item.desc)}
                                      >
                                        <span className="item-name">
                                          <span className="item-index">{index + 1}.</span>
                                          {item.name}
                                        </span>
                                        <span className="item-desc">{item.desc}</span>
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="controls-right">
                            <span className="char-count">
                              {generatePromptCount}/{PROMPT_MAX_LENGTH}
                            </span>
                            <SubmitCapsule
                              cost={generateCreditCost}
                              tooltip={`本次生成消耗 ${generateCreditCost ?? '--'} 算粒`}
                              disabled={isSubmitting}
                              onClick={handleGenerate}
                              actionLabel="生成"
                            />
                          </div>
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
                      <div className="prompt-shell prompt-shell-edit">
                        <textarea
                          id="edit-prompt"
                          value={editPrompt}
                          onChange={handleEditPromptChange}
                          placeholder="描述你想怎么改，比如改配色、加元素、调整风格。"
                          rows={4}
                          maxLength={PROMPT_MAX_LENGTH}
                        />
                        <div className="prompt-controls prompt-controls-compact">
                          <div className="controls-right controls-right-wide">
                            <span className="char-count">
                              {editPromptCount}/{PROMPT_MAX_LENGTH}
                            </span>
                            <SubmitCapsule
                              cost={editCreditCost}
                              tooltip={`本次编辑消耗 ${editCreditCost ?? '--'} 算粒`}
                              disabled={isSubmitting}
                              onClick={handleEdit}
                              actionLabel="编辑"
                            />
                          </div>
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
                          themeMode={themeMode}
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
                        hasPreviewAsset ? `preview-bg-${previewBackdrop}` : ''
                      }`}
                    >
                      {hasPreviewAsset ? (
                        <div className={`result-view ${status === 'success' ? '' : 'is-muted'}`}>
                          <img src={previewSrc} alt="生成结果" />
                        </div>
                      ) : null}

                      {status === 'idle' && !hasPreviewAsset ? (
                        <div className="status-view">
                          <PlaceholderIcon />
                          <p>还没有结果</p>
                          <small>提交请求后，结果会显示在这里。</small>
                        </div>
                      ) : null}

                      {status === 'loading' ? (
                        <div className={`canvas-overlay ${hasPreviewAsset ? 'has-preview' : ''}`}>
                          {hasProgressOverlay ? (
                            <div className="loading-panel">
                              <div className="ai-loader-container" aria-hidden="true">
                                <div className="vector-ring vector-ring-outer" />
                                <div className="vector-ring vector-ring-inner" />
                                <div className="core-glow" />
                              </div>

                              <div className="loading-progress-value">
                                {Math.round(loadingProgress)}%
                              </div>

                              <div className="loading-content">
                                <div className="status-text" aria-live="polite">
                                  {loadingStatusText}
                                </div>

                                <div className="loading-step-chip">{activeLoadingStep.title}</div>

                                <div className="progress-bar-bg" aria-hidden="true">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${loadingProgress}%` }}
                                  />
                                </div>

                                {loadingTipText ? (
                                  <div className="tip-container">
                                    <div className="pro-tip">{loadingTipText}</div>
                                  </div>
                                ) : null}

                                {hasPreviewAsset ? (
                                  <div className="loading-retain-note">当前保留上一版预览，方便继续对比。</div>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="status-view compact">
                              <div className="spinner" />
                              <p>{statusMessage || '已收到请求，正在处理中...'}</p>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {status === 'error' ? (
                        <div className={`canvas-overlay ${hasPreviewAsset ? 'has-preview' : ''}`}>
                          <div className={`status-view error ${hasPreviewAsset ? 'compact' : ''}`}>
                            <p>{statusMessage}</p>
                            {hasPreviewAsset ? <small>上一版结果已保留，可继续检查或重新发起。</small> : null}
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
                        </div>
                      ) : null}

                      {hasPreviewAsset ? (
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
        </section>

        <section id="landing-showcase" className="landing-section landing-gallery-section">
          <LandingSectionHeader
            icon="✨"
            eyebrow="案例画廊"
            title="看看真实生成效果，找到你的灵感"
            description="这里展示的都是实际生成的 SVG 样例。把鼠标移到图片上，可以快速感受题材方向和画面氛围。"
          />
          <div className="showcase-grid">
            {SHOWCASE_ITEMS.map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="landing-section landing-workbench-section">
          <LandingSectionHeader
            icon="⚡"
            eyebrow="流光工作台"
            title={
              <>
                从一句描述到成品素材
                <br />
                常用步骤顺着做完
              </>
            }
            description="输入需求、调整参数、预览确认、继续编辑和下载交付，都可以在同一个沉浸式页面里闭环完成。"
          />
          <WorkbenchShowcase />
        </section>

        <section className="landing-section landing-capability-section">
          <LandingSectionHeader
            icon="🔥"
            eyebrow="核心能力"
            title="覆盖从出图到交付的关键步骤"
            description="为素材创作和设计交付准备的高频能力，都尽量集中在一个顺手的工作区里。"
          />
          <div className="zigzag-container">
            {CAPABILITY_ITEMS.map((item, index) => (
              <CapabilityRow
                key={item.title}
                item={item}
                reverse={index % 2 === 1}
              />
            ))}
          </div>
        </section>

        <section className="landing-section landing-usecase-section">
          <LandingSectionHeader
            icon="💡"
            eyebrow="适用场景"
            title="发掘更多创意的落地可能"
            description="无论你需要整组视觉、印刷前稿、营销素材还是图标方向，都可以先快速生成一版再继续细化。"
          />
          <div className="usecase-grid">
            {USECASE_ITEMS.map((item) => (
              <UsecaseCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <footer className="site-footer">
          <h2>{GLOWPAPER_CONFIG.brandName}</h2>
          <p>面向素材创作与快速交付的 AI SVG 工作台</p>
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
      <AuthDialog
        open={authDialogOpen}
        mode={authMode}
        form={authForm}
        error={authError}
        submitting={authSubmitting}
        onClose={closeAuthDialog}
        onModeChange={setNextAuthMode}
        onFieldChange={updateAuthField}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
}

export default App;
