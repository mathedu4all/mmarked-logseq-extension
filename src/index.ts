/**
 * MMarked Plugin for Logseq
 *
 * 基于 @mathcrowd/mmarked 的 Markdown 渲染插件，支持 MathJax 数学公式渲染
 *
 */

import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { v4 as uuid } from "uuid";
import "@logseq/libs";
import CryptoJS from "crypto-js";

// 动态加载 mmarked，避免阻塞插件启动
let mmarkedModule: typeof import("@mathcrowd/mmarked") | null = null;
const loadMmarked = async () => {
  if (!mmarkedModule) {
    console.log("[MMarked] Waiting for mmarked library to load...");
    // @ts-expect-error - 运行时从全局变量加载
    await window.mmarkedLoaded;

    // @ts-expect-error - 运行时从全局变量加载
    mmarkedModule = window.marked;
    if (!mmarkedModule) {
      console.error("[MMarked] Failed to load: window.marked is undefined");
      throw new Error("mmarked library not loaded");
    }
    console.log(
      "[MMarked] Library loaded successfully:",
      Object.keys(mmarkedModule)
    );
  }
  return mmarkedModule;
};

/* ============================================================================
 * 类型定义 (Type Definitions)
 * ========================================================================= */

/**
 * 渲染事件接口
 * Logseq 宏渲染器回调时传递的事件对象
 */
interface RenderEvent {
  /** UI 插槽 ID */
  slot: string;
  /** 事件负载 */
  payload: {
    /** 渲染器参数列表 */
    arguments: string[];
    /** 块的 UUID */
    uuid: string;
  };
}

/**
 * 错误对象类型
 * 用于统一的错误处理
 */
type LogseqError = {
  /** 错误消息 */
  message: string;
  /** 错误堆栈（可选） */
  stack?: string;
};

/* ============================================================================
 * 常量定义 (Constants)
 * ========================================================================= */

/** 插件名称 */
const PLUGIN_NAME = "mmarked";

/** 斜杠命令名称 */
const COMMAND_NAME = "MMarked Block";

/** 代码块模板 */
const BLOCK_TEMPLATE = `#+BEGIN_SRC ${PLUGIN_NAME}\n\n#+END_SRC`;

/** 渲染器前缀 */
const RENDERER_PREFIX = `:${PLUGIN_NAME}-preview_`;

/** MathCrowd 主题 CSS 链接 */
const MATHCROWD_CSS = {
  light: "https://cdn2.mathcrowd.cn/assets/styles/mathcrowd.css",
  dark: "https://cdn2.mathcrowd.cn/assets/styles/mathcrowd-dark.css",
} as const;

/**
 * MathJax SVG 样式
 * 确保数学公式的正确渲染和显示
 */
const MATHJAX_STYLES = `
.${PLUGIN_NAME}-math svg {
  direction: ltr;
  min-height: 1px;
  min-width: 1px;
  overflow: visible;
}
.${PLUGIN_NAME}-math svg a {
  fill: blue;
  stroke: blue;
}
.${PLUGIN_NAME}-math g[data-mml-node="merror"] > g {
  fill: red;
  stroke: red;
}
.${PLUGIN_NAME}-math g[data-mml-node="merror"] > rect[data-background] {
  fill: yellow;
  stroke: none;
}
.${PLUGIN_NAME}-math g[data-mml-node="mtable"] line[data-line],
.${PLUGIN_NAME}-math g[data-mml-node="mtable"] rect[data-frame] {
  stroke-width: 70px;
  fill: none;
}
.${PLUGIN_NAME}-math .mjx-dashed {
  stroke-dasharray: 140;
}
.${PLUGIN_NAME}-math .mjx-dotted {
  stroke-linecap: round;
  stroke-dasharray: 0, 140;
}
.${PLUGIN_NAME}-math foreignObject[data-mjx-xml] {
  font-family: initial;
  line-height: normal;
  overflow: visible;
}
.${PLUGIN_NAME}-math path[data-c],
.${PLUGIN_NAME}-math use[data-c] {
  stroke-width: 3;
}`;

/* ============================================================================
 * 工具函数 (Utility Functions)
 * ========================================================================= */

