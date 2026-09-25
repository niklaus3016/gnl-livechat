# 桌面客户端自动更新 · 后端对接说明

## 一、需求概述

桌面客户端（Electron，Windows）使用 `electron-updater` 的 **generic（静态文件）** 方案实现自动更新。客户端启动后会向一个固定 URL 请求版本清单文件（`latest.yml`），对比版本号；若有新版本，则下载清单中指定的安装包并提示用户安装。

**后端不需要开发任何业务接口，只需提供一个可通过 HTTPS 直接 GET 下载的静态文件目录。**

- 更新源基础 URL（已写死在客户端）：
  `https://dzdqdodqktpq.sealoshzh.site/desktop-updates/`
- 涉及三个文件（每次发版由前端从 GitHub Release 产出并提供）：
  1. `GNL-LiveChat-Setup-<版本>-x64.exe` —— Windows 安装包
  2. `latest.yml` —— 版本清单（客户端首先请求它）
  3. `GNL-LiveChat-Setup-<版本>-x64.exe.blockmap` —— 增量更新用的分块索引

## 二、目录结构

在 Web 服务上准备目录 `desktop-updates`（名字固定，与 URL 一致）：

```
desktop-updates/
├── latest.yml                                          # 当前最新版本清单（每次发版覆盖）
├── GNL-LiveChat-Setup-0.1.6-x64.exe                    # 历史版本安装包（建议保留，供差量更新）
├── GNL-LiveChat-Setup-0.1.6-x64.exe.blockmap
├── GNL-LiveChat-Setup-1.1.7-x64.exe                    # 当前版本
├── GNL-LiveChat-Setup-1.1.7-x64.exe.blockmap
└── ...
```

无需开启目录列表（autoindex），客户端只按固定文件名请求。

## 三、`latest.yml` 文件说明

该文件由打包工具自动生成，**不要手写、不要改内容**，直接原样上传即可。典型内容如下：

```yaml
version: 1.1.7
files:
  - url: GNL-LiveChat-Setup-1.1.7-x64.exe
    sha512: <自动生成的哈希，客户端下载后会校验，防篡改>
    size: 120543232
path: GNL-LiveChat-Setup-1.1.7-x64.exe
sha512: <同上>
releaseDate: '2026-09-26T10:00:00.000Z'
```

字段要点：

- `files[].url` 是**相对路径**，客户端会自动拼接在基础 URL 之后，因此文件必须和 `latest.yml` 放在同一目录。
- `sha512` 用于客户端校验下载完整性，文件内容在传输中不得被改写或重新压缩。

## 四、HTTP 服务硬性要求

| 要求 | 说明 |
|---|---|
| 必须 HTTPS | electron-updater 生产环境强制 https；现有域名已具备证书 |
| 支持 GET 直链下载 | 三个 URL 浏览器/ curl 直接访问必须返回文件本身（200），不能是登录页、鉴权拦截页或 JSON 包装。**该路径必须匿名可读**（更新检查可能发生在用户登录之前） |
| **必须支持 Range 请求** | 增量更新通过 `Range: bytes=...` 只下载变化的分块，服务端需返回 `206 Partial Content` 和 `Accept-Ranges: bytes`。Nginx / 对象存储默认支持，自研文件流接口需自行实现 |
| `latest.yml` 禁止缓存 | 响应头加 `Cache-Control: no-cache`（或 `no-store`），否则 CDN/浏览器缓存会导致客户收不到新版本 |
| exe / blockmap 可长缓存 | 文件名带版本号，不会变，可加 `Cache-Control: max-age=31536000, immutable`（可选） |
| Content-Type | `latest.yml` → `text/yaml` 或 `application/octet-stream` 均可；`.exe`、`.blockmap` → `application/octet-stream`（.blockmap 实际是 gzip 内容，保持 octet-stream 原样即可，客户端自行解压） |
| 不要对响应做二次压缩/转码 | 关闭对该目录 exe 的 gzip/br 动态压缩（文件本身已不可压缩，压缩还会破坏 Range 与 sha512 校验） |

## 五、服务端实现参考（二选一）

### 方案 A：Nginx 静态目录（推荐，最省事）

把三个文件放到服务器例如 `/data/desktop-updates/`，在现有站点配置中增加一个 location：

