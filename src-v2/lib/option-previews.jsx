const PREVIEW_META = {
  style: {
    flat: {
      title: '扁平插画',
      description: '大色块、边缘利落，适合做清晰醒目的贴纸和素材。',
    },
    line_art: {
      title: '线稿',
      description: '以线条为主，轮廓干净，适合透明底和后期再配色。',
    },
    engraving: {
      title: '雕版线刻',
      description: '有细密排线和复古刻版感，层次更像印刷插图。',
    },
    linocut: {
      title: '版画',
      description: '块面强、对比重，像手工套版后的大胆图形效果。',
    },
    silhouette: {
      title: '剪影',
      description: '主体会收成整块轮廓，适合做强识别度的单形素材。',
    },
    isometric: {
      title: '等距视角',
      description: '带空间透视和立体结构，适合器物、场景类题材。',
    },
    cartoon: {
      title: '卡通',
      description: '更夸张、更可爱，轮廓柔和，适合偏轻松的视觉方向。',
    },
    ghibli: {
      title: '柔和动画风',
      description: '色彩和气氛更柔软，适合做带情绪感的小场景。',
    },
  },
  color_mode: {
    full_color: {
      title: '全彩',
      description: '颜色最丰富，适合节庆、氛围和高饱和主题。',
    },
    monochrome: {
      title: '单色',
      description: '只保留一个主色系，适合统一品牌色或极简输出。',
    },
    few_colors: {
      title: '少色',
      description: '通常控制在 2 到 4 个主色，既有层次又方便印刷。',
    },
  },
  image_complexity: {
    icon: {
      title: '图标级',
      description: '一个主体，细节很少，最适合做独立可组合元素。',
    },
    illustration: {
      title: '插画级',
      description: '会补充装饰和层次，比图标更完整，但还不至于太满。',
    },
    scene: {
      title: '场景级',
      description: '会生成完整环境、前后关系和更多内容，画面最丰富。',
    },
  },
  text: {
    '': {
      title: '不加文字',
      description: '只保留图形本身，适合后续自己再排版或组合。',
    },
    only_title: {
      title: '仅标题',
      description: '增加一行简短标题，图和字分工清楚。',
    },
    embedded_text: {
      title: '嵌入文案',
      description: '文字会参与整体构图，更像成品海报或贴纸。',
    },
  },
  composition: {
    centered_object: {
      title: '主体居中',
      description: '一个核心元素放在中间，最稳妥，也最适合单个素材。',
    },
    repeating_pattern: {
      title: '重复图案',
      description: '多个元素按规律平铺，适合底纹、花型和包装图案。',
    },
    full_scene: {
      title: '完整场景',
      description: '主体和背景一起形成一个完整画面，叙事感更强。',
    },
    objects_in_grid: {
      title: '网格排布',
      description: '多个独立元素整齐分布，适合做一组组合素材。',
    },
  },
};

function PreviewFrame({ children, background = '#090611' }) {
  return (
    <svg viewBox="0 0 160 124" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="160" height="124" rx="18" fill={background} />
      <rect x="10" y="10" width="140" height="104" rx="14" fill="rgba(255,255,255,0.02)" />
      {children}
    </svg>
  );
}

function FlatArtwork() {
  return (
    <PreviewFrame>
      <g stroke="#201739" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M86 24c15 6 25 19 24 40-15 3-28-1-39-13 1-12 7-21 15-27Z" fill="#8B84FF" />
        <path d="M86 24c15 6 25 19 24 40-15 3-28-1-39-13 1-12 7-21 15-27Z" />
        <path d="M111 31c8 2 13 6 17 12v10l-15-6-2-16Z" fill="#FFD04D" />
        <circle cx="106" cy="52" r="10" fill="#B6FAEA" />
        <path d="M90 67 73 79l9-19" fill="#8B84FF" />
        <path d="m110 72 7 19 10-16" fill="#8B84FF" />
        <path d="M86 76c-2 8-7 15-14 22" />
        <path d="M84 84c-4 4-9 7-14 8" />
        <path d="M82 90c-2 4-5 7-10 10" />
        <path d="M75 84c2 8 10 15 23 19 8-8 11-18 10-30-10 2-18 6-23 11Z" fill="#FFD04D" />
        <path d="M64 98c0 0 7-11 17-9 10 1 14 12 14 12" fill="#F5F0DE" />
      </g>
    </PreviewFrame>
  );
}

