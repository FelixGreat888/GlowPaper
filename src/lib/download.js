import JSZip from 'jszip';

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}

function triggerDownload(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function urlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('图片抓取失败');
  }

  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片转换失败'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadSingleImage(image, filename) {
  if (image.dataUrl) {
    triggerDownload(image.dataUrl, filename);
    return;
  }

  triggerDownload(image.url, filename);
}

export async function downloadBatchZip(batch) {
  const zip = new JSZip();
  const safeBase = sanitizeFileName(`${batch.params.modelName}-${batch.id}`);
  const linkLines = [];
  const originalPrompt = batch.params.originalPrompt || batch.params.prompt || '';
  const finalPrompts =
    Array.isArray(batch.params.finalPrompts) && batch.params.finalPrompts.length
      ? batch.params.finalPrompts.filter(Boolean)
      : [batch.params.finalPrompt || batch.params.prompt || originalPrompt].filter(Boolean);
  const optimizedPrompts =
    Array.isArray(batch.params.optimizedPrompts) && batch.params.optimizedPrompts.length
      ? batch.params.optimizedPrompts.filter(Boolean)
      : [];

  for (const image of batch.images) {
    const fileName = `${safeBase}-${image.index + 1}.png`;

    if (image.dataUrl) {
      const base64 = image.dataUrl.split(',')[1];
      zip.file(fileName, base64, { base64: true });
      continue;
    }

    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error('下载失败');
      }

      zip.file(fileName, await response.blob());
    } catch {
      linkLines.push(`${fileName}: ${image.url}`);
    }
  }

  zip.file(
    'prompt.txt',
    [
      `original_prompt: ${originalPrompt}`,
      optimizedPrompts.length ? 'optimized_prompts:' : null,
      ...optimizedPrompts.map((item, index) => `  [${index + 1}] ${item}`),
      finalPrompts.length ? 'final_prompts_used:' : null,
      ...finalPrompts.map((item, index) => `  [${index + 1}] ${item}`),
      `prompt_optimization: ${batch.params.promptOptimizationEnabled !== false ? 'on' : 'off'}`,
      '',
      `model: ${batch.params.modelName}`,
      `ratio: ${batch.params.ratio}`,
      `count: ${batch.params.count}`,
      `resolution: ${batch.params.width}x${batch.params.height}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  if (linkLines.length) {
    zip.file(
      'links.txt',
      [
        '以下图片未能直接打包，通常是第三方图片分发链接无 CORS 导致。',
        '可直接打开这些链接另存为：',
        '',
        ...linkLines,
      ].join('\n'),
    );
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const blobUrl = URL.createObjectURL(content);
  triggerDownload(blobUrl, `${safeBase}.zip`);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5_000);
}