```nginx
location /desktop-updates/ {
    alias /data/desktop-updates/;

    # 版本清单：禁止任何缓存
    location = /desktop-updates/latest.yml {
        alias /data/desktop-updates/latest.yml;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        expires -1;
    }

    # 安装包与 blockmap：静态直出，Nginx 自动支持 Range(206)
    # 注意不要在此层级开启 gzip on 针对 exe
    types {
        application/octet-stream exe blockmap;
    }
    default_type application/octet-stream;
}
```

Nginx 的静态模块原生支持 `Accept-Ranges: bytes`，无需额外开发。

### 方案 B：Koa 后端直接托管（后端为 Koa 技术栈时）

```bash
npm i koa-static
```

```js
const Koa = require('koa');
const serve = require('koa-static');
const path = require('path');
const app = new Koa();

app.use(
  serve(path.join(__dirname, 'desktop-updates'), {
    // 静态中间件原生支持 Range 请求（206）
    maxage: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('latest.yml')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

app.listen(3000);
```

注意：该路由必须放在鉴权中间件**之前**或加入白名单，保证匿名可访问；若服务前面还有网关层（如 Sealos Ingress / CDN），同样需要确认它透传 Range 请求头且不强制缓存 yml。

## 六、每次发版的操作流程（SOP）

1. 前端发版（打 tag）后，GitHub Actions 会在 Release 页面产出 3 个文件：
   `GNL-LiveChat-Setup-x.y.z-x64.exe`、`latest.yml`、`GNL-LiveChat-Setup-x.y.z-x64.exe.blockmap`
2. 从 Release 下载这 3 个文件
3. 上传到服务器 `desktop-updates/` 目录：
   - **覆盖** `latest.yml`
   - 新版本的 exe 和 blockmap 为新增文件，历史版本文件建议保留（支持增量更新与多版本跨越）
4. 按第七节自测
5. 已安装客户端在下次启动时（启动后约 3.5 秒）自动检测到新版本并弹窗，无需通知客户重装

版本号遵循语义化版本（x.y.z），只有**更高版本号**才会触发更新；同版本号覆盖文件不会触发。

## 七、上线自测清单（请后端部署后执行）

```bash
BASE=https://dzdqdodqktpq.sealoshzh.site/desktop-updates

# 1. 清单可访问且不缓存（期望 200，Cache-Control 含 no-cache）
curl -I "$BASE/latest.yml"

# 2. 安装包可下载（期望 200，响应头含 accept-ranges: bytes）
curl -I "$BASE/GNL-LiveChat-Setup-1.1.7-x64.exe"

# 3. Range 请求生效（期望 HTTP 206，Content-Range: bytes 0-1023/...）
curl -H "Range: bytes=0-1023" -i \
  "$BASE/GNL-LiveChat-Setup-1.1.7-x64.exe" -o /dev/null

# 4. 清单内容正确（version 应为最新版本号，url 文件名实际存在）
curl -s "$BASE/latest.yml"
```

常见问题：

| 现象 | 原因 |
|---|---|
| 客户端无任何更新提示 | latest.yml 被 CDN/浏览器缓存；或 version 不高于客户端版本；或 URL 404 |
| 下载到一半失败 | 服务端不支持 Range，或网关对 exe 做了 gzip 压缩 |
| 提示"更新校验失败" | 文件传输中被改写（压缩/编码转换），sha512 不匹配；请确认二进制原样直出 |
| 返回的是登录页 HTML | 该路径被鉴权中间件拦截，需加匿名白名单 |

## 八、后续扩展（当前不做，仅预告）

- **macOS 自动更新**：待客户端签名/公证就绪后，目录中会增加 `latest-mac.yml` + `.zip`（mac 更新必须用 zip，dmg 仅用于人工安装）+ `.blockmap`，服务端无需改动，按同样方式上传即可。
- **灰度/内测通道**：可另建 `beta.yml`（客户端配置 channel=beta），目录和服务逻辑完全复用。
- **CI 自动上传**：后续如需在 GitHub Actions 发版后自动推文件到服务器，后端可提供一个带令牌鉴权的上传接口（POST multipart 或 S3/OSS 预签名），前端侧在流水线中追加一步上传即可。