function LineArtArtwork() {
  return (
    <PreviewFrame>
      <g stroke="#E6DEFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M86 24c15 6 25 19 24 40-15 3-28-1-39-13 1-12 7-21 15-27Z" />
        <path d="M111 31c8 2 13 6 17 12v10l-15-6-2-16Z" />
        <circle cx="106" cy="52" r="10" />
        <path d="M90 67 73 79l9-19" />
        <path d="m110 72 7 19 10-16" />
        <path d="M86 76c-2 8-7 15-14 22" />
        <path d="M84 84c-4 4-9 7-14 8" />
        <path d="M82 90c-2 4-5 7-10 10" />
        <path d="M76 83c4 9 11 15 22 20 8-8 12-18 10-29-9 2-17 5-22 9Z" />
        <path d="M62 99c2-4 7-9 13-10 10-2 16 8 18 12" />
        <path d="M36 35h10M41 30v10M123 84h8M127 80v8" />
      </g>
    </PreviewFrame>
  );
}

function EngravingArtwork() {
  return (
    <PreviewFrame background="#0B0713">
      <g stroke="#D7C3A3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="80" cy="62" rx="34" ry="44" />
        <path d="M80 26c-10 10-14 23-14 37 0 13 4 26 14 35 10-9 14-22 14-35 0-14-4-27-14-37Z" />
        <path d="M80 33v58M69 39c7 10 17 20 27 28M66 50c10 8 21 16 29 25M67 66c11 6 18 11 24 18M73 28c-4 16-8 37-7 55M87 31c5 17 9 35 9 54" />
        <path d="M57 34c7 5 13 9 19 15M104 37c-6 5-12 9-18 15M55 86h50" />
      </g>
    </PreviewFrame>
  );
}

