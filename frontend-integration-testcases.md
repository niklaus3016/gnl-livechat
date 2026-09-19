# 前端联调测试用例（在线客服系统）

> 后端地址：`http://localhost:3003`　Socket namespace：`/ws`
> 租户标识：`wgetcloud_live`　测试账号：`admin` / `agent01`（密码均为 `admin123456`）
> 后端已通过 40 项自动化断言（见 `src/scripts/e2e-test.ts`），本文档聚焦前端视角的联调用例。

## 0. 环境与通用约定

| 项目 | 约定 |
|---|---|
| 统一响应报文 | `{ code, message, data }`，code 与 HTTP status 一致（200/400/401/403/404/409/413/500） |
| 访客端 Header | `X-Tenant-Key: wgetcloud_live` + `X-Visitor-Token: <前端生成的UUID>` |
| 坐席/管理端 Header | `Authorization: Bearer <token>`（JWT 有效期 12h，过期需重新登录） |
| 文件上传 | `multipart/form-data`，字段名 `file` + `type`（text/image/file/audio）+ `duration`（录音秒数） |
| 上传返回 | `data.file_url` 为**相对路径**（如 `/uploads/2026-09-14/xxx.webm`），前端需自行拼接后端域名 |
| Socket ack | 客户端事件的第三参数为回调 `(res) => {res.code, res.message, res.data}`，务必处理失败分支 |

---

## 1. 访客端 Widget

### 1.1 获取租户配置
- 用例 A1：`GET /api/v1/widget/config`，仅带 `X-Tenant-Key` → 200，返回 `theme_color / welcome_msg / guide_options / business_hours / widget_position` 等
- 用例 A2：不带 `X-Tenant-Key` → 400；带错误租户 key → 404

### 1.2 会话初始化（核心）
- 用例 B1：首次进入，`POST /api/v1/widget/session/init` body `{visitor_token, source_url, browser}` → 200，返回 `visitor` / `conversation._id`（**前端须持久化 visitor_token 与 conversation_id，用于刷新恢复**）
- 用例 B2：坐席均离线时 init → `conversation.status === "queued"`；坐席在线时 → `"active"` 且带 `assigned_agent_id`
- 用例 B3：同一 visitor_token 重复 init → 返回同一活跃会话（`created: false`），`visit_count` 递增
- 用例 B4：刷新页面后用持久化 token 重新 init → 恢复同一会话，历史消息不丢

### 1.3 进线前留资
- 用例 C1：`POST /api/v1/widget/prechat/submit` body `{name, email, phone, note}` → 200；note 以系统消息落入会话，坐席端可见
- 用例 C2：未 init 直接调用 → 401

### 1.4 历史消息分页
- 用例 D1：`GET /api/v1/widget/messages?conversation_id=&page=1&limit=20` → 返回 `{total, page, limit, has_more, list}`
- 用例 D2：**列表按时间倒序（最新在前）**，前端渲染需 reverse
- 用例 D3：`has_more=true` 时上滑加载 page=2，注意去重与拼接顺序

### 1.5 富媒体上传
- 用例 E1：图片上传（type=image，≤25MB）→ 200 返回 `file_url`；用返回的 url 发 `send_message`（type=image, payload.file_url）
- 用例 E2：**录音上传（type=audio）≤10MB**，携带 `duration`（秒）→ 返回含 `audio_duration`；消息 content 建议占位 `[语音留言 4"]`
- 用例 E3：上传 >25MB → 413；audio >10MB → 413；非法类型（如 .exe）→ 415
- 用例 E4：**音频拖动进度条**：对 `file_url` 发起 `Range: bytes=0-` 请求应返回 206（iOS Safari 必测）

### 1.6 服务评价
- 用例 F1：会话关闭后 `POST /api/v1/widget/session/rate` `{conversation_id, score:1~5, feedback}` → 200
- 用例 F2：会话未接入（queued）时评价 → 400「会话尚未接入坐席」

### 1.7 离线留言
- 用例 G1：非营业时间 `POST /api/v1/widget/lead/offline` `{name, contact, message}` → 200；允许**未经 init** 的访客直接提交（仍需 X-Visitor-Token）

---

## 2. 坐席工作台

### 2.1 登录与会话
- 用例 H1：`POST /api/v1/auth/login` `{username, password}` → 200 返回 `token` 与 `user`；错误密码 → 401
- 用例 H2：`GET /api/v1/auth/me` 携带 Bearer → 200；token 过期 → 401（前端需跳登录）

### 2.2 在线状态
- 用例 I1：`PUT /api/v1/agent/status` `{status:"online"}` → 200，`data.redistributed` 为本次接管的排队会话数
- 用例 I2：切换 `busy` / `offline` 后，新访客 init 的分配行为随之变化

### 2.3 会话列表
- 用例 J1：`GET /api/v1/conversations?status=queued|active|resolved&page=&limit=` → 列表已 populate `visitor_id`（姓名/头像/标签/来源）与 `assigned_agent_id`
- 用例 J2：**直接读 `unread_count_agent` 字段显示角标**，不要自行 count 消息