/**
 * 生成 MD5 哈希
 *
 * @param content - 要哈希的内容
 * @returns 十六进制格式的 MD5 哈希值
 */
const generateMd5Hash = (content: string): string => {
  return CryptoJS.MD5(content).toString(CryptoJS.enc.Hex);
};

/**
 * 格式化错误对象
 * 统一处理各种类型的错误
 *
 * @param error - 任意类型的错误对象
 * @returns 标准化的错误对象
 */
const formatError = (error: unknown): LogseqError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
  };
};

/**
 * 创建渲染器模板字符串
 *
 * @param uuid - 唯一标识符
 * @returns Logseq 渲染器模板字符串
 */
const createRendererTemplate = (uuid: string): string =>
  `{{renderer ${RENDERER_PREFIX}${uuid}}}\n`;

/**
 * 生成内容哈希
 * 用于生成稳定的 UI key，支持缓存
 *
 * @param content - 要哈希的内容
 * @returns MD5 哈希值或 UUID（失败时的备用方案）
 */
const generateHash = async (content: string): Promise<string> => {
  try {
    return generateMd5Hash(content);
  } catch (error) {
    log.error("Hash generation failed:", error);
    return uuid(); // 哈希失败时使用 UUID 作为后备
  }
};

/* ============================================================================
 * 日志工具 (Logging Utilities)
 * ========================================================================= */

/**
 * 统一的日志工具
 * 提供调试和错误日志功能
 */
const log = {
  /**
   * 输出调试信息
   * @param args - 要记录的参数列表
   */
  debug: (...args: unknown[]): void => {
    console.log("[MMarked Debug]", ...args);
  },

  /**
   * 输出错误信息
   * @param msg - 错误描述
   * @param error - 错误对象
   */
  error: (msg: string, error: unknown): void => {
    console.error("[MMarked Error]", msg, formatError(error));
  },
};

/* ============================================================================
 * Markdown 内容处理 (Content Processing)
 * ========================================================================= */

/**
 * 从 Logseq 源码块中提取 Markdown 内容
 *
 * @param content - 包含标记的完整块内容
 * @returns 提取并修剪后的 Markdown 内容
 */
const extractMarkdownContent = (content: string): string => {
  log.debug("Extracting content from:", content);

  // 匹配 #+BEGIN_SRC mmarked ... #+END_SRC 之间的内容
  const pattern = new RegExp(
    `#\\+BEGIN_SRC ${PLUGIN_NAME}([\\s\\S]*?)#\\+END_SRC`,
    "gm"
  );
  const match = content.match(pattern);

  if (!match?.[0]) {
    log.debug("No content match found");
    return "";
  }

  // 移除块标记，保留纯 Markdown 内容
  const extracted = match[0]
    .replace(`#+BEGIN_SRC ${PLUGIN_NAME}`, "")
    .replace("#+END_SRC", "")
    .trim();

  log.debug("Extracted content:", extracted);
  return extracted;
};

/* ============================================================================
 * MathJax SVG 处理 (MathJax Processing)
 * ========================================================================= */

/**
 * 清理和美化 MathJax SVG 容器
 *
 * 处理流程：
 * 1. 查找所有 mjx-container 元素
 * 2. 提取 SVG 元素并应用样式
 * 3. 根据显示模式（块级/行内）设置样式
 * 4. 替换原容器
 *
 * @param html - 包含 MathJax 容器的 HTML 字符串
 * @returns 清理后的 HTML 字符串
 */
const cleanupMathJaxSvg = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const containers = doc.querySelectorAll("mjx-container");

  containers.forEach((container) => {
    const svg = container.querySelector("svg");
    if (!svg) return;

    // 获取容器属性
    const display = container.getAttribute("display");
    const justify = container.getAttribute("justify");

    // 添加插件特定的 CSS 类
    svg.classList.add(`${PLUGIN_NAME}-math`);

    // 根据显示模式设置样式
    if (display === "true") {
      // 块级模式：居中显示，带垂直间距
      svg.style.display = "block";
      svg.style.margin = "1em auto";
    } else {
      // 行内模式：最小间距
      svg.style.display = "inline";
      svg.style.margin = "auto 0.25em";
    }

    // 应用文本对齐方式
    if (justify) {
      svg.style.textAlign = justify;
    }

    // 用处理后的 SVG 替换容器
    container.parentNode?.replaceChild(svg, container);
  });

  return doc.body.innerHTML;
};

