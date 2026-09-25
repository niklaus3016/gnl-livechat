; ============================================================
; 光年龙·超级客服 · NSIS 安装向导定制
; 接入方式：package.json -> build.nsis.include
; 说明：本文件在 MUI2.nsh 之前引入，只能放置 !define 与 !macro 钩子
; ============================================================

; ---- 全局字体：默认宋体在中文 Windows 上非常陈旧，统一换成雅黑 ----
!define MUI_FONT "Microsoft YaHei UI"
!define MUI_FONTSIZE 9

; ---- 第一页：欢迎页（品牌侧边栏在这一页首次出现） ----
!define MUI_WELCOMEPAGE_TITLE "欢迎使用「光年龙·超级客服」安装向导"
!define MUI_WELCOMEPAGE_TEXT "光年龙·超级客服是专为客服团队打造的一站式接待平台：会话智能分配、访客画像、快捷回复、访客输入草稿实时预知。$\r$\n$\r$\n建议在继续之前关闭其他正在运行的程序，然后单击「下一步(N)」开始安装。$\r$\n$\r$\n"

; ---- 安装目录页文案精简（默认文案啰嗦） ----
!define MUI_DIRECTORYPAGE_TEXT_TOP "请选择 光年龙·超级客服 的安装文件夹，然后单击「安装(I)」。"

; ---- 完成页文案 ----
!define MUI_FINISHPAGE_TEXT "光年龙·超级客服 已成功安装到您的计算机。$\r$\n$\r$\n单击「完成(F)」关闭安装向导。"

!macro customWelcomePage
  ; 与许可/目录页一致：覆盖升级时自动跳过欢迎页
  !insertmacro skipPageIfUpdated
  !insertmacro MUI_PAGE_WELCOME
!macroend
