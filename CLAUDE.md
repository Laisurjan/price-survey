# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

線上學習單系統：「說故事學行銷 × 實地詢價任務」。花蓮高商多元選修課使用，學生在全聯／農會超市實地訪價時用手機填寫。

## Architecture

純前端 SPA（無框架、無建置工具），搭配 Firebase Firestore 作為即時資料庫，部署於 GitHub Pages。

- `index.html` — 三個畫面（登入、學生填寫、老師後台）全在同一頁，以 `.screen.active` 切換
- `style.css` — 手機優先 RWD，breakpoint 600px
- `app.js` — 所有邏輯，使用 Firebase compat SDK（全域 `firebase` 物件）
- `firebase-config.js` — 設定檔，透過 `window.FIREBASE_CONFIG` 暴露給 app.js
- `firestore.rules` — Firestore 安全規則（目前為開放模式）

## Key Concepts

- **角色切換**：學生與老師共用同一頁面，靠 `currentRole` 狀態區分
- **學生 ID**：以 `${class}_${seat}_${name}` 作為 Firestore document ID
- **發布控制**：Firestore `settings/publish` 文件有 `group`（組內互看）和 `all`（全班互看）兩個布林欄位，學生端透過 `onSnapshot` 即時監聽
- **8 組制**：組別固定為第一～四組 + 東商第一～四組
- **老師密碼**：寫死在 `app.js` 的 `TEACHER_PASSWORD` 常數（預設 `teacher2025`）

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) 在 push master 時自動部署到 GitHub Pages。

本地開發直接用瀏覽器開 `index.html` 即可（需有效的 Firebase 設定）。

## Firestore Collections

- `responses/{studentId}` — 學生填寫資料（含 status: draft/submitted）
- `settings/publish` — 發布狀態（group: bool, all: bool）
