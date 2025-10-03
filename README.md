# logseq-mmarked-extension

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Logseq plugin that renders Markdown using [@mathcrowd/mmarked](https://github.com/mathedu4all/mmarked).

[中文](./README.zh.md)

![demo](./example.gif)

## Overview

This project provides a Logseq plugin that renders Markdown blocks using the MMarked library, ideal for educational contexts that require advanced markdown capabilities.

## Install

![install](./install.png)

## Usage

To insert a Markdown block, type `/` and select `MMarked Block`. This will create a renderer block with a notation block below it. Enter ABC Notation into the notation block, and the rendered notation will display above.

## About MMarked

MMarked is a Markdown renderer that supports customized syntax, designed specifically for mathematical visualization in educational contexts. Key features include:

- ✅ **Full CommonMark Syntax:** Comprehensive compatibility with CommonMark standards.
- 🔢 **Footnote Blocks:** Auto-numbered footnotes with easy-to-use reference links.
- 📘 **Theorem-like Blocks:** Dedicated blocks for mathematical theorems, lemmas, and examples with titles, auto-numbering, and reference links.
- 🖼️ **Image Resizing:** Simple syntax for customizable rendering of images and videos.
- 🔍 **Solution Toggle Blocks:** Solution blocks with toggle buttons for easy visibility control.
- 🧮 **TeX to SVG Conversion:** Converts TeX equations to high-quality SVGs.
- 🌗 **Dark/Light Theme Support:** Customizable themes for enhanced readability.
- ⚡ **Real-Time Preview:** Instant visual feedback while editing, allowing for faster adjustments.

For more details, see the [MMarked Product Page](https://lab.mathcrowd.cn/mmarked).

## 👥 About Mathcrowd

Mathcrowd is an innovative startup founded by experienced developers and educators, dedicated to transforming math education in China through cutting-edge technology. Our mission is to create an engaging online community for math enthusiasts and self-learners, with interactive and visualized learning content.

🌐 [MCLab Official Website](https://lab.mathcrowd.cn)

🌐 [Online Math Community](https://www.mathcrowd.cn)

💬 [Join Our Discord](https://discord.gg/6VMUVA5Yq2)

## 🛠️ Development & Contributing

Interested in contributing or developing this plugin? See our development guide:

**[→ CONTRIBUTING.md](CONTRIBUTING.md)** - Complete development workflow, coding standards, and contribution guidelines

## � Marketplace Updates

This plugin has already been accepted into the official Logseq Marketplace. New releases are picked up automatically when you publish a new tag (e.g. `v1.4.0`). No manual resubmission or separate manifest PR is required.

Workflow summary:
- Run `./scripts/release.sh <version>`
- GitHub Actions builds & publishes a release
- Marketplace auto-detects and updates the listing

If an update doesn't appear after some time, verify the GitHub Release exists and the tag matches the `package.json` version.

## �📞 Support

For questions or issues with this extension, please [open an issue](https://github.com/mathedu4all/mmarked-logseq-extension/issues) on our GitHub repository.

For inquiries specific to the @mathcrowd/mmarked library, please [open an issue](https://github.com/mathedu4all/mmarked/issues) on the MMarked GitHub repository.

---

**Note**: This plugin includes a bundled version of `@mathcrowd/mmarked` in `src/browser.umd.js` for Logseq compatibility.