/**
 * MMarked Plugin for Logseq
 *
 * This plugin provides enhanced markdown rendering with MathJax support
 * using the @mathcrowd/mmarked library. It uses lazy loading to prevent
 * blocking Logseq's startup process.
 */

import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { v4 as uuid } from "uuid";
import "@logseq/libs";
import CryptoJS from "crypto-js";

/* ============================================================================
 * Type Definitions
 * ========================================================================= */

/**
 * Event structure for macro renderer callbacks
 */
interface RenderEvent {
  slot: string;
  payload: {
    arguments: string[];
    uuid: string;
  };
}

/**
 * Structured error type for better error handling
 */
type LogseqError = {
  message: string;
  stack?: string;
};

/**
 * Global type extensions for the marked library
 */
declare global {
  interface Window {
    marked?: {
      renderMarkdown: (text: string) => { parsed: string };
      tex2svg: (text: string) => string;
    };
  }
}

/* ============================================================================
 * Constants
 * ========================================================================= */

const PLUGIN_NAME = "mmarked";
const COMMAND_NAME = "MMarked Block";
const BLOCK_TEMPLATE = `#+BEGIN_SRC ${PLUGIN_NAME}\n\n#+END_SRC`;
const RENDERER_PREFIX = `:${PLUGIN_NAME}-preview_`;

/** Maximum number of cached rendered results to prevent memory issues */
const MAX_CACHE_SIZE = 100;

/** CSS for mathcrowd themes */
const MATHCROWD_CSS = {
  light: "https://cdn2.mathcrowd.cn/assets/styles/mathcrowd.css",
  dark: "https://cdn2.mathcrowd.cn/assets/styles/mathcrowd-dark.css",
} as const;

/**
 * MathJax SVG styling constants
 * These styles ensure proper rendering of mathematical formulas
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
 * Lazy Loading Module
 * ========================================================================= */

/**
 * State management for lazy loading the markdown library
 * The library is ~2.7MB and should only load when needed
 */
let markedLibraryLoaded = false;
let markedLibraryLoading = false;
const markedLibraryLoadCallbacks: Array<() => void> = [];

/**
 * Dynamically loads the markdown library on demand
 *
 * This function implements a singleton pattern with promise caching:
 * - If already loaded: returns immediately
 * - If loading in progress: queues callback to resolve when complete
 * - Otherwise: starts loading and manages callbacks
 *
 * @returns Promise that resolves when library is loaded
 * @throws Error if script fails to load
 */
const loadMarkedLibrary = (): Promise<void> => {
  // Already loaded - return immediately
  if (markedLibraryLoaded) {
    return Promise.resolve();
  }

  // Currently loading - queue this request
  if (markedLibraryLoading) {
    return new Promise((resolve) => {
      markedLibraryLoadCallbacks.push(resolve);
    });
  }

  // Start loading process
  markedLibraryLoading = true;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./browser.umd.js";
    script.async = true;

    script.onload = () => {
      markedLibraryLoaded = true;
      markedLibraryLoading = false;

      // Resolve this promise
      resolve();

      // Resolve all queued promises
      markedLibraryLoadCallbacks.forEach((cb) => cb());
      markedLibraryLoadCallbacks.length = 0;
    };

    script.onerror = () => {
      markedLibraryLoading = false;
      reject(new Error("Failed to load markdown library"));
    };

    document.head.appendChild(script);
  });
};

/* ============================================================================
 * Utility Functions
 * ========================================================================= */

/**
 * Generates MD5 hash for content caching
 *
 * @param content - Content to hash
 * @returns MD5 hash in hexadecimal format
 */
const generateMd5Hash = (content: string): string => {
  return CryptoJS.MD5(content).toString(CryptoJS.enc.Hex);
};

/**
 * Formats errors into a consistent structure
 *
 * @param error - Error object (any type)
 * @returns Structured error with message and optional stack
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
 * Creates a unique renderer template string
 *
 * @param uuid - Unique identifier for the renderer
 * @returns Renderer template string for Logseq
 */
const createRendererTemplate = (uuid: string): string =>
  `{{renderer ${RENDERER_PREFIX}${uuid}}}\n`;

/* ============================================================================
 * Logging
 * ========================================================================= */