/* ============================================================================
 * Markdown 渲染 (Markdown Rendering)
 * ========================================================================= */

/**
 * 渲染 Markdown 内容为 HTML
 *
 * 渲染流程：
 * 1. 检查内容是否为空
 * 2. 动态加载 mmarked 库
 * 3. 使用 renderMarkdown 转换 Markdown
 * 4. 使用 tex2svg 处理数学公式
 * 5. 清理 MathJax SVG 容器
 * 6. 错误处理和降级方案
 *
 * @param markdown - 要渲染的 Markdown 内容
 * @returns 渲染后的 HTML 字符串
 */
const renderContent = async (markdown: string): Promise<string> => {
  try {
    log.debug("Rendering markdown:", markdown);

    // 处理空内容
    if (!markdown.trim()) {
      return '<div class="empty-content">Empty content</div>';
    }

    // 加载 mmarked 库
    const { renderMarkdown, tex2svg } = await loadMmarked();

    // 尝试完整渲染（包含数学公式）
    try {
      const rendered = renderMarkdown(markdown);
      log.debug("Markdown rendered:", rendered);

      const svgContent = tex2svg(rendered.parsed);
      return cleanupMathJaxSvg(svgContent);
    } catch (error) {
      log.error("tex2svg rendering failed:", error);

      // 降级方案：仅渲染基础 Markdown（不含数学公式）
      const rendered = renderMarkdown(markdown);
      return rendered.parsed;
    }
  } catch (error) {
    log.error("Markdown rendering failed:", error);
    const { message } = formatError(error);
    return `<div class="render-error">Failed to render content: ${message}</div>`;
  }
};

/* ============================================================================
 * 主题管理 (Theme Management)
 * ========================================================================= */

/**
 * 处理主题变更
 * 根据 Logseq 当前主题加载对应的 MathCrowd CSS
 */
const handleThemeChange = async (): Promise<void> => {
  try {
    // 获取当前主题
    const theme = await logseq.App.getStateFromStore<"light" | "dark">(
      "ui/theme"
    );

    // 选择对应的主题 CSS
    const mathcrowdCss =
      theme === "dark" ? MATHCROWD_CSS.dark : MATHCROWD_CSS.light;

    // 应用主题样式
    logseq.provideStyle(`@import url("${mathcrowdCss}");`);
    log.debug("Theme changed:", theme);
  } catch (error) {
    log.error("Theme detection failed:", error);
  }
};

/* ============================================================================
 * 斜杠命令 (Slash Command)
 * ========================================================================= */

/**
 * 注册斜杠命令
 * 在 Logseq 中输入 /MMarked Block 时创建渲染器块和源码块
 *
 * 块结构：
 * - 父块：{{renderer :mmarked-preview_<uuid>}}
 * - 子块：#+BEGIN_SRC mmarked ... #+END_SRC
 */
const registerSlashCommand = async (): Promise<void> => {
  logseq.Editor.registerSlashCommand(COMMAND_NAME, async () => {
    const rendererUuid = uuid();
    const template = createRendererTemplate(rendererUuid);

    try {
      // 在光标位置插入渲染器模板
      await logseq.Editor.insertAtEditingCursor(template);

      // 获取当前块
      const currBlock = await logseq.Editor.getCurrentBlock();
      if (!currBlock) {
        throw new Error("No current block found");
      }

      // 插入源码块作为子块
      await logseq.Editor.insertBlock(currBlock.uuid, BLOCK_TEMPLATE, {
        sibling: false,
        before: false,
      });
    } catch (error) {
      log.error("Slash command failed:", error);
      logseq.UI.showMsg("Failed to create MMarked block", "error");
    }
  });
};

/* ============================================================================
 * 宏渲染器 (Macro Renderer)
 * ========================================================================= */

/**
 * 处理宏渲染器事件
 *
 * 处理流程：
 * 1. 验证渲染器类型
 * 2. 获取渲染块及其子块
 * 3. 提取 Markdown 内容
 * 4. 渲染为 HTML
 * 5. 提供 UI 显示
 * 6. 错误处理
 *
 * @param event - 来自 Logseq 的渲染事件
 */
