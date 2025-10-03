## [1.4.1](https://cloud.mathcrowd.cn/agile/frontend/mmarked-logseq-extension/compare/v1.4.0...v1.4.1) (2025-10-03)


### Bug Fixes

* **ci:** resolve YAML alias parsing error in .gitlab-ci.yml ([941f6a5](https://cloud.mathcrowd.cn/agile/frontend/mmarked-logseq-extension/commits/941f6a59e56d878bb447997a1f50ee82ab23a043))



# [1.4.0](https://cloud.mathcrowd.cn/agile/frontend/mmarked-logseq-extension/compare/v1.3.2...v1.4.0) (2025-10-03)



# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No changes yet._

## [1.4.0] - 2025-10-03

### Added
- ESLint and Prettier for code quality and formatting
- **CONTRIBUTING.md**: Complete developer guide with workflow, testing, and release process
- **Pull Request template** for standardized contributions
- Automated scripts: `release.sh`, `commit-all.sh`
- Render caching mechanism for better performance (LRU cache, max 100 entries)
- `.gitattributes` to optimize handling of large bundled files
- Development scripts: `lint`, `lint:fix`, `format`, `format:check`

### Changed
- **BREAKING**: Upgraded `@logseq/libs` from `0.0.15` to `0.2.1` (fixes critical security vulnerabilities)
- **BREAKING**: Upgraded TypeScript from `4.x` to `5.x`
- **BREAKING**: Upgraded Rollup from `2.x` to `4.x`
- Updated all Rollup plugins to latest versions
- Replaced deprecated `logseq.App.showMsg` with `logseq.UI.showMsg`
- Restructured documentation: README for users, CONTRIBUTING for developers
- Improved code formatting and style consistency
- Changed `any[]` type to `unknown[]` in logger for better type safety

### Fixed
- Removed duplicate `external` configuration in `rollup.config.js`
- Fixed non-existent file references in `tsconfig.json`
- Fixed code formatting issues (else statement spacing)
- Fixed 4 security vulnerabilities (2 critical, 1 high, 1 low)

### Performance
- Extracted DOMParser as a singleton to avoid repeated instantiation
- Implemented MD5-based content caching to prevent redundant rendering
- Cache size limit (100 entries) to prevent memory bloat

### Removed
- Removed deprecated `rollup-plugin-terser` (now using Rollup 4 built-in minification)
- Removed incompatible `rollup-plugin-css-only` and `rollup-plugin-peer-deps-external`
- (Post-publish cleanup) Removed marketplace submission helper docs & script after initial acceptance

## [1.3.0] - 2025-01-28

### Added
- Initial public release
- Basic MMarked rendering functionality
- Theme switching support (dark/light)
- TeX to SVG conversion
- MathJax SVG cleanup and styling

### Features
- Full CommonMark syntax support
- Footnote blocks
- Theorem-like blocks
- Image resizing
- Solution toggle blocks
- Real-time preview

[Unreleased]: https://github.com/mathedu4all/mmarked-logseq-extension/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/mathedu4all/mmarked-logseq-extension/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/mathedu4all/mmarked-logseq-extension/releases/tag/v1.3.0
