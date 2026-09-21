/**
 * 全局头像常量
 */

/**
 * AI 助手默认头像（抽象极光渐变图）。
 * 用于：
 *  - 访客端 pre_chat 状态 / 未分配坐席时显示
 *  - 后端 brand_avatar 为空时的 fallback
 *  - 企业主外观定制页的机器人头像预设
 *
 * 非人像，安全保留（与坐席真人头像区分）。
 */
export const AI_DEFAULT_AVATAR = '/avatars/ai-default.png';

/**
 * 坐席无自定义头像时的兜底（通用女士头像）。
 * 用于坐席已分配但未设置头像时。
 */
export const AGENT_DEFAULT_AVATAR = '/avatars/agent-female.png';
