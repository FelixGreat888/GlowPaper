import { useEffect, useState } from 'react';
import { generateOneImage, optimizePrompt } from './lib/api.js';
import { downloadBatchZip, downloadSingleImage } from './lib/download.js';
import { loadHistory, saveHistory } from './lib/storage.js';

const NAV_ITEMS = [
  { id: 'generate', label: '文生图' },
  { id: 'train', label: 'LoRA 训练' },
  { id: 'my-lora', label: '我的 LoRA' },
];

const IMAGE_COUNTS = [1, 2, 4, 8];

const RATIO_META = {
  '1:1': { title: '1:1 方图', hint: '包装主图', previewClass: 'ratio-square' },
  '16:9': { title: '16:9 横图', hint: '横向视觉', previewClass: 'ratio-landscape' },
  '9:16': { title: '9:16 竖图', hint: '竖版壁纸', previewClass: 'ratio-portrait' },
  '4:3': { title: '4:3 标准', hint: '海报比例', previewClass: 'ratio-standard' },
  '3:4': { title: '3:4 海报', hint: '竖向贴纸', previewClass: 'ratio-poster' },
};

const TRAIN_FEATURES = [
  {
    title: '提示词优化',
    copy: '自动增强训练描述，让素材更容易收敛到统一风格。',
  },
  {
    title: '自动打标',
    copy: '上传原始图片后自动整理标签，减少人工清洗成本。',
  },
  {
    title: '参数微调',
    copy: '预留 rank、alpha、学习率等高级参数配置入口。',
  },
];

const LORA_INSIGHTS = [
  { title: '风格库', value: '0', note: 'V2 开放后统一管理' },
  { title: '默认基础模型', value: 'Flux Klein', note: '与文生图页保持一致' },
  { title: '训练状态', value: '即将开放', note: '当前仅保留 UI 预埋' },
];

function BrandLogo() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <img src="/logo.png" alt="" />
    </span>
  );
}

function SparkIcon() {
  return (
    <span className="spark-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z" fill="currentColor" />
        <path d="m19 15 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" fill="currentColor" />
        <path d="m5 15 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelativeTime(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return '刚刚';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function buildBatch(params, images, overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    createdAt: overrides.createdAt || new Date().toISOString(),
    status: overrides.status || 'done',
    error: overrides.error || '',
    params,
    images,
  };
}

function mergeBatchImages(totalCount, resolvedImages) {
  const mapped = new Map(resolvedImages.map((image) => [image.index, image]));

  return Array.from({ length: totalCount }, (_, index) => {
    return (
      mapped.get(index) || {
        id: `placeholder-${index}`,
        index,
        status: 'pending',
      }
    );
  });
}

function getOriginalPrompt(params) {
  return params.originalPrompt || params.prompt || '';
}

function getFinalPrompt(params) {
  return params.finalPrompt || params.prompt || getOriginalPrompt(params);
}

function getFinalPromptList(params) {
  if (Array.isArray(params.finalPrompts) && params.finalPrompts.length) {
    return params.finalPrompts.filter(Boolean);
  }

  const singlePrompt = getFinalPrompt(params);
  return singlePrompt ? [singlePrompt] : [];
}

function getOptimizedPromptValue(params) {
  const originalPrompt = getOriginalPrompt(params);
  const optimizedPrompt = params.optimizedPrompt || getFinalPrompt(params);
  return optimizedPrompt && optimizedPrompt !== originalPrompt ? optimizedPrompt : '';
}

function getOptimizedPromptList(params) {
  if (Array.isArray(params.optimizedPrompts) && params.optimizedPrompts.length) {
    return params.optimizedPrompts.filter(Boolean);
  }

  const singlePrompt = getOptimizedPromptValue(params);
  return singlePrompt ? [singlePrompt] : [];
}

