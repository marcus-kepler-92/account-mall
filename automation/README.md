# Apple ID 本地自动化（命令行）

在本地用命令行执行 Apple ID 状态检测、改密、改区，不依赖 Vercel 或服务器。

## 环境

在 `automation/` 目录下执行一次依赖安装：

```bash
cd automation
uv sync
```

可选：复制 `.env.example` 为 `.env`，配置代理、登录页地址、是否无头等。

## 命令行用法

在 `automation/` 目录下执行：

```bash
uv run apple-automation run <子命令> --input <账号文件.txt> --delimiter "<分隔符>" [--output 结果文件.jsonl] ...
```

或在仓库根目录指定项目路径：

```bash
uv run --project automation apple-automation run <子命令> -i automation/accounts.txt -d "----" -o results.jsonl
```

### 子命令

| 子命令 | 说明 |
|--------|------|
| `run status-test` | 状态检测：校验账号密码是否有效、是否锁定、是否需 2FA |
| `run change-password` | 改密：登录后按预设生成新密码并修改 |
| `run change-region` | 改区：登录后修改账号地区（需配合 `--region`，默认 US） |

### 参数

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--input` | `-i` | 是 | 账号文件路径（.txt，一行一条卡密） |
| `--delimiter` | `-d` | 是 | 行内卡密分隔符，用于区分账号与密码，如 `----`、`:` |
| `--output` | `-o` | 否 | 结果输出文件（JSONL），不写则只打印到终端 |
| `--config` | `-c` | 否 | 可选配置文件（YAML/JSON），如超时、新密码长度、目标地区等 |
| `--timeout` |  | 否 | 超时时间（毫秒） |
| `--headless` |  | 否 | 是否无头运行浏览器（默认有头，便于观察登录） |
| `--region` | `-r` | 否 | 仅改区时有效，目标地区代码，如 `US` |

查看完整帮助：

```bash
uv run apple-automation run status-test --help
```

### 输入文件格式（.txt）

- 使用 **.txt 文件**，**一行一条卡密**，**换行表示卡密与卡密之间的分隔**。
- 同一行内，账号与密码用 **`--delimiter` 指定的分隔符** 分隔，例如分隔符为 `----` 时，一行内容为：`账号----密码`。
- 多账号：多行即可，每行一条卡密。

示例（分隔符 `----`）：

```
user1@example.com----password1
user2@example.com----password2
```

示例文件见 `template/accounts.txt`。

### 输出（JSONL）

有 `--output` 时写入该文件，同时每行也会打印到终端。每行一个 JSON 对象：

- 成功：`{"account":"...","success":true,"data":{...}}`
- 失败：`{"account":"...","success":false,"errorCode":"INVALID_CREDENTIALS","errorMessage":"..."}`
