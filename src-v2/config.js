export const GLOWPAPER_CONFIG = {
  brandName: '流光SVG（佐糖出品）',
  accessGateKey: 'picwish666',
  apiBaseUrl: 'https://api.svgmaker.io/v1',
  apiKey: 'svgmaker-io52c3e86e3a694327',
  generatePlaceholder: '描述您想生成的SVG，比如 摩天轮，烟花，伦敦桥，河流，月亮',
  defaults: {
    tab: 'generate',
    quality: 'medium',
    background: 'transparent',
    aspectRatio: 'auto',
    styleParams: {
      style: 'line_art',
      color_mode: 'few_colors',
      image_complexity: 'illustration',
      text: '',
      composition: 'objects_in_grid',
    },
  },
};

export const CREDIT_COSTS = {
  generate: {
    low: 1,
    medium: 2,
    high: 3,
  },
  edit: {
    low: 2,
    medium: 3,
    high: 5,
  },
};

export const QUALITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

export const BACKGROUND_OPTIONS = [
  { value: 'transparent', label: '透明' },
  { value: 'opaque', label: '不透明' },
  { value: 'auto', label: '自动' },
];

export const ASPECT_RATIO_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'square', label: '方形' },
  { value: 'portrait', label: '竖图' },
  { value: 'landscape', label: '横图' },
];

export const STYLE_PARAM_OPTIONS = {
  style: [
    { value: 'flat', label: '扁平插画' },
    { value: 'line_art', label: '线稿' },
    { value: 'engraving', label: '雕版线刻' },
    { value: 'linocut', label: '版画' },
    { value: 'silhouette', label: '剪影' },
    { value: 'isometric', label: '等距视角' },
    { value: 'cartoon', label: '卡通' },
    { value: 'ghibli', label: '柔和动画风' },
  ],
  color_mode: [
    { value: 'full_color', label: '全彩' },
    { value: 'monochrome', label: '单色' },
    { value: 'few_colors', label: '少色' },
  ],
  image_complexity: [
    { value: 'icon', label: '图标级' },
    { value: 'illustration', label: '插画级' },
    { value: 'scene', label: '场景级' },
  ],
  text: [
    { value: '', label: '不加文字' },
    { value: 'only_title', label: '仅标题' },
    { value: 'embedded_text', label: '嵌入文案' },
  ],
  composition: [
    { value: 'centered_object', label: '主体居中' },
    { value: 'repeating_pattern', label: '重复图案' },
    { value: 'full_scene', label: '完整场景' },
    { value: 'objects_in_grid', label: '网格排布' },
  ],
};
