# 静态源部署说明

## 文件结构

```
output/
├── tvbox/                    # TVBox 配置（部署到静态服务器）
│   ├── tv_config.json        # TVBox 配置文件
│   └── js/                   # spider JS 文件 + lib 依赖
│       ├── jable.js
│       ├── jianpian.js
│       ├── spider.js         # Spider 基类
│       └── lib/              # 依赖库（cat.js, vod.js 等）
└── catvod/                   # 猫源文件（部署到静态服务器）
    ├── index.js              # esbuild 打包的单文件
    ├── index.js.md5
    ├── index.config.js
    └── index.config.js.md5
```

## 部署方式

把 output/ 目录上传到任意静态服务器（Cloudflare Pages / VPS / 对象存储）。

### TVBox 客户端
配置地址: https://raw.githubusercontent.com/ZHJ787/Hermes-upload/main/tvbox/tv_config.json

### 猫源客户端（Mira Play / Peekpili / OK影视）
订阅地址: https://raw.githubusercontent.com/ZHJ787/Hermes-upload/main/catvod/index.js

## 新增站源

1. 在 spiders/ 目录新增 spider JS 文件（参考 jable.js）
   - 必须继承 Spider 基类
   - 必须实现 getName() / getAppName() / getJSName() / getType()
   - 必须实现 setClasses / setHomeVod / setCategory / setDetail / setPlay / setSearch
   - 必须导出 __jsEvalReturn() 和 spider
2. 运行: python3 generate.py --base-url https://your-server.com
3. 重新部署 output/

## 说明

- TVBox 用 QuickJS 引擎运行 spider，api 字段用相对路径 ./js/xxx.js
- 猫源用 Node.js 运行 spider，esbuild 打包成单文件 index.js
- 两种客户端共用同一套 spider 源代码（QuickJS 格式）
- spider 用全局 req() 函数发 HTTP 请求（QuickJS 和 Node.js 运行时都提供）
