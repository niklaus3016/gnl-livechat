#!/bin/bash
# Sealos DevBox 启动入口
# 只负责启动应用，构建已在开发环境完成（dist/ 产物就绪）
cd /home/devbox/project
node server.js