const handleMacroRenderer = async ({
  slot,
  payload,
}: RenderEvent): Promise<void> => {
  const [type] = payload.arguments;

  // 只处理本插件的渲染器
  if (!type.startsWith(RENDERER_PREFIX)) return;

  try {
    log.debug("Handling macro renderer:", { slot, type });

    // 获取渲染块（包含子块）
    const renderBlockId = payload.uuid;
    const renderBlock = await logseq.Editor.getBlock(renderBlockId, {
      includeChildren: true,
    });

    log.debug("Render block:", renderBlock);

    // 验证块结构
    if (!renderBlock?.children?.[0]) {
      throw new Error("No content block found");
    }

    // 获取包含 Markdown 的源码块
    const dataBlockId = (renderBlock.children[0] as BlockEntity).uuid;
    const dataBlock = await logseq.Editor.getBlock(dataBlockId);

    log.debug("Data block:", dataBlock);

    if (!dataBlock?.content) {
      throw new Error("No content found in data block");
    }

    // 提取并渲染 Markdown
    const markdown = extractMarkdownContent(dataBlock.content);
    log.debug("Extracted markdown:", markdown);

    const html = await renderContent(markdown);
    log.debug("Rendered HTML:", html);

    // 生成稳定的 UI key
    const hash = await generateHash(html);
    const parser = new DOMParser();
    const layout = parser.parseFromString(html, "text/html");

    // 提供渲染后的 UI
    logseq.provideUI({
      key: `${PLUGIN_NAME}-preview_${hash}`,
      slot,
      reset: true,
      template: `
        <div class="${PLUGIN_NAME}">
          ${layout.body.innerHTML}
        </div>
      `,
    });
  } catch (error) {
    log.error("Macro renderer failed:", error);
    const { message } = formatError(error);
    logseq.UI.showMsg(`Rendering failed: ${message}`, "error");

    // 提供错误 UI
    logseq.provideUI({
      key: `${PLUGIN_NAME}-error_${uuid()}`,
      slot,
      reset: true,
      template: `
        <div class="${PLUGIN_NAME}-error">
          <p>Failed to render content</p>
          <pre>${message}</pre>
        </div>
      `,
    });
  }
};

/* ============================================================================
 * 插件初始化 (Plugin Initialization)
 * ========================================================================= */

/**
 * 主初始化函数
 *
 * 初始化步骤：
 * 1. 提供静态 CSS 样式
 * 2. 初始化主题
 * 3. 注册斜杠命令
 * 4. 注册事件处理器
 * 5. 显示初始化成功消息
 */
async function main(): Promise<void> {
  try {
    console.log("[MMarked] Plugin initialization started...");

    // 提供所有静态样式
    console.log("[MMarked] Providing styles...");
    logseq.provideStyle(`
      ${MATHJAX_STYLES}
      .${PLUGIN_NAME} {
        white-space: normal;
        min-width: 600px;
        max-width: 100%;
      }
    `);

    // 初始化主题
    console.log("[MMarked] Initializing theme...");
    await handleThemeChange();

    // 注册命令
    console.log("[MMarked] Registering slash command...");
    await registerSlashCommand();

    // 注册事件处理器
    console.log("[MMarked] Registering event handlers...");
    logseq.App.onMacroRendererSlotted(handleMacroRenderer);
    logseq.App.onThemeModeChanged(handleThemeChange);

    // 通知用户初始化成功
    console.log("[MMarked] Plugin initialized successfully");
    logseq.UI.showMsg(`${PLUGIN_NAME} plugin initialized`);
  } catch (error) {
    console.error("[MMarked] Initialization failed:", error);
    log.error("Plugin initialization failed:", error);
    const { message } = formatError(error);
    logseq.UI.showMsg(`Plugin initialization failed: ${message}`, "error");
  }
}

/* ============================================================================
 * 启动入口 (Bootstrap)
 * ========================================================================= */

/**
 * 插件启动入口
 * 等待 Logseq 准备就绪后执行主初始化函数
 */
console.log("[MMarked] Waiting for Logseq to be ready...");
logseq.ready(main).catch((error) => {
  console.error("[MMarked] Bootstrap failed:", formatError(error));
});
