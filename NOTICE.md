# 来源与版权说明

本项目是非官方粉丝攻略工具，与 S-GAME（灵游坊）及 PlayStation 无关。《影之刃零 / Phantom Blade Zero》的游戏名称、角色、地图、截图、图标等素材版权归 S-GAME 及其权利人所有。

**应用界面不包含任何攻略外链**；本文件仅用于注明数据与素材来源，以及满足第三方许可的署名要求。

## 代码

源代码采用 MIT License，详见 `LICENSE`。MIT 仅适用于代码，不覆盖游戏素材、攻略文本、地图瓦片与截图。

## 攻略数据

- **游民星空（Gamersky）**：全收集列表、全支线、全 BOSS、成就表、区域全收集与互动地图。物品名称、任务名称、成就名称与部分提示整理自这些页面；原始文章与截图版权归游民星空及原作者。
  - gamersky.com/handbook/202611/2240895.shtml
  - gamersky.com/handbook/202610/2236093.shtml
  - gamersky.com/handbook/202610/2235534.shtml
  - gamersky.com/tools/guide-map/roadbooks/53

- **keyw007/pbz-guide**：612 条中文点位、提示、BOSS 与支线资料；该仓库未声明许可证，本项目按事实性数据引用并注明来源，仅用于非商业的个人攻略工具。
  - github.com/keyw007/pbz-guide

- **MapleEve/pbz-map**：本地地图瓦片、点位图标与实景截图；原始项目内容采用 CC BY-NC 4.0，该许可证不覆盖第三方游戏地图/截图/商标，相关权利仍归原方。本项目不把地图瓦片和截图提交到仓库；`public/map/` 已被 `.gitignore` 排除，需运行 `scripts/fetch-map-assets.ps1` 在本地获取。
  - github.com/MapleEve/pbz-map

## 依赖

- React / Vite / TypeScript：MIT
- Leaflet：BSD-2-Clause，许可文本见 `licenses/leaflet.txt`
- psn-api：MIT
- Vercel AI SDK / `@ai-sdk/deepseek`：Apache-2.0

## AI 助手与数据

AI 助手是可选功能。启用后，服务端会把当前进度摘要、当前区域和相关攻略片段发送给 DeepSeek API；不会发送 NPSSO、PSN 账号标识、地图截图或完整进度文件。API Key 经 Windows 账户级加密保存在本机 `data/assistant-key.enc`，不进入浏览器或仓库。是否启用、使用哪个模型由使用者自行决定。

## 使用范围

本项目面向个人、非商业用途。若你 fork 或公开部署，请保留以上署名，并自行确认所用素材在你的司法辖区内的使用范围。不要将 `data/npsso.enc`、`data/progress.json`、`data/assistant-key.enc` 或任何 PSN/API 账号数据上传到公开仓库。
