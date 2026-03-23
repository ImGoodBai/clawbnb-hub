# Changelog

[简体中文](CHANGELOG.zh_CN.md)

This project follows the [Keep a Changelog](https://keepachangelog.com/) format.

## [2026.3.23]

### Added

- local automated quality gate: `test:unit`, `test:smoke`, `test:gate`
- mock QR flow smoke tests and config-triggered reload tests
- architecture and FAQ docs for official-plugin relationship and isolation boundary
- default one-WeChat-one-agent binding with `userId -> agentId` mapping and dedicated-agent registration
- dedicated binding unit and smoke coverage for `agents.list` + `bindings` writes
- automatic safe chat-isolation setup

### Changed

- README wording now correctly states that the upstream plugin already has multi-account runtime foundations
- public docs now explain default one-WeChat-one-agent behavior and shared-agent fallback
- this release drops migration support for old shared-agent test data; reconnect old accounts if needed
- install docs now describe zero-config startup plus a full configuration reference
- roadmap now includes stronger isolation and commercial distribution as explicit tracks
