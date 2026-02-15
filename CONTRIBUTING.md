# Contributing

感谢你对 Account Mall 的关注。欢迎通过 Issue 和 Pull Request 参与贡献。

## 开发环境

1. **Clone 与安装**
   - Fork 本仓库，clone 到本地
   - `npm install`

2. **环境变量**
   - 复制 `.env.example` 为 `.env`，填写 `DATABASE_URL` 和 `BETTER_AUTH_SECRET`（至少 32 字符）
   - 其他变量见 [README 环境变量说明](README.md#environment-variables)

3. **数据库**
   - `docker compose up -d` 启动 PostgreSQL
   - `npm run db:generate` → `npm run db:migrate` → `npm run db:seed`

4. **启动**
   - `npm run dev`，访问 http://localhost:3000

## 代码质量

- **Lint**：`npm run lint`（提交前请确保通过）
- **单元 / 集成测试**：`npm run test`
- **覆盖率**：`npm run test:coverage`
- **E2E**：`npm run test:e2e`（需先启动 DB 并完成 migrate + seed，再在本地跑 `npm run dev` 或由 Playwright 自动启动）
- **依赖安全**：`npm run audit`（CI 会以 `--audit-level=high` 检查）

## 分支与 PR

- 默认分支为 `master`（或你仓库设置的默认分支）
- 请从默认分支拉出功能分支，完成修改后向默认分支发起 Pull Request
- PR 描述中可简要说明改动与相关 Issue

## 提交信息

- 建议使用简洁的祈使句（如「Add order lookup by email」「Fix cron auth check」）
- 若有关联 Issue，可在正文中写 `Closes #123`

## 其他

- 较大功能或破坏性改动建议先开 Issue 讨论
- 行为或 API 变更请同步更新测试与文档（如 README）
