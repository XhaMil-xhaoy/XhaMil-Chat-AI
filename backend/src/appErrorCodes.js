/**
 * App 面向用户的错误代码大全（与 Android AppErrorCodes.kt 编号保持一致）。
 * 客户端只展示「错误代码N」，后台可搜索查看说明。
 */
export const APP_ERROR_CODE_CATALOG = [
  {
    code: 1,
    title: '无网络',
    detail: '设备当前没有可用网络连接。',
    keywords: ['network_offline', '无网络']
  },
  {
    code: 2,
    title: '连接超时',
    detail: '请求等待服务器响应超时。',
    keywords: ['timeout', 'sockettimeout', 'timed out', 'read timed out']
  },
  {
    code: 3,
    title: '无法连接服务器',
    detail: '连不上服务器地址或端口被拒绝。',
    keywords: ['connectexception', 'failed to connect', 'connection refused', 'econnrefused']
  },
  {
    code: 4,
    title: '域名解析失败',
    detail: '无法解析服务器域名（DNS）。',
    keywords: ['unknownhost', 'unable to resolve', 'no address associated']
  },
  {
    code: 5,
    title: '安全证书无效',
    detail: 'HTTPS 证书校验失败，常见于证书过期、自签证书或系统未信任。',
    keywords: [
      'certpath',
      'trust anchor',
      'sslhandshake',
      'certificate',
      'certpathvalidatorexception',
      'javax.net.ssl'
    ]
  },
  {
    code: 6,
    title: '服务器暂时不可用',
    detail: '网关或上游服务异常（如 502/503/504）。',
    keywords: ['502', '503', '504', 'bad gateway', 'service unavailable', 'gateway timeout']
  },
  {
    code: 7,
    title: '登录已失效',
    detail: '登录状态过期或无效，需要重新登录。',
    keywords: ['401', '未登录', 'not logged', 'unauthorized', 'token']
  },
  {
    code: 8,
    title: '没有权限',
    detail: '当前账号无权执行该操作。',
    keywords: ['403', 'forbidden', '没有权限']
  },
  {
    code: 9,
    title: '内容不存在',
    detail: '请求的资源不存在或已被删除。',
    keywords: ['404', 'not found', '不存在']
  },
  {
    code: 10,
    title: '请求过于频繁',
    detail: '触发了限流，请稍后再试。',
    keywords: ['429', 'too many', 'rate limit', '过于频繁']
  },
  {
    code: 11,
    title: '服务器内部错误',
    detail: '服务器处理请求时出错。',
    keywords: ['500', 'internal server', '服务器内部']
  },
  {
    code: 12,
    title: '数据解析失败',
    detail: '服务器返回的数据无法解析。',
    keywords: ['json', 'parse', 'malformed', 'unexpected end']
  },
  {
    code: 13,
    title: '连接被中断',
    detail: '传输过程中连接被重置或中止。',
    keywords: ['connection reset', 'connection abort', 'broken pipe', 'enotconn']
  },
  {
    code: 99,
    title: '请求失败',
    detail: '未归类的请求失败，可对照详情或联系管理员。',
    keywords: []
  }
]
