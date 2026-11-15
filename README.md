# 影境手札 · 影之刃零中文攻略

本地运行的《影之刃零》中文攻略工具：读取港服 PSN 奖杯进度，按当前进度推荐下一场首领、易错过内容、支线与真结局条件。**所有攻略、地图和截图都集成在本项目内，应用界面没有任何外链。**

## 启动

双击 `start.bat`。首次启动会自动安装依赖并构建，然后打开 http://localhost:8765。

- 电脑：浏览器自动打开
- 手机：同一无线网络下打开启动窗口显示的 `http://192.168.x.x:8765`
- 构建需要几秒；以后每次启动也会重新构建，确保代码与页面一致

### 首次获取本地地图素材

地图瓦片和点位截图约 110 MB，不放进 Git 仓库。克隆后运行一次：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fetch-map-assets.ps1
```

没有素材时，除「地图」页外其他功能不受影响。

## 功能

- **首页**：当前目标、奖杯/收集/支线/真结局进度、易错过提醒
- **攻略**：9 个区域，首领（含中文打法要点）、支线（完整步骤）、收集点位（573 个，203 个带本地截图）、真结局 11 项
- **地图**：8 张本地游戏地图，可缩放、搜索、只看有截图；右侧点位列表联动地图
- **奖杯**：36 个 PS5 奖杯，中文名称与条件，PSN 自动同步
- **设置**：PSN 授权、手机地址、进度导出/清空

移动端采用手机优先布局：底部五个入口、吸顶章回与分段栏、收集/关键道具详情用底部抽屉、地图点位列表用可收起的底部抽屉，支持浏览器返回键与深链；地图代码按需加载。当前是响应式网页，不包含 PWA/离线安装。

所有界面文案、点位名称、提示、首领打法、支线步骤均为中文；`PSN`、`PS5` 等为平台名称。

## 技术栈

- 前端：React 19 + Vite + TypeScript
- 后端：Node.js + TypeScript（`tsc` 编译到 `dist-server`）
- 地图：Leaflet + 本地瓦片/点位数据
- PSN：`psn-api`，授权码经系统账户级加密保存在本机

开发：

```powershell
npm run dev          # Vite 前端（代理 /api、/map 到 8765）
npm run dev:server   # 另一个终端，运行 TS 后端
```

生产构建：

```powershell
npm run build
node dist-server/server.js
```

## 连接 PSN（港服）

1. 在浏览器登录 PlayStation 官网（港服账号）
2. 打开授权码页面，复制页面里的授权码
3. 在网页「设置」粘贴 → 保存并同步
4. 如果找不到游戏，先在 PS5 打开《影之刃零》奖杯列表同步一次

设置页提供「复制官网地址」「复制授权页地址」按钮，不需要手抄链接。

## 数据与素材

攻略数据整理自游民星空、keyw007/pbz-guide 与 MapleEve/pbz-map 的公开资料，仅作个人、非商业用途。详细署名与许可范围见 `NOTICE.md`。

- 代码：MIT
- 攻略数据与第三方游戏素材：各自权利归原方
- `public/map/` 与 `data/progress.json`、`data/npsso.enc` 不进入 Git 仓库

## 上传到 GitHub 前

`.gitignore` 已排除：

- `node_modules/`、`dist/`、`dist-server/`
- `data/npsso.enc`（授权码，绝不能上传）
- `data/progress.json`（你的奖杯进度与勾选）
- `public/map/`（约 110 MB 地图/截图素材）
- `research/raw/`、`research/text/`、`research/build/`
- `data/guide.en.json`

公开仓库前请确认第三方攻略数据与游戏素材的使用范围；更稳妥的做法是使用私有仓库。

## 目录

```
index.html                Vite 入口
src/                      React 前端（TypeScript）
  pages/                  首页 / 攻略 / 地图 / 奖杯 / 设置
  components/             导航、灯箱、缩略图、提示
  helpers.ts              进度、奖杯、易错过等规则
server.ts                 Node 后端（TypeScript）
lib/psn.ts                PSN 同步
shared/types.ts           前后端共享类型
data/guide.json           中文攻略数据
public/map/               本地地图素材（gitignored）
scripts/fetch-map-assets.ps1
```

## 常见问题

- **地图页提示素材缺失**：运行 `scripts/fetch-map-assets.ps1`
- **端口被占用**：关闭占用 8765 的程序，或设置 `PORT` 环境变量
- **手机打不开**：确认同一无线网络、防火墙允许程序访问
- **奖杯名未匹配**：系统同时按中文名和英文名匹配；仍未匹配的可在奖杯页手动勾选
- **地图标记名称是笼统的“饰品点位”**：该点位没有匹配到中文名；区域攻略里有对应的中文提示
