# 开源软件依赖清单

本文档列出了项目中各个服务所依赖的开源软件及其版本信息。

---

## 1. Frontend (前端服务)

**路径**: `/Users/yangkai/Desktop/fishtank/frontend/package.json`

### 生产依赖 (dependencies)

| 软件包 | 版本 | 说明 |
|--------|------|------|
| `vue` | ^3.5.25 | Vue.js 3 前端框架 |
| `vue-router` | ^5.0.3 | Vue 路由管理 |
| `tdesign-vue-next` | ^1.18.3 | TDesign Vue3 组件库 |
| `@tdesign-vue-next/chat` | ^0.5.0 | TDesign 聊天组件 |
| `tdesign-icons-vue-next` | ^0.4.2 | TDesign 图标库 |
| `markdown-it` | ^14.1.1 | Markdown 解析器 |
| `twemoji` | ^14.0.2 | Twitter Emoji 库 |
| `less` | ^4.5.1 | CSS 预处理器 |

### 开发依赖 (devDependencies)

| 软件包 | 版本 | 说明 |
|--------|------|------|
| `typescript` | ~5.9.3 | TypeScript 语言支持 |
| `vite` | ^7.3.1 | 构建工具 |
| `tailwindcss` | ^4.2.1 | CSS 原子类框架 |
| `@tailwindcss/vite` | ^4.2.1 | Tailwind Vite 插件 |
| `@tailwindcss/postcss` | ^4.2.1 | Tailwind PostCSS 插件 |
| `autoprefixer` | ^10.4.27 | CSS 自动前缀 |
| `postcss` | ^8.5.8 | CSS 处理工具 |
| `vitest` | ^4.1.2 | 单元测试框架 |
| `@vitejs/plugin-vue` | ^6.0.2 | Vite Vue 插件 |
| `vue-tsc` | ^3.1.5 | Vue TypeScript 编译器 |
| `@vue/tsconfig` | ^0.8.1 | Vue TSConfig 配置 |
| `@types/markdown-it` | ^14.1.2 | Markdown-it 类型定义 |
| `@types/node` | ^24.10.1 | Node.js 类型定义 |

---

## 2. Agent Core (AI Agent 核心服务)

**路径**: `/Users/yangkai/Desktop/fishtank/backend/agent-core/package.json`

### 生产依赖 (dependencies)

| 软件包 | 版本 | 说明 |
|--------|------|------|
| `@nestjs/common` | ^10.0.0 | NestJS 核心库 |
| `@nestjs/core` | ^10.0.0 | NestJS 核心 |
| `@nestjs/platform-express` | ^10.0.0 | NestJS Express 平台 |
| `@nestjs/config` | ^4.0.3 | NestJS 配置模块 |
| `langchain` | ^1.2.29 | LangChain.js LLM 框架 |
| `@langchain/core` | ^1.1.31 | LangChain 核心库 |
| `@langchain/langgraph` | ^1.2.0 | LangGraph 工作流引擎 |
| `@langchain/openai` | ^1.2.12 | LangChain OpenAI 集成 |
| `axios` | ^1.6.0 | HTTP 客户端 |
| `js-yaml` | ^4.1.1 | YAML 解析器 |
| `@types/js-yaml` | ^4.0.9 | js-yaml 类型定义 |
| `ajv` | ^8.18.0 | JSON Schema 校验器 |
| `ajv-formats` | ^3.0.1 | AJV 格式扩展 |
| `pinyin-pro` | ^3.28.0 | 中文拼音转换 |
| `uuid` | 9.0.1 | UUID 生成器 |
| `rxjs` | ^7.8.0 | 响应式编程库 |
| `reflect-metadata` | ^0.1.13 | 元数据反射 API |

### 开发依赖 (devDependencies)

| 软件包 | 版本 | 说明 |
|--------|------|------|
| `@nestjs/cli` | ^10.0.0 | NestJS CLI 工具 |
| `@nestjs/schematics` | ^10.0.0 | NestJS 脚手架 |
| `@nestjs/testing` | ^10.0.0 | NestJS 测试工具 |
| `typescript` | ^5.0.0 | TypeScript 语言支持 |
| `@types/node` | ^20.0.0 | Node.js 类型定义 |
| `@types/uuid` | 9.0.8 | UUID 类型定义 |

---

## 3. Skill Gateway (Java 技能网关服务)

**路径**: `/Users/yangkai/Desktop/fishtank/backend/skill-gateway/pom.xml`

| 软件包 | Group ID | Artifact ID | 版本 | 说明 |
|--------|----------|-------------|------|------|
| **Spring Boot** | org.springframework.boot | spring-boot-starter-parent | 3.2.3 | Spring Boot 父 POM |
| **Spring Web** | org.springframework.boot | spring-boot-starter-web | 3.2.3 | Web 开发框架 |
| **Spring Security** | org.springframework.boot | spring-boot-starter-security | 3.2.3 | 安全框架 |
| **Spring Data JPA** | org.springframework.boot | spring-boot-starter-data-jpa | 3.2.3 | 数据持久层 |
| **Spring WebFlux** | org.springframework.boot | spring-boot-starter-webflux | 3.2.3 | 响应式 Web 框架 |
| **MySQL 驱动** | com.mysql | mysql-connector-j | 8.x | MySQL 数据库连接 |
| **H2 数据库** | com.h2database | h2 | 2.x | 嵌入式测试数据库 |
| **SSHJ** | com.hierynomus | sshj | 0.38.0 | SSH 客户端库 |
| **Lombok** | org.projectlombok | lombok | 1.18.x | 代码生成工具 |
| **Spring Boot Test** | org.springframework.boot | spring-boot-starter-test | 3.2.3 | 测试框架 |

**Java 版本**: 17

---

## 依赖统计摘要

| 服务 | 技术栈 | 生产依赖数 | 开发依赖数 |
|------|--------|-----------|-----------|
| Frontend | Vue 3 + TypeScript | 8 | 14 |
| Agent Core | NestJS + LangChain | 17 | 6 |
| Skill Gateway | Spring Boot 3 | 10 | - |

### 主要框架版本

- **Vue**: 3.5.25
- **NestJS**: 10.x
- **LangChain.js**: 1.2.29
- **LangGraph**: 1.2.0
- **Spring Boot**: 3.2.3
- **Java**: 17

---

*文档生成时间: 2026-04-20*