### 2.4 接待与转接
- 用例 K1：认领排队会话 `POST /conversations/:id/assign`（空 body）→ 200，status 变 active
- 用例 K2：转接 `POST /conversations/:id/assign` `{target_agent_id, transfer_note}` → 200；其他坐席收到 `conversation_transferred` 事件
- 用例 K3：认领已被接待的会话 → 409

### 2.5 结束会话
- 用例 L1：`POST /conversations/:id/close` `{summary, tags}` → 200；房间内自动追加系统邀评消息；tags 会并入访客画像
- 用例 L2：非受理人（非 admin）关闭他人会话 → 403

### 2.6 快捷回复 / 访客标签
- 用例 M1：`GET /canned-responses?keyword=问候&category=` → 模糊匹配 title/content/shortcut
- 用例 M2：`POST /canned-responses` 新增；`PUT /visitors/:id/tags` `{tags:[...]}` 为整体覆盖语义

---

## 3. 管理后台

- 用例 N1：`GET/PUT /api/v1/admin/tenant/config` → PUT 白名单更新（theme_color 需 #RRGGBB；work_days 为 1~7 数组）；widget 端改后即时生效（重新拉 config 验证）
- 用例 N2：坐席管理 `GET /admin/agents?keyword=&page=`；`POST` 创建（重复 username → 409）；`PUT :id` 改角色/接待量/重置密码；`DELETE :id` 软删（is_active=false，登录即 401）
- 用例 N3：**坐席角色访问 admin 接口 → 403**（前端按角色隐藏入口）
- 用例 N4：`GET /admin/analytics/overview?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` → 返回会话总量/解决量/平均评分/首响秒数/按天趋势；日期分桶为 Asia/Shanghai

---

## 4. Socket.IO 实时通道（重点）

### 4.1 连接与鉴权
```js
// 坐席
io('http://localhost:3003/ws', { auth: { token: '<JWT>' } })          // 自动加入 tenant_agents_{tenant_id}
// 访客
io('http://localhost:3003/ws', { query: { token: visitorToken, conversation_id } })  // 自动加入 conv_{id}
```
- 用例 S1：坐席携带合法 JWT 连接成功；无效 token → `connect_error`（消息含 unauthorized）
- 用例 S2：访客 token 与 conversation_id 归属校验失败 → `connect_error`；正确则连接成功
- 用例 S3：**坐席连接成功后必须 `emit('join_conversation', {conversation_id}, ack)` 加入会话房间**，否则收不到该会话的 new_message / typing / message_read

### 4.2 消息收发
- 用例 S4：访客 `send_message {conversation_id, type:'text', content}` → ack 200；同房间坐席收到 `new_message {message}`（含 `_id, content, sender_type, created_at`）
- 用例 S5：坐席回复 → 访客收到 `new_message`；富媒体消息携带 `payload.file_url / audio_duration`
- 用例 S6：访客向他人会话发消息 / join 他人会话 → ack 返回 403
- 用例 S7：queued/active 之外的会话发消息 → ack 400

### 4.3 输入中 & 已读
- 用例 S8：访客 `typing_status {conversation_id, is_typing:true}` → 坐席收到，**发送者本人不回显**
- 用例 S9：访客 `message_read {conversation_id}` → ack 返回 `updated` 条数；坐席收到回执 `{conversation_id, reader_role:'visitor', updated}`；坐席端角标清零（unread_count_agent）
- 用例 S10：坐席读消息 → 访客侧 unread_count_visitor 清零

### 4.4 服务端主动推送
- 用例 S11：无空闲坐席时新访客 init → 在线坐席收到 `conversation_queued {conversation_id, visitor_name, source_url}`（可做提示音）
- 用例 S12：转接 → 相关坐席收到 `conversation_transferred {from_agent, to_agent, note}`
- 用例 S13：会话被认领/关闭/重分配 → 双端收到 `conversation_updated {conversation}`（前端应刷新列表与状态）

---

## 5. 联调注意事项（高频踩坑）

1. **visitor_token 持久化**：localStorage 存 UUID，丢失即新访客；跨租户同 token 是允许的（复合唯一索引）
2. **file_url 拼接**：上传返回相对路径，图片/音频 src 需拼后端域名
3. **消息渲染顺序**：REST 分页倒序返回，Socket 推送为追加，注意时间排序一致性
4. **坐席多会话**：一个坐席 Socket 可 join 多个 conv 房间；切换会话时 join 新房间即可
5. **断线重连**：Socket.IO 自带重连，重连后坐席需重新 join_conversation（连接态房间会丢失）
6. **评价入口时机**：收到 conversation_updated 且 status=resolved 后展示评价弹窗
7. **CORS 已全开**（开发环境），生产建议在后端收紧 origin

## 6. 快速自检命令

```bash
curl http://localhost:3003/api/v1/health                     # 服务/DB 状态
npx tsx src/scripts/e2e-test.ts                              # 后端全链路回归（40 断言）
npm run seed                                                 # 重置种子数据（幂等）
```