function getImagePrompt(batch, image) {
  return (
    image.prompt ||
    getFinalPromptList(batch.params)[image.index] ||
    getFinalPrompt(batch.params) ||
    getOriginalPrompt(batch.params)
  );
}

function ResultImageCard({ batch, image, onPreview, onPrompt }) {
  return (
    <div className="result-card">
      {image.url || image.dataUrl ? (
        <>
          <img
            src={image.dataUrl || image.url}
            alt={`${batch.params.modelName}-${image.index + 1}`}
          />
          <div className="result-overlay">
            <div className="image-toolbar">
              <button
                type="button"
                className="icon-button"
                onClick={onPreview}
              >
                放大
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={onPrompt}
              >
                提示词
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  downloadSingleImage(
                    image,
                    `${batch.params.modelName}-${batch.id}-${image.index + 1}.png`,
                  )
                }
              >
                下载
              </button>
            </div>
            {image.storageKind === 'proxy-url' && (
              <span className="proxy-badge">代理分发</span>
            )}
          </div>
        </>
      ) : (
        <div className="result-placeholder">
          <span>{batch.status === 'running' ? '生成中...' : '等待生成'}</span>
        </div>
      )}
    </div>
  );
}

function GeneratePage({ config, history, setHistory, setActiveTab }) {
  const models = config.models;
  const ratioEntries = Object.values(config.ratios);
  const [selectedModelId, setSelectedModelId] = useState(config.default_model_id);
  const [imageCount, setImageCount] = useState(4);
  const [ratio, setRatio] = useState('3:4');
  const [prompt, setPrompt] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [promptDialog, setPromptDialog] = useState(null);
  const [message, setMessage] = useState('');
  const [workingBatch, setWorkingBatch] = useState(null);
  const [showCompactSettings, setShowCompactSettings] = useState(false);
  const [promptOptimizationEnabled, setPromptOptimizationEnabled] = useState(true);

  const model = models.find((item) => item.id === selectedModelId) || models[0];
  const resolution = config.ratios[ratio];
  const batches = workingBatch
    ? [workingBatch, ...history.filter((item) => item.id !== workingBatch.id)]
    : history;
  const isErrorMessage = /(失败|错误|超时|未|error|fetch)/i.test(message);
  const previewItems = [];
  const previewIndexMap = new Map();

  batches.forEach((batch) => {
    batch.images.forEach((image) => {
      if (!image.url && !image.dataUrl) {
        return;
      }

      const key = `${batch.id}-${image.index}`;
      previewIndexMap.set(key, previewItems.length);
      previewItems.push({
        key,
        batch,
        image,
      });
    });
  });

  const activePreview =
    previewIndex !== null && previewIndex >= 0 && previewIndex < previewItems.length
      ? previewItems[previewIndex]
      : null;

  function closePreview() {
    setPreviewIndex(null);
  }

  function stepPreview(direction) {
    setPreviewIndex((current) => {
      if (current === null || !previewItems.length) {
        return current;
      }

      const nextIndex = current + direction;
      if (nextIndex < 0 || nextIndex >= previewItems.length) {
        return current;
      }

      return nextIndex;
    });
  }

  useEffect(() => {
    if (!activePreview) {
      return undefined;
    }

    function handlePreviewKey(event) {
      if (event.key === 'Escape') {
        closePreview();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        stepPreview(-1);
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        stepPreview(1);
      }
    }

    window.addEventListener('keydown', handlePreviewKey);
    return () => window.removeEventListener('keydown', handlePreviewKey);
  }, [activePreview, previewItems.length]);

  async function runGeneration({
    promptValue,
    modelId,
    count,
    ratioValue,
    optimizationEnabled,
  }) {
    if (!promptValue.trim()) {
      setMessage('请输入提示词后再生成。');
      return;
    }

    const targetModel = models.find((item) => item.id === modelId) || models[0];
    const targetRatio = config.ratios[ratioValue] ? ratioValue : '3:4';
    const targetResolution = config.ratios[targetRatio];
    const originalPrompt = promptValue.trim();
    let finalPrompts = Array.from({ length: count }, () => originalPrompt);
    let optimizedPrompts = [];

    setIsGenerating(true);
    setMessage('');

    if (optimizationEnabled) {
      setIsOptimizing(true);
      setMessage(`正在生成 ${count} 条优化提示词...`);

      try {
        const result = await optimizePrompt(config, originalPrompt, count);
        optimizedPrompts = result.positivePrompts
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, count);

        if (optimizedPrompts.length) {
          finalPrompts = Array.from({ length: count }, (_, index) => {
            return optimizedPrompts[index] || optimizedPrompts[index % optimizedPrompts.length];
          });
          setMessage(`提示词优化完成，已生成 ${optimizedPrompts.length} 条变体，开始出图...`);
        } else {
          setMessage('未获取到优化结果，已直接使用原始提示词生成。');
        }
      } catch {
        setMessage('提示词优化失败，已直接使用原始提示词生成。');
      } finally {
        setIsOptimizing(false);
      }
    }

    const params = {
      modelId: targetModel.id,
      modelName: targetModel.name,
      provider: targetModel.provider,
      prompt: finalPrompts[0] || originalPrompt,
      originalPrompt,
      finalPrompt: finalPrompts[0] || originalPrompt,
      finalPrompts,
      optimizedPrompt: optimizedPrompts[0] || '',
      optimizedPrompts,
      promptOptimizationEnabled: optimizationEnabled,
      optimizationApplied: optimizedPrompts.some((item) => item && item !== originalPrompt),
      ratio: targetRatio,
      count,
      width: targetResolution.width,
      height: targetResolution.height,
    };

    const pendingBatch = buildBatch(
      params,
      Array.from({ length: count }, (_, index) => ({
        id: `${Date.now()}-${index}`,
        index,
        status: 'pending',
      })),
      {
        status: 'running',
      },
    );

    setWorkingBatch(pendingBatch);

    try {
      const resolvedImages = [];
      const requests = Array.from({ length: count }, (_, index) =>
        generateOneImage(targetModel, {
          prompt: finalPrompts[index] || params.prompt,
          width: params.width,
          height: params.height,
          seed: Math.floor(Math.random() * 1_000_000_000),
        }).then((image) => {
          resolvedImages.push({
            ...image,
            index,
            prompt: finalPrompts[index] || params.prompt,
          });

          setWorkingBatch(
            buildBatch(params, mergeBatchImages(count, resolvedImages), {
              id: pendingBatch.id,
              createdAt: pendingBatch.createdAt,
              status: 'running',
            }),
          );
        }),
      );

      await Promise.all(requests);

      const images = [...resolvedImages].sort((left, right) => left.index - right.index);
      const completedBatch = buildBatch(params, images, {
        id: pendingBatch.id,
        createdAt: pendingBatch.createdAt,
      });

      setHistory((currentHistory) =>
        [completedBatch, ...currentHistory].slice(0, config.history_limit),
      );
      setWorkingBatch(null);
      setMessage('生成完成。');
    } catch (error) {
      setWorkingBatch({
        ...pendingBatch,
        status: 'error',
        error: error.message,
      });
      setMessage(error.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate() {
    await runGeneration({
      promptValue: prompt,
      modelId: selectedModelId,
      count: imageCount,
      ratioValue: ratio,
      optimizationEnabled: promptOptimizationEnabled,
    });
  }

  async function regenerateBatch(batch) {
    setPrompt(getOriginalPrompt(batch.params));
    setSelectedModelId(batch.params.modelId);
    setImageCount(batch.params.count);
    setRatio(batch.params.ratio);
    setPromptOptimizationEnabled(batch.params.promptOptimizationEnabled !== false);

    await runGeneration({
      promptValue: getOriginalPrompt(batch.params),
      modelId: batch.params.modelId,
      count: batch.params.count,
      ratioValue: batch.params.ratio,
      optimizationEnabled: batch.params.promptOptimizationEnabled !== false,
    });
  }

  async function copyBatchPrompt(batch) {
    try {
      const optimizedPrompts = getOptimizedPromptList(batch.params);
      const copiedPrompts = optimizedPrompts.length
        ? optimizedPrompts
        : getFinalPromptList(batch.params);
      await navigator.clipboard.writeText(copiedPrompts.join('\n'));
      setMessage(
        optimizedPrompts.length > 1
          ? `已复制 ${optimizedPrompts.length} 条优化后提示词。`
          : optimizedPrompts.length === 1
            ? '已复制优化后提示词。'
            : '提示词已复制。',
      );
    } catch {
      setMessage('复制失败，请检查浏览器剪贴板权限。');
    }
  }

  return (
    <section className="workspace workspace-generate-inline">
      <section className="generate-main generate-main-wide">
        <div className="composer-card">
          <div className="composer-header">
            <div>
              <p className="eyebrow">提示词输入</p>
              <h2>描述你想要生成的贴纸 / 壁纸风格</h2>
            </div>
            <span className="counter-pill">{prompt.length}/800</span>
          </div>

          <textarea
            className="composer-input"
            maxLength={800}
            rows={7}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            placeholder="例如：烟花，小马，伦敦桥，江边，摩天轮"
          />

          <div className="composer-toolbar">
            <div className="prompt-optimization-toggle">
              <div className="toggle-copy">
                <strong>提示词优化</strong>
                <span>建议开启</span>
              </div>
              <button
                type="button"
                className={`switch-button ${promptOptimizationEnabled ? 'active' : ''}`}
                aria-pressed={promptOptimizationEnabled}
                onClick={() => {
                  setPromptOptimizationEnabled((current) => {
                    return !current;
                  });
                }}
              >
                <span />
              </button>
            </div>

            <div className="composer-actions">
              <div className={`toolbar-summary ${showCompactSettings ? 'open' : ''}`}>
                <button
                  type="button"
                  className="compact-settings-trigger"
                  onClick={() => setShowCompactSettings((current) => !current)}
                >
                  生成设置
                  <span>{showCompactSettings ? '收起' : '展开'}</span>
                </button>
                <span className="mini-chip">{model.name}</span>
                <span className="mini-chip">
                  {ratio} / {imageCount} 张
                </span>
                <span className="mini-chip">
                  {resolution.width} x {resolution.height}
                </span>
                <span className="mini-chip">
                  {promptOptimizationEnabled ? '优化开启' : '原词直出'}
                </span>

                {showCompactSettings && (
                  <div className="compact-settings-menu">
                    <div className="compact-settings-grid">
                      <label className="compact-field">
                        <span>模型</span>
                        <select
                          value={selectedModelId}
                          onChange={(event) => setSelectedModelId(event.target.value)}
                        >
                          {models.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="compact-field">
                        <span>输出比例</span>
                        <select value={ratio} onChange={(event) => setRatio(event.target.value)}>
                          {ratioEntries.map((item) => (
                            <option key={item.label} value={item.label}>
                              {RATIO_META[item.label]?.title || item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="compact-field compact-field-wide">
                        <span>生成张数</span>
                        <div className="count-grid compact-count-grid">
                          {IMAGE_COUNTS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={`count-pill ${value === imageCount ? 'active' : ''}`}
                              onClick={() => setImageCount(value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="compact-lora-row">
                        <div>
                          <strong>LoRA 预埋</strong>
                          <span>V2 开放，当前仅保留入口。</span>
                        </div>
                        <button
                          type="button"
                          className="ghost-button compact-link-button"
                          onClick={() => setActiveTab('train')}
                        >
                          查看训练页
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="generate-action-stack">
                <button
                  type="button"
                  className="primary-button primary-generate"
                  disabled={isGenerating}
                  onClick={handleGenerate}
                >
                  <SparkIcon />
                  {isGenerating ? '生成中...' : '开始生成'}
                </button>
                <p
                  className={`action-notice ${message ? 'is-visible' : 'is-empty'} ${isErrorMessage ? 'is-error' : ''}`}
                  aria-live="polite"
                >
                  {message || ' '}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="history-waterfall-section">
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">生成历史</p>
              <h2>{batches.length ? '所有生成批次' : '还没有生成记录'}</h2>
            </div>
            {batches.length > 0 && <span className="history-summary">本地缓存最近 {config.history_limit} 批</span>}
          </div>

          {batches.length === 0 ? (
            <div className="empty-state large-empty">
              <SparkIcon />
              <h3>还没有生成记录</h3>
              <p>先输入一段风格提示词，再点击开始生成。</p>
            </div>
          ) : (
            <div className="history-waterfall">
              {batches.map((batch, index) => (
                <article
                  key={batch.id}
                  className={`history-batch-card ${index === 0 ? 'latest' : ''}`}
                >
                  <div className="batch-card-head">
                    <div className="batch-card-title">
                      <p className="eyebrow">
                        {index === 0 && batch.status === 'running'
                          ? '生成中'
                          : index === 0
                            ? '最新批次'
                            : '历史记录'}
                      </p>
                      <h3>{formatDateTime(batch.createdAt)}</h3>
                    </div>
                    <div className="batch-card-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => copyBatchPrompt(batch)}
                        disabled={batch.status === 'running'}
                      >
                        复制提示词
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void regenerateBatch(batch)}
                        disabled={isGenerating}
                      >
                        重新生成
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => downloadBatchZip(batch)}
                        disabled={batch.status === 'running'}
                      >
                        打包下载
                      </button>
                    </div>
                  </div>

                  <div className="results-meta">
                    <span className="meta-chip">{batch.params.modelName}</span>
                    <span className="meta-chip">
                      {batch.params.ratio} / {batch.params.count} 张
                    </span>
                    <span className="meta-chip">
                      {batch.params.width} x {batch.params.height}
                    </span>
                    <span className="meta-chip">{formatRelativeTime(batch.createdAt)}</span>
                  </div>

                  {batch.status === 'error' && (
                    <div className="batch-error-row">
                      <p className="notice-bar is-error">生成失败：{batch.error}</p>
                    </div>
                  )}

                  <div className="batch-row-scroll">
                    <div className="result-grid timeline-result-grid">
                      {batch.images.map((image) => (
                        <ResultImageCard
                          key={`${batch.id}-${image.index}`}
                          batch={batch}
                          image={image}
                          onPreview={() => setPreviewIndex(previewIndexMap.get(`${batch.id}-${image.index}`))}
                          onPrompt={() =>
                            setPromptDialog({
                              title: `第 ${image.index + 1} 张提示词`,
                              originalPrompt: getOriginalPrompt(batch.params),
                              imagePrompt: getImagePrompt(batch, image),
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {activePreview && (
        <div className="modal-backdrop" onClick={closePreview}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-toolbar">
              <span className="modal-counter">
                {previewIndex + 1} / {previewItems.length}
              </span>
              <div className="modal-toolbar-actions">
                <button
                  type="button"
                  className="modal-nav"
                  onClick={() => stepPreview(-1)}
                  disabled={previewIndex === 0}
                >
                  上一张
                </button>
                <button
                  type="button"
                  className="modal-nav"
                  onClick={() => stepPreview(1)}
                  disabled={previewIndex === previewItems.length - 1}
                >
                  下一张
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={closePreview}
            >
              关闭
            </button>
            <button
              type="button"
              className="modal-side-nav modal-side-nav-left"
              onClick={() => stepPreview(-1)}
              disabled={previewIndex === 0}
            >
              ‹
            </button>
            <button
              type="button"
              className="modal-side-nav modal-side-nav-right"
              onClick={() => stepPreview(1)}
              disabled={previewIndex === previewItems.length - 1}
            >
              ›
            </button>
            <img src={activePreview.image.dataUrl || activePreview.image.url} alt="预览图" />
          </div>
        </div>
      )}

      {promptDialog && (
        <div className="modal-backdrop" onClick={() => setPromptDialog(null)}>
          <div className="modal-card prompt-modal-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setPromptDialog(null)}
            >
              关闭
            </button>
            <div className="prompt-modal-body">
              <h3>{promptDialog.title}</h3>
              <div className="prompt-block">
                <span>原始提示词</span>
                <p>{promptDialog.originalPrompt}</p>
              </div>
              <div className="prompt-block prompt-block-emphasis">
                <span>实际生成提示词</span>
                <p>{promptDialog.imagePrompt}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TrainPage() {
  return (
    <section className="studio-page">
      <div className="page-hero">
        <div>
          <p className="eyebrow">V2 预览</p>
          <h1>LoRA 训练中心</h1>
          <p>
            为 Flux Klein 生成链路预埋 LoRA 训练体验。V1 只展示结构，V2 再开放上传、
            训练和风格管理。
          </p>
        </div>
        <span className="preview-badge">V2 预览</span>
      </div>

      <div className="preview-banner">
        <div className="banner-copy">
          <div className="banner-icon">
            <SparkIcon />
          </div>
          <div>
            <strong>LoRA 训练功能即将开放</strong>
            <p>将支持上传 40-100 张素材、设置基础模型和训练强度，并在文生图页启用。</p>
          </div>
        </div>
        <div className="waitlist-group">
          <input disabled placeholder="内部预留邮箱入口（V2）" />
          <button type="button" className="ghost-button" disabled>
            敬请期待
          </button>
        </div>
      </div>

      <div className="train-shell">
        <div className="train-main-panel">
          <label className="field">
            <span>模型名称</span>
            <input disabled placeholder="例如：赛博烟雾贴纸 v1" />
          </label>

          <div className="train-grid">
            <div className="train-block">
              <div className="section-title">
                <h2>基础模型</h2>
              </div>
              <div className="base-model-grid">
                <button type="button" className="base-model-card active" disabled>
                  <strong>Flux Klein</strong>
                  <span>默认风格基础模型</span>
                </button>
                <button type="button" className="base-model-card" disabled>
                  <strong>Flux 2 Pro</strong>
                  <span>预留更高细节版本</span>
                </button>
              </div>
            </div>

            <div className="train-block">
              <div className="section-title">
                <h2>训练步数</h2>
                <span>2,500</span>
              </div>
              <div className="progress-card">
                <div className="progress-bar">
                  <span />
                </div>
                <div className="progress-legend">
                  <small>速度</small>
                  <small>质量</small>
                </div>
              </div>
            </div>
          </div>

          <div className="train-grid">
            <div className="train-block wide-span">
              <div className="section-title">
                <h2>训练素材</h2>
                <span>建议至少 40 张</span>
              </div>
              <div className="upload-zone" aria-disabled="true">
                <div className="upload-mark">+</div>
                <strong>拖拽文件夹或点击浏览</strong>
                <p>支持 JPG、PNG。V1 仅展示不可提交的占位交互。</p>
              </div>
              <div className="upload-preview-row">
                <div />
                <div />
                <div />
                <div className="upload-more">+36</div>
              </div>
            </div>

            <div className="train-side-panel">
              <label className="field">
                <span>触发词</span>
                <input disabled value="sks_vape_mod" readOnly />
              </label>
              <div className="cost-card">
                <div className="summary-row">
                  <span>预计消耗</span>
                  <strong>450 积分</strong>
                </div>
                <div className="summary-row">
                  <span>预计时长</span>
                  <strong>约 25 分钟</strong>
                </div>
                <button type="button" className="primary-button wide-button" disabled>
                  开始训练
                </button>
              </div>
            </div>
          </div>

          <button type="button" className="advanced-toggle" disabled>
            高级配置
          </button>
        </div>
      </div>

      <div className="feature-strip">
        {TRAIN_FEATURES.map((item) => (
          <article key={item.title} className="feature-card">
            <div className="feature-icon">
              <SparkIcon />
            </div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MyLoraPage() {
  return (
    <section className="studio-page">
      <div className="page-hero">
        <div>
          <p className="eyebrow">V2 预览</p>
          <h1>我的 LoRA</h1>
          <p>
            当前还没有可用的 LoRA 模型。页面先保留管理区、筛选区和空态，用于后续直接接训练结果。
          </p>
        </div>
        <span className="preview-badge">空状态</span>
      </div>

      <div className="preview-banner">
        <div className="banner-copy">
          <div className="banner-icon">
            <SparkIcon />
          </div>
          <div>
            <strong>你还没有 LoRA 模型</strong>
            <p>V2 开放训练与管理后，可在这里查看状态、复制触发词并快速回到文生图页使用。</p>
          </div>
        </div>
        <button type="button" className="ghost-button" disabled>
          创建第一个 LoRA
        </button>
      </div>

      <div className="library-shell">
        <div className="library-table">
          <div className="section-title">
            <h2>模型列表</h2>
            <span>0 个模型</span>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>基础模型</th>
                  <th>创建时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="5" className="table-empty">
                    暂无数据，V2 开放后会在这里展示训练完成的风格模型。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside className="library-side">
          <div className="section-title">
            <h2>概览</h2>
          </div>
          <div className="insight-list">
            {LORA_INSIGHTS.map((item) => (
              <div key={item.title} className="insight-card">
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
          <div className="disabled-actions">
            <button type="button" className="ghost-button" disabled>
              使用
            </button>
            <button type="button" className="ghost-button" disabled>
              复制
            </button>
            <button type="button" className="ghost-button" disabled>
              删除
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('generate');
  const [history, setHistory] = useState([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/config.json');
        if (!response.ok) {
          throw new Error('配置加载失败');
        }
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        setConfigError(error.message);
      }
    }

    loadConfig();
  }, []);

  useEffect(() => {
    async function hydrateHistory() {
      const restoredHistory = await loadHistory();
      setHistory(Array.isArray(restoredHistory) ? restoredHistory : []);
      setHistoryReady(true);
    }

    hydrateHistory();
  }, []);

  useEffect(() => {
    if (!historyReady) {
      return;
    }

    void saveHistory(history);
  }, [history, historyReady]);

  if (configError) {
    return <main className="app-shell">配置错误：{configError}</main>;
  }

  if (!config || !historyReady) {
    return <main className="app-shell">加载配置中...</main>;
  }

  return (
    <main className="app-shell">
      <div className="app-background" />

      <header className="topbar">
        <div className="brand-block">
          <BrandLogo />
          <div>
            <strong>GlowPaper</strong>
            <span>AI电子烟壁纸灵感生成</span>
          </div>
        </div>

        <nav className="tab-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeTab === item.id ? 'active' : ''}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-side">
          <span className="topbar-chip">内部版 · 无登录</span>
        </div>
      </header>

      <div className="tab-panels">
        <div
          className="tab-panel"
          hidden={activeTab !== 'generate'}
          aria-hidden={activeTab !== 'generate'}
        >
          <GeneratePage
            config={config}
            history={history}
            setHistory={setHistory}
            setActiveTab={setActiveTab}
          />
        </div>

        <div
          className="tab-panel"
          hidden={activeTab !== 'train'}
          aria-hidden={activeTab !== 'train'}
        >
          <TrainPage />
        </div>

        <div
          className="tab-panel"
          hidden={activeTab !== 'my-lora'}
          aria-hidden={activeTab !== 'my-lora'}
        >
          <MyLoraPage />
        </div>
      </div>
    </main>
  );
}