/**
 * Centralized logging utility with consistent formatting
 */
const log = {
  /**
   * Logs debug information (only in development)
   */
  debug: (...args: unknown[]): void => {
    console.log("[MMarked Debug]", ...args);
  },

  /**
   * Logs errors with formatted output
   */
  error: (msg: string, error: unknown): void => {
    console.error("[MMarked Error]", msg, formatError(error));
  },
};

/* ============================================================================
 * Rendering Pipeline
 * ========================================================================= */

/**
 * Reusable DOMParser instance for better performance
 * Creating a new parser for each operation is expensive
 */
const domParser = new DOMParser();

/**
 * Cache for rendered content to avoid re-rendering
 * Key: MD5 hash of markdown content
 * Value: Rendered HTML string
 */
const renderCache = new Map<string, string>();

/**
 * Extracts markdown content from a Logseq source block
 *
 * @param content - Full block content including markers
 * @returns Extracted markdown content (trimmed)
 */
const extractMarkdownContent = (content: string): string => {
  log.debug("Extracting content from:", content);

  const pattern = new RegExp(
    `#\\+BEGIN_SRC ${PLUGIN_NAME}([\\s\\S]*?)#\\+END_SRC`,
    "gm"
  );
  const match = content.match(pattern);

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

/**
 * Cleans up MathJax SVG containers and applies styling
 *
 * This function:
 * 1. Finds all MathJax containers (mjx-container elements)
 * 2. Extracts SVG elements from containers
 * 3. Applies proper styling based on display mode (block/inline)
 * 4. Replaces containers with styled SVG elements
 *
 * @param html - HTML string containing MathJax containers
 * @returns Cleaned HTML with properly styled SVG elements
 */
const cleanupMathJaxSvg = (html: string): string => {
  const doc = domParser.parseFromString(html, "text/html");
  const containers = doc.querySelectorAll("mjx-container");

  containers.forEach((container) => {
    const svg = container.querySelector("svg");
    if (!svg) return;

    // Extract container attributes
    const display = container.getAttribute("display");
    const justify = container.getAttribute("justify");

    // Add plugin-specific class for styling
    svg.classList.add(`${PLUGIN_NAME}-math`);

    // Apply display mode styling
    if (display === "true") {
      // Block mode: centered with vertical spacing
      svg.style.display = "block";
      svg.style.margin = "1em auto";
    } else {
      // Inline mode: minimal spacing
      svg.style.display = "inline";
      svg.style.margin = "auto 0.25em";
    }

    // Apply text alignment if specified
    if (justify) {
      svg.style.textAlign = justify;
    }

    // Replace container with styled SVG
    container.parentNode?.replaceChild(svg, container);
  });

  return doc.body.innerHTML;
};

/**
 * Generates a stable hash for rendered content
 * Falls back to UUID if hashing fails
 *
 * @param content - Content to hash
 * @returns Hash string (MD5 or UUID)
 */
const generateHash = async (content: string): Promise<string> => {
  try {
    return generateMd5Hash(content);
  } catch (error) {
    log.error("Hash generation failed:", error);
    return uuid(); // Fallback to UUID if crypto fails
  }
};

/**
 * Resolves local image paths to Logseq-compatible paths
 *
 * This function processes all img tags in the HTML and converts relative paths
 * to absolute paths that Logseq can resolve. It handles:
 * - Relative paths (./image.png, ../assets/image.png)
 * - Asset paths (assets/image.png)
 * - Absolute local paths (/path/to/image.png)
 * - Leaves HTTP/HTTPS URLs unchanged
 *
 * @param html - HTML string containing img tags
 * @returns HTML with resolved image paths
 */
const resolveImagePaths = async (html: string): Promise<string> => {
  try {
    const doc = domParser.parseFromString(html, "text/html");
    const images = doc.querySelectorAll("img");

    if (images.length === 0) {
      return html;
    }

    // Get current graph path from Logseq
    const graphPath = await logseq.App.getCurrentGraph();
    if (!graphPath?.path) {
      log.debug("No graph path available, skipping image path resolution");
      return html;
    }

    const basePath = graphPath.path;

    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;

      // Skip if already an HTTP/HTTPS URL
      if (/^https?:\/\//i.test(src)) {
        return;
      }

      // Skip data URLs
      if (src.startsWith("data:")) {
        return;
      }

      let resolvedPath: string;

      // Handle different path formats
      if (src.startsWith("/")) {
        // Absolute path - use as is
        resolvedPath = `file://${src}`;
      } else if (src.startsWith("../assets/") || src.startsWith("assets/")) {
        // Logseq assets path
        const assetPath = src.replace(/^\.\.\//, "");
        resolvedPath = `file://${basePath}/${assetPath}`;
      } else if (src.startsWith("./")) {
        // Relative path from current location
        resolvedPath = `file://${basePath}/assets/${src.substring(2)}`;
      } else {
        // Assume it's in assets folder
        resolvedPath = `file://${basePath}/assets/${src}`;
      }

      img.setAttribute("src", resolvedPath);
      log.debug(`Resolved image path: ${src} -> ${resolvedPath}`);
    });

    return doc.body.innerHTML;
  } catch (error) {
    log.error("Image path resolution failed:", error);
    // Return original HTML if resolution fails
    return html;
  }
};

