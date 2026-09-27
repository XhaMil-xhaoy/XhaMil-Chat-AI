<!-- 错误代码大全：与 App 客户端编号一致；可搜索，并查看服务器运行状态 -->
<template>
  <div class="error-codes-page">
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-lg font-medium m-0 text-g-900">错误代码大全</h2>
        <p class="text-sm text-g-500 mt-1 mb-0">
          App 顶栏展示「错误代码 N」· 与客户端同源编号 · 共 {{ catalogTotal }} 条
        </p>
      </div>
      <ElSpace wrap>
        <ElButton :loading="loading" v-ripple @click="reload">刷新</ElButton>
      </ElSpace>
    </div>

    <div class="art-card p-5 mb-4" v-loading="statusLoading">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div class="text-base font-medium text-g-900">服务器当前运行状态</div>
        <ElTag size="small" :type="runtimeOk ? 'success' : 'danger'">
          {{ runtimeOk ? '运行中' : '异常 / 未加载' }}
        </ElTag>
      </div>
      <div v-if="status" class="status-grid">
        <div class="status-item">
          <div class="label">进程运行</div>
          <div class="value">{{ status.node?.uptimeText || '-' }}</div>
        </div>
        <div class="status-item">
          <div class="label">在线用户 (WS)</div>
          <div class="value">{{ status.realtime?.onlineUsers ?? '-' }}</div>
        </div>
        <div class="status-item">
          <div class="label">内存 RSS</div>
          <div class="value">{{ status.node?.memory?.rssMb ?? '-' }} MB</div>
        </div>
        <div class="status-item">
          <div class="label">Heap 已用</div>
          <div class="value">{{ status.node?.memory?.heapUsedMb ?? '-' }} MB</div>
        </div>
        <div class="status-item">
          <div class="label">数据库</div>
          <div class="value">
            <ElTag size="small" :type="status.database?.isConnected ? 'success' : 'warning'">
              {{ status.database?.isConnected ? '已连接' : '未连接' }}
            </ElTag>
            <span class="ml-2 text-g-500 text-xs">
              {{ status.database?.database || status.database?.host || '' }}
            </span>
          </div>
        </div>
        <div class="status-item">
          <div class="label">Redis</div>
          <div class="value">
            <ElTag size="small" :type="status.redis?.ready ? 'success' : 'info'">
              {{ status.redis?.ready ? '就绪' : '未就绪' }}
            </ElTag>
          </div>
        </div>
        <div class="status-item">
          <div class="label">Node</div>
          <div class="value text-xs">{{ status.node?.version || '-' }} · pid {{ status.node?.pid || '-' }}</div>
        </div>
        <div class="status-item">
          <div class="label">探测时间</div>
          <div class="value text-xs">{{ formatTime(status.time) }}</div>
        </div>
      </div>
      <ElEmpty v-else-if="!statusLoading" description="暂无运行状态" :image-size="64" />
    </div>

    <div class="art-card p-5" v-loading="loading">
      <div class="mb-4 flex items-center gap-3 flex-wrap">
        <ElInput
          v-model="query"
          clearable
          placeholder="搜索代码 / 标题 / 说明 / 关键词，例如 5 或 证书"
          class="!max-w-md"
          @keyup.enter="loadCodes"
        />
        <ElButton type="primary" v-ripple @click="loadCodes">搜索</ElButton>
      </div>

      <ElEmpty v-if="!list.length && !loading" description="没有匹配的错误代码" />
      <div v-else class="code-list">
        <div v-for="row in list" :key="row.code" class="code-card">
          <div class="flex items-start gap-3">
            <div class="code-badge">{{ row.code }}</div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base font-medium text-g-900">{{ row.title }}</span>
                <ElTag size="small" type="info" effect="plain">错误代码{{ row.code }}</ElTag>
              </div>
              <p class="text-sm text-g-600 mt-2 mb-0 leading-6">{{ row.detail }}</p>
              <div v-if="row.keywords?.length" class="mt-2 flex flex-wrap gap-1">
                <ElTag
                  v-for="kw in row.keywords"
                  :key="kw"
                  size="small"
                  type="info"
                  effect="plain"
                  class="!text-xs"
                >
                  {{ kw }}
                </ElTag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { xhamilApi } from '@/api/xhamil'

  defineOptions({ name: 'XhamilErrorCodes' })

  type CodeRow = {
    code: number
    title: string
    detail: string
    keywords?: string[]
  }

  const query = ref('')
  const loading = ref(false)
  const statusLoading = ref(false)
  const list = ref<CodeRow[]>([])
  const catalogTotal = ref(0)
  const status = ref<any>(null)

  const runtimeOk = computed(() => !!status.value?.node?.pid)

  function formatTime(iso?: string) {
    if (!iso) return '-'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString()
  }

  async function loadCodes() {
    loading.value = true
    try {
      const data = await xhamilApi.getErrorCodes(query.value.trim() || undefined)
      list.value = data?.list || []
      catalogTotal.value = Number(data?.total || list.value.length)
    } catch {
      list.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadStatus() {
    statusLoading.value = true
    try {
      status.value = await xhamilApi.getRuntimeStatus()
    } catch {
      status.value = null
    } finally {
      statusLoading.value = false
    }
  }

  async function reload() {
    await Promise.all([loadCodes(), loadStatus()])
  }

  onMounted(() => {
    reload()
  })
</script>

<style scoped lang="scss">
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px 16px;
  }

  .status-item {
    .label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 4px;
    }
    .value {
      font-size: 14px;
      color: var(--el-text-color-primary);
      word-break: break-all;
    }
  }

  .code-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .code-card {
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  .code-badge {
    flex-shrink: 0;
    min-width: 40px;
    height: 40px;
    padding: 0 8px;
    border-radius: 10px;
    background: #e6f0fa;
    color: #4a90e2;
    font-weight: 700;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