function LinocutArtwork() {
  return (
    <PreviewFrame background="#110A19">
      <path d="M39 93c15-33 39-53 72-58 6 20 3 38-10 55-16 5-36 6-62 3Z" fill="#F3E9D0" />
      <path d="M51 89c9-19 22-31 39-36 7 4 13 10 18 20-9 12-28 19-57 16Z" fill="#FF8A54" />
      <path d="M101 44c9 1 17 5 24 12-7 5-14 7-23 7-1-6-1-12-1-19Z" fill="#F2C94C" />
      <path d="M45 90c17-37 42-56 76-58" stroke="#1B132A" strokeWidth="5" strokeLinecap="round" />
      <path d="M59 79c10-9 22-14 37-16M69 95c11-8 23-12 36-14M57 65c11-5 24-10 40-11" stroke="#1B132A" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function SilhouetteArtwork() {
  return (
    <PreviewFrame>
      <circle cx="110" cy="34" r="17" fill="#FFD34D" />
      <path
        d="M77 87c-2-8-1-18 1-27-5-3-9-10-9-17l8 6 5-12 8 11c11-1 21 2 28 8 0 11-6 21-15 26v5c0 4 4 8 9 11H93c4-3 7-6 7-10v-3c-4 1-8 2-11 2-3 0-7 0-12-1v4c0 4 3 7 7 8H65c6-3 10-6 12-11Z"
        fill="#05050A"
      />
      <path d="M40 98c8-6 18-9 31-9" stroke="#6A5DA1" strokeWidth="3" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function IsometricArtwork() {
  return (
    <PreviewFrame>
      <g stroke="#1D1730" strokeWidth="3" strokeLinejoin="round">
        <path d="m48 70 28-16 26 15-27 17-27-16Z" fill="#86A4FF" />
        <path d="m76 54 0 32" />
        <path d="M48 70v18l27 16V86M102 69v18L75 104" />
        <path d="m82 47 24-13 25 14-24 14-25-15Z" fill="#DAB3FF" />
        <path d="M107 34v28M82 47v17l25 15V62M131 48v17l-24 14" />
        <path d="m29 47 18-10 19 11-18 10-19-11Z" fill="#FFD35B" />
        <path d="M48 37v21M29 47v12l19 11V58M66 48v12L48 70" />
      </g>
    </PreviewFrame>
  );
}

function CartoonArtwork() {
  return (
    <PreviewFrame background="#0A0814">
      <g stroke="#1E1731" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m78 28 7 14 15 2-11 10 3 15-14-7-13 7 2-15-11-10 15-2 7-14Z" fill="#FFD95B" />
        <circle cx="73" cy="49" r="2.4" fill="#1E1731" />
        <circle cx="83" cy="49" r="2.4" fill="#1E1731" />
        <path d="M74 57c3 2 7 2 10 0" />
        <path d="M42 82c0-11 10-20 22-20 7-9 22-8 28 2 9 0 16 6 18 14-2 4-7 7-14 7H58c-10 0-16-1-16-3Z" fill="#F5F0DE" />
        <path d="M112 32h8M116 28v8M123 54h6M126 51v6" stroke="#D6B3FF" />
      </g>
    </PreviewFrame>
  );
}

function GhibliArtwork() {
  return (
    <PreviewFrame background="#0C0913">
      <rect x="0" y="86" width="160" height="38" fill="#203031" />
      <path d="M0 92c20-16 33-19 49-10 16 9 31 9 49-3 17-12 35-11 62 3v32H0V92Z" fill="#58786F" />
      <path d="M53 78c6-18 16-29 31-34 14 6 24 17 29 34H53Z" fill="#2E4353" />
      <path d="M66 78V56h16v22M86 78V56h14v22" stroke="#F5EED4" strokeWidth="3" />
      <rect x="77" y="65" width="11" height="13" rx="5" fill="#F7D07F" />
      <circle cx="122" cy="28" r="16" fill="#E6DFF6" opacity="0.9" />
      <path d="M28 34c5-8 12-12 21-12 8 0 15 4 19 12H28ZM103 45c4-5 9-8 15-8 6 0 11 3 14 8h-29Z" fill="#D6C5F1" />
    </PreviewFrame>
  );
}

function FullColorArtwork() {
  return (
    <PreviewFrame>
      <circle cx="46" cy="74" r="14" fill="#FF7FB2" />
      <circle cx="80" cy="48" r="14" fill="#57D6FF" />
      <circle cx="114" cy="76" r="14" fill="#FFD95B" />
      <circle cx="46" cy="74" r="5" fill="#23163C" />
      <circle cx="80" cy="48" r="5" fill="#23163C" />
      <circle cx="114" cy="76" r="5" fill="#23163C" />
      <path d="M46 88v18M80 62v20M114 90v16" stroke="#4EC270" strokeWidth="4" strokeLinecap="round" />
      <path d="M25 96c9-3 16-3 22 1M64 105c6-4 12-5 20-2M99 102c7-4 16-4 25 1" stroke="#4EC270" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function MonochromeArtwork() {
  return (
    <PreviewFrame>
      <g stroke="#7AB7FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="76" r="13" />
        <circle cx="50" cy="76" r="4" />
        <path d="M50 89v16M29 99c9-4 16-4 22 0" />
        <path d="m82 34 9 18 20 3-14 13 3 19-18-9-18 9 4-19-14-13 20-3 8-18Z" />
        <path d="M118 92c0-10 9-18 18-18 8 0 15 5 18 12-2 6-7 10-15 10h-21Z" />
      </g>
    </PreviewFrame>
  );
}

function FewColorsArtwork() {
  return (
    <PreviewFrame>
      <circle cx="52" cy="78" r="15" fill="#FF9A4D" />
      <circle cx="52" cy="78" r="5" fill="#10214D" />
      <path d="M52 93v17M32 103c7-4 15-4 21 0" stroke="#5BC76C" strokeWidth="4" strokeLinecap="round" />
      <path d="M88 34c9 5 16 13 20 24-8 8-17 13-28 15-7-8-9-18-7-29 5-5 10-8 15-10Z" fill="#F6D24A" stroke="#10214D" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="94" cy="49" r="7" fill="#AEEBE5" stroke="#10214D" strokeWidth="4" />
    </PreviewFrame>
  );
}

function IconArtwork() {
  return (
    <PreviewFrame>
      <circle cx="92" cy="50" r="24" fill="#FFD652" />
      <circle cx="102" cy="43" r="24" fill="#090611" />
      <path d="M46 88h66" stroke="#354269" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 70h8M118 63h8" stroke="#8ACFFF" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function IllustrationArtwork() {
  return (
    <PreviewFrame>
      <circle cx="92" cy="48" r="22" fill="#FFD652" />
      <circle cx="101" cy="40" r="22" fill="#090611" />
      <path d="m44 86 8 12M52 86l-8 12M118 74l7 10M126 74l-7 10" stroke="#FF8D65" strokeWidth="4" strokeLinecap="round" />
      <path d="M35 44h8M39 40v8M119 28h8M123 24v8" stroke="#9AD9FF" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M55 96c8-6 17-8 28-8 10 0 20 2 31 8" stroke="#4964AF" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function SceneArtwork() {
  return (
    <PreviewFrame>
      <rect x="0" y="88" width="160" height="36" fill="#13213D" />
      <path d="M0 95c22-14 40-15 59-5 18 10 34 8 48-4 14-12 31-13 53-3v41H0V95Z" fill="#214D86" />
      <circle cx="118" cy="28" r="18" fill="#FFD452" />
      <circle cx="125" cy="23" r="18" fill="#090611" />
      <path d="M38 88V57h19v31M61 88V49h21v39" stroke="#F2E8D5" strokeWidth="4" />
      <path d="M90 88c7-14 17-22 31-25 11 3 19 11 24 25" stroke="#6AD0FF" strokeWidth="4" strokeLinecap="round" />
      <path d="M98 77h26M106 69h10" stroke="#6AD0FF" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function NoTextArtwork() {
  return (
    <PreviewFrame>
      <path d="m52 87 24-43 24 43H52Z" fill="#8D83FF" stroke="#201739" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="76" cy="61" r="6" fill="#B4F2E0" stroke="#201739" strokeWidth="4" />
    </PreviewFrame>
  );
}

function OnlyTitleArtwork() {
  return (
    <PreviewFrame>
      <rect x="26" y="20" width="108" height="20" rx="10" fill="#241A3B" />
      <rect x="37" y="24" width="42" height="6" rx="3" fill="#D7C8FF" />
      <path d="m58 92 18-32 18 32H58Z" fill="#8D83FF" stroke="#201739" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="76" cy="74" r="5" fill="#B4F2E0" stroke="#201739" strokeWidth="4" />
    </PreviewFrame>
  );
}

function EmbeddedTextArtwork() {
  return (
    <PreviewFrame>
      <path d="M31 33h40v16H31zM90 30h36v16H90zM42 84h78v17H42z" fill="#2B2140" />
      <path d="m56 74 19-32 19 32H56Z" fill="#FFD85A" stroke="#201739" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="75" cy="57" r="5" fill="#B4F2E0" stroke="#201739" strokeWidth="4" />
      <path d="M39 41h24M98 38h20M55 92h54" stroke="#DCCEFF" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function CenteredObjectArtwork() {
  return (
    <PreviewFrame>
      <circle cx="80" cy="62" r="26" fill="#FFD452" />
      <circle cx="91" cy="54" r="26" fill="#090611" />
      <path d="M53 95h54" stroke="#485A96" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function RepeatingPatternArtwork() {
  return (
    <PreviewFrame>
      <g stroke="#FFD75A" strokeWidth="3.5" strokeLinecap="round">
        <path d="M33 31h10M38 26v10M80 31h10M85 26v10M127 31h10M132 26v10M33 80h10M38 75v10M80 80h10M85 75v10M127 80h10M132 75v10" />
      </g>
      <g fill="#8D83FF" stroke="#201739" strokeWidth="3">
        <circle cx="38" cy="54" r="10" />
        <circle cx="85" cy="54" r="10" />
        <circle cx="132" cy="54" r="10" />
      </g>
    </PreviewFrame>
  );
}

function FullSceneCompositionArtwork() {
  return (
    <PreviewFrame>
      <rect x="0" y="90" width="160" height="34" fill="#12223B" />
      <path d="M0 97c19-12 38-13 56-4 15 8 32 8 49-4 14-10 31-11 55-4v39H0V97Z" fill="#1F4C81" />
      <circle cx="122" cy="27" r="17" fill="#FFD452" />
      <circle cx="128" cy="23" r="17" fill="#090611" />
      <path d="M26 89c8-14 17-20 30-22 12 3 21 11 27 22" stroke="#E9E1D4" strokeWidth="4" strokeLinecap="round" />
      <path d="M47 89V54M38 64h18" stroke="#E9E1D4" strokeWidth="4" />
      <path d="M92 90h38M100 81h22" stroke="#68CFFF" strokeWidth="4" strokeLinecap="round" />
    </PreviewFrame>
  );
}

function GridObjectsArtwork() {
  return (
    <PreviewFrame>
      <path d="M80 18v88M20 62h120" stroke="#2B2142" strokeWidth="2" />
      <circle cx="50" cy="35" r="11" fill="#FFD652" />
      <circle cx="55" cy="31" r="11" fill="#090611" />
      <path d="m103 24 8 14 15 2-11 10 3 15-15-8-14 8 3-15-11-10 15-2 7-14Z" fill="#8B83FF" stroke="#201739" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="50" cy="88" r="12" fill="#FF8FA6" />
      <circle cx="50" cy="88" r="4" fill="#21173A" />
      <path d="m98 82 12-20 12 20h-24Z" fill="#7ED7FF" stroke="#201739" strokeWidth="3" strokeLinejoin="round" />
    </PreviewFrame>
  );
}

function PlaceholderArtwork() {
  return (
    <PreviewFrame>
      <path d="M34 84 60 58l18 16 20-22 28 32" stroke="#C8B8FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="41" r="7" fill="#D7CBFF" />
    </PreviewFrame>
  );
}

export function getOptionPreviewMeta(fieldKey, value) {
  return (
    PREVIEW_META[fieldKey]?.[value] || {
      title: '效果示意',
      description: '这里会显示该选项的大致视觉方向。',
    }
  );
}

export function OptionPreviewArtwork({ fieldKey, value }) {
  switch (`${fieldKey}:${value}`) {
    case 'style:flat':
      return <FlatArtwork />;
    case 'style:line_art':
      return <LineArtArtwork />;
    case 'style:engraving':
      return <EngravingArtwork />;
    case 'style:linocut':
      return <LinocutArtwork />;
    case 'style:silhouette':
      return <SilhouetteArtwork />;
    case 'style:isometric':
      return <IsometricArtwork />;
    case 'style:cartoon':
      return <CartoonArtwork />;
    case 'style:ghibli':
      return <GhibliArtwork />;
    case 'color_mode:full_color':
      return <FullColorArtwork />;
    case 'color_mode:monochrome':
      return <MonochromeArtwork />;
    case 'color_mode:few_colors':
      return <FewColorsArtwork />;
    case 'image_complexity:icon':
      return <IconArtwork />;
    case 'image_complexity:illustration':
      return <IllustrationArtwork />;
    case 'image_complexity:scene':
      return <SceneArtwork />;
    case 'text:':
      return <NoTextArtwork />;
    case 'text:only_title':
      return <OnlyTitleArtwork />;
    case 'text:embedded_text':
      return <EmbeddedTextArtwork />;
    case 'composition:centered_object':
      return <CenteredObjectArtwork />;
    case 'composition:repeating_pattern':
      return <RepeatingPatternArtwork />;
    case 'composition:full_scene':
      return <FullSceneCompositionArtwork />;
    case 'composition:objects_in_grid':
      return <GridObjectsArtwork />;
    default:
      return <PlaceholderArtwork />;
  }
}