/**
 * Main rendering function with caching and lazy loading
 *
 * Rendering pipeline:
 * 1. Check if content is empty
 * 2. Check cache for previously rendered content
 * 3. Lazy load markdown library if not loaded
 * 4. Render markdown with MathJax support
 * 5. Clean up SVG elements
 * 6. Resolve local image paths
 * 7. Cache result (with size limit)
 * 8. Return rendered HTML
 *
 * @param markdown - Markdown content to render
 * @returns Promise resolving to rendered HTML
 */
const renderContent = async (markdown: string): Promise<string> => {
  try {
    log.debug("Rendering markdown:", markdown);

    // Handle empty content
    if (!markdown.trim()) {
      return '<div class="empty-content">Empty content</div>';
    }

    // Check cache first for performance
    const cacheKey = generateMd5Hash(markdown);
    if (renderCache.has(cacheKey)) {
      log.debug("Cache hit for markdown");
      return renderCache.get(cacheKey)!;
    }

    // Ensure library is loaded (lazy loading)
    await loadMarkedLibrary();

    if (!window.marked) {
      throw new Error("Markdown library not available");
    }

    // Render with MathJax support
    let result: string;
    try {
      const rendered = window.marked.renderMarkdown(markdown);
      log.debug("Markdown rendered:", rendered);

      const svgContent = window.marked.tex2svg(rendered.parsed);
      result = cleanupMathJaxSvg(svgContent);
    } catch (error) {
      log.error("tex2svg rendering failed:", error);

      // Fallback: basic markdown rendering without math
      const rendered = window.marked.renderMarkdown(markdown);
      result = rendered.parsed;
    }

    // Resolve local image paths to Logseq-compatible paths
    result = await resolveImagePaths(result);

    // Cache the result
    renderCache.set(cacheKey, result);

    // Implement LRU-style cache eviction to prevent memory issues
    if (renderCache.size > MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value;
      if (firstKey) {
        renderCache.delete(firstKey);
      }
    }

    return result;
  } catch (error) {
    log.error("Markdown rendering failed:", error);
    const { message } = formatError(error);
    return `<div class="render-error">Failed to render content: ${message}</div>`;
  }
};

/* ============================================================================
 * Theme Management
 * ========================================================================= */

/**
 * Updates theme-specific CSS when Logseq theme changes
 *
 * This function:
 * 1. Detects current theme (light/dark)
 * 2. Loads appropriate mathcrowd CSS
 * 3. Provides style to Logseq
 */
const handleThemeChange = async (): Promise<void> => {
  try {
    const theme = await logseq.App.getStateFromStore<"light" | "dark">(
      "ui/theme"
    );

    const mathcrowdCss =
      theme === "dark" ? MATHCROWD_CSS.dark : MATHCROWD_CSS.light;

    logseq.provideStyle(`@import url("${mathcrowdCss}");`);
    log.debug("Theme changed:", theme);
  } catch (error) {
    log.error("Theme detection failed:", error);
  }
};

/* ============================================================================
 * Plugin Commands & Handlers
 * ========================================================================= */

/**
 * Registers the slash command for creating MMarked blocks
 *
 * Creates two blocks:
 * 1. Renderer block: {{renderer :mmarked-preview_<uuid>}}
 * 2. Source block: #+BEGIN_SRC mmarked ... #+END_SRC
 */
