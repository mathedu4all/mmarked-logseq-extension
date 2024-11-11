import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { renderMarkdown, tex2svg } from "marked";
import { v4 as uuid } from "uuid";
import "@logseq/libs";
import CryptoJS from "crypto-js";

const generateMd5Hash = (content: string) => {
  return CryptoJS.MD5(content).toString(CryptoJS.enc.Hex);
};

// Types
interface RenderEvent {
  slot: string;
  payload: {
    arguments: string[];
    uuid: string;
  };
}

type LogseqError = {
  message: string;
  stack?: string;
};

// Constants
const PLUGIN_NAME = "mmarked";
const COMMAND_NAME = "MMarked Block";
const BLOCK_TEMPLATE = `#+BEGIN_SRC ${PLUGIN_NAME}\n\n#+END_SRC`;
const RENDERER_PREFIX = `:${PLUGIN_NAME}-preview_`;

// 将 MathJax 相关的 CSS 样式定义为常量
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

// 主题变更时只更新主题相关的样式
const handleThemeChange = async () => {
  try {
    const theme = await logseq.App.getStateFromStore<"light" | "dark">(
      "ui/theme"
    );
    const mathcrowdCss =
      theme === "dark"
        ? "https://cdn2.mathcrowd.cn/assets/styles/mathcrowd-dark.css"
        : "https://cdn2.mathcrowd.cn/assets/styles/mathcrowd.css";

    // 只更新主题相关的样式
    logseq.provideStyle(`@import url("${mathcrowdCss}");`);
    log.debug("Theme changed:", theme);
  } catch (error) {
    log.error("Theme detection failed:", error);
  }
};

// Error handling utilities
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

// Debug logger
const log = {
  debug: (...args: any[]) => console.log("[MMarked Debug]", ...args),
  error: (msg: string, error: unknown) =>
    console.error("[MMarked Error]", msg, formatError(error)),
};

const cleanupMathJaxSvg = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const containers = doc.querySelectorAll("mjx-container");

  containers.forEach((container) => {
    const svg = container.querySelector("svg");
    if (svg) {
      // Copy relevant attributes from container to SVG
      const display = container.getAttribute("display");
      const justify = container.getAttribute("justify");

      // Add our plugin's class to the SVG
      svg.classList.add(`${PLUGIN_NAME}-math`);

      if (display === "true") {
        svg.style.display = "block";
        svg.style.margin = "1em auto";
      }else{
        svg.style.display = "inline";
        svg.style.margin = "auto 0.25em";
      }

      if (justify) {
        svg.style.textAlign = justify;
      }

      // Replace container with modified SVG
      container.parentNode?.replaceChild(svg, container);
    }
  });

  return doc.body.innerHTML;
};

// Utility functions
const createRendererTemplate = (uuid: string) =>
  `{{renderer ${RENDERER_PREFIX}${uuid}}}\n`;

const extractMarkdownContent = (content: string): string => {
  log.debug("Extracting content from:", content);

  const match = content.match(
    new RegExp(`#\\+BEGIN_SRC ${PLUGIN_NAME}([\\s\\S]*?)#\\+END_SRC`, "gm")
  );
  if (!match?.[0]) {
    log.debug("No content match found");
    return "";
  }

  const extracted = match[0]
    .replace(`#+BEGIN_SRC ${PLUGIN_NAME}`, "")
    .replace("#+END_SRC", "")
    .trim();

  log.debug("Extracted content:", extracted);
  return extracted;
};

const generateHash = async (content: string): Promise<string> => {
  try {
    return generateMd5Hash(content);
  } catch (error) {
    log.error("Hash generation failed:", error);
    return uuid(); // Fallback to uuid if crypto fails
  }
};

const renderContent = (markdown: string): string => {
  try {
    log.debug("Rendering markdown:", markdown);

    if (!markdown.trim()) {
      return '<div class="empty-content">Empty content</div>';
    }

    // First try rendering with tex2svg
    try {
      const rendered = renderMarkdown(markdown);
      log.debug("Markdown rendered:", rendered);
      const svgContent = tex2svg(rendered.parsed);
      return cleanupMathJaxSvg(svgContent);
    } catch (error) {
      log.error("tex2svg rendering failed:", error);
      // Fallback to basic markdown rendering
      const rendered = renderMarkdown(markdown);
      return rendered.parsed;
    }
  } catch (error) {
    log.error("Markdown rendering failed:", error);
    const { message } = formatError(error);
    return `<div class="render-error">Failed to render content: ${message}</div>`;
  }
};

// Main plugin functions
const registerSlashCommand = async () => {
  logseq.Editor.registerSlashCommand(COMMAND_NAME, async () => {
    const rendererUuid = uuid();
    const template = createRendererTemplate(rendererUuid);

    try {
      await logseq.Editor.insertAtEditingCursor(template);

      const currBlock = await logseq.Editor.getCurrentBlock();
      if (!currBlock) throw new Error("No current block found");

      await logseq.Editor.insertBlock(currBlock.uuid, BLOCK_TEMPLATE, {
        sibling: false,
        before: false,
      });
    } catch (error) {
      log.error("Slash command failed:", error);
      logseq.App.showMsg("Failed to create MMarked block", "error");
    }
  });
};

const handleMacroRenderer = async ({ slot, payload }: RenderEvent) => {
  const [type] = payload.arguments;

  if (!type.startsWith(RENDERER_PREFIX)) return;

  try {
    log.debug("Handling macro renderer:", { slot, type });

    const renderBlockId = payload.uuid;
    const renderBlock = await logseq.Editor.getBlock(renderBlockId, {
      includeChildren: true,
    });

    log.debug("Render block:", renderBlock);

    if (!renderBlock?.children?.[0]) {
      throw new Error("No content block found");
    }

    const dataBlockId = (renderBlock.children[0] as BlockEntity).uuid;
    const dataBlock = await logseq.Editor.getBlock(dataBlockId);

    log.debug("Data block:", dataBlock);

    if (!dataBlock?.content) {
      throw new Error("No content found in data block");
    }

    const markdown = extractMarkdownContent(dataBlock.content);
    log.debug("Extracted markdown:", markdown);

    const html = renderContent(markdown);
    const parser = new DOMParser();

    log.debug("Rendered HTML:", html);

    const hash = await generateHash(html);
    const layout = parser.parseFromString(html, "text/html");

    // Provide UI with rendered content
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

    // Update the block content
    if (renderBlock.content) {
      await logseq.Editor.updateBlock(renderBlockId, renderBlock.content);
    }
  } catch (error) {
    log.error("Macro renderer failed:", error);
    const { message } = formatError(error);
    logseq.App.showMsg(`Rendering failed: ${message}`, "error");

    // Provide error UI
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

// Main plugin initialization
async function main() {
  try {
    // 在插件初始化时一次性提供所有需要的样式
    logseq.provideStyle(`
          ${MATHJAX_STYLES}
          .${PLUGIN_NAME} {
            white-space: normal;
            min-width: 600px;
            max-width: 100%;
          }
        `);

    await handleThemeChange();
    await registerSlashCommand();

    logseq.App.onMacroRendererSlotted(handleMacroRenderer);
    logseq.App.onThemeModeChanged(handleThemeChange);

    logseq.App.showMsg(`${PLUGIN_NAME} plugin initialized`);
  } catch (error) {
    log.error("Plugin initialization failed:", error);
    const { message } = formatError(error);
    logseq.App.showMsg(`Plugin initialization failed: ${message}`, "error");
  }
}

logseq.ready(main).catch((error) => {
  console.error("Plugin bootstrap failed:", formatError(error));
});
