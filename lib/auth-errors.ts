const ERROR_MAP: Record<string, string> = {
  // Core email/password errors
  "Invalid email or password": "邮箱或密码错误",
  "Invalid password": "密码错误",
  "User not found": "账号不存在",
  "Email not found": "邮箱未注册",
  "User email not found": "邮箱未注册",
  "Email not verified": "邮箱尚未验证",
  "Password too short": "密码太短",
  "Password too long": "密码太长",
  "User already exists.": "该邮箱已注册",
  "User already exists. Use another email.": "该邮箱已注册，请换用其他邮箱",
  "Email and password sign up is not enabled": "当前不支持直接注册，请通过邀请链接加入",
  "Failed to create user": "创建账号失败，请稍后重试",
  "Failed to create session": "登录失败，请稍后重试",
  "Session expired. Re-authenticate to perform this action.": "登录已过期，请重新登录",
  // Username plugin errors
  "Invalid username or password": "用户名或密码错误",
  "Username is already taken. Please try another.": "用户名已被占用，请换一个",
  "Username is too short": "用户名太短",
  "Username is too long": "用户名太长",
  "Username is invalid": "用户名格式无效",
  // Rate limiting
  "Too many requests": "操作过于频繁，请稍后重试",
}

export function translateAuthError(message: string): string {
  return ERROR_MAP[message] ?? message
}