const registerSlashCommand = async (): Promise<void> => {
  logseq.Editor.registerSlashCommand(COMMAND_NAME, async () => {
    const rendererUuid = uuid();
    const template = createRendererTemplate(rendererUuid);

    try {
      // Insert renderer template at cursor
      await logseq.Editor.insertAtEditingCursor(template);

      // Get current block for inserting child
      const currBlock = await logseq.Editor.getCurrentBlock();
      if (!currBlock) {
        throw new Error("No current block found");
      }

      // Insert source block as child
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

/**
 * Handles macro renderer events for MMarked blocks
 *
 * Processing flow:
 * 1. Validate renderer type
 * 2. Fetch render block and its children
 * 3. Extract markdown from source block
 * 4. Render markdown to HTML
 * 5. Provide UI with rendered content
 * 6. Handle errors gracefully
 *
 * @param event - Render event from Logseq
 */
const handleMacroRenderer = async ({
  slot,
  payload,
}: RenderEvent): Promise<void> => {
  const [type] = payload.arguments;

  // Only handle our renderer types
  if (!type.startsWith(RENDERER_PREFIX)) return;

  try {
    log.debug("Handling macro renderer:", { slot, type });

    // Fetch the renderer block with its children
    const renderBlockId = payload.uuid;
    const renderBlock = await logseq.Editor.getBlock(renderBlockId, {
      includeChildren: true,
    });

    log.debug("Render block:", renderBlock);

    // Validate block structure
    if (!renderBlock?.children?.[0]) {
      throw new Error("No content block found");
    }

    // Fetch the source block containing markdown
    const dataBlockId = (renderBlock.children[0] as BlockEntity).uuid;
    const dataBlock = await logseq.Editor.getBlock(dataBlockId);

    log.debug("Data block:", dataBlock);

    if (!dataBlock?.content) {
      throw new Error("No content found in data block");
    }

    // Extract and render markdown
    const markdown = extractMarkdownContent(dataBlock.content);
    log.debug("Extracted markdown:", markdown);

    const html = await renderContent(markdown);
    log.debug("Rendered HTML:", html);

    // Generate stable hash for UI key
    const hash = await generateHash(html);
    const layout = domParser.parseFromString(html, "text/html");

    // Provide rendered UI to Logseq
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

    // Update block to trigger re-render if needed
    if (renderBlock.content) {
      await logseq.Editor.updateBlock(renderBlockId, renderBlock.content);
    }
  } catch (error) {
    log.error("Macro renderer failed:", error);
    const { message } = formatError(error);
    logseq.UI.showMsg(`Rendering failed: ${message}`, "error");

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

/* ============================================================================
 * Plugin Initialization
 * ========================================================================= */

/**
 * Main plugin initialization function
 *
 * Initialization steps:
 * 1. Provide static CSS styles (MathJax + plugin styles)
 * 2. Load theme-specific CSS
 * 3. Register slash command
 * 4. Register event handlers
 * 5. Show success message
 */
async function main(): Promise<void> {
  try {
    // Provide all static styles at once
    logseq.provideStyle(`
      ${MATHJAX_STYLES}
      .${PLUGIN_NAME} {
        white-space: normal;
        min-width: 600px;
        max-width: 100%;
      }
    `);

    // Initialize theme
    await handleThemeChange();

    // Register commands
    await registerSlashCommand();

    // Register event handlers
    logseq.App.onMacroRendererSlotted(handleMacroRenderer);
    logseq.App.onThemeModeChanged(handleThemeChange);

    // Notify user of successful initialization
    logseq.UI.showMsg(`${PLUGIN_NAME} plugin initialized`);
  } catch (error) {
    log.error("Plugin initialization failed:", error);
    const { message } = formatError(error);
    logseq.UI.showMsg(`Plugin initialization failed: ${message}`, "error");
  }
}

/* ============================================================================
 * Bootstrap
 * ========================================================================= */

/**
 * Plugin bootstrap - entry point
 * Waits for Logseq to be ready before initializing
 */
logseq.ready(main).catch((error) => {
  console.error("Plugin bootstrap failed:", formatError(error));
});
