<!-- 下载页管理：独立安装包目录 + 品牌 -->
<template>
  <div class="download-page-admin">
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-lg font-medium m-0 text-g-900">下载页面</h2>
        <p class="text-sm text-g-500 mt-1 mb-0">
          专供
          <a class="text-primary" :href="pageUrl" target="_blank" rel="noopener">/download/</a>
          落地页 · 与「App 发版」分开存放
        </p>
      </div>
      <ElSpace wrap>
        <ElButton :loading="loading" v-ripple @click="load">刷新</ElButton>
        <ElButton type="primary" :loading="saving" v-ripple @click="save">保存</ElButton>
      </ElSpace>
    </div>

    <ElAlert
      class="mb-4"
      type="info"
      show-icon
      :closable="false"
      title="安装包存于私有目录 backend/data/Download Page，已禁用 /media 直链；落地页使用这里选用的包，与 App 热更新目录无关。"
    />

    <div class="art-card p-5" v-loading="loading">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 class="text-base font-medium m-0 mb-1">上传安装包</h3>
          <p class="text-sm text-g-500 mt-0 mb-0">拖入 .apk，版本号自动识别；上传后即作为下载页当前包</p>
        </div>
        <ElButton
          v-if="releases.length"
          type="danger"
          plain
          :loading="clearing"
          @click="clearAll"
        >
          清理全部
        </ElButton>
      </div>

      <div v-if="form.apkFilename" class="apk-current mb-4">
        <div class="apk-current__badge">当前对外包</div>
        <div class="apk-current__version">v{{ form.versionName || '—' }}</div>
        <div class="apk-current__file">{{ form.apkFilename }}</div>
        <div class="apk-current__url mt-1 text-g-400">对外仅通过 /download/ 票据下载 · 无永久直链</div>
      </div>

      <ElUpload
        drag
        accept=".apk,application/vnd.android.package-archive"
        :show-file-list="false"
        :auto-upload="false"
        :disabled="uploading"
        @change="onPickApk"
      >
        <div class="py-8">
          <p class="text-base text-g-700 m-0 mb-1">
            {{ uploading ? '上传中…' : '点击或拖拽 APK 到这里' }}
          </p>
          <p class="text-sm text-g-400 m-0">最大 512MB · 仅存下载页目录</p>
        </div>
      </ElUpload>

      <ElTable v-if="releases.length" :data="releases" size="small" class="mt-4">
        <ElTableColumn prop="filename" label="已上传安装包" min-width="200" />
        <ElTableColumn label="大小" width="100">
          <template #default="{ row }">{{ formatSize(row.size) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="180">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              :disabled="row.filename === form.apkFilename"
              @click="selectApk(row.filename)"
            >
              {{ row.filename === form.apkFilename ? '使用中' : '选用' }}
            </ElButton>
            <ElButton link type="danger" @click="removeOne(row.filename)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElDivider />

      <div class="mb-4">
        <h3 class="text-base font-medium m-0 mb-1">下载页品牌</h3>
        <p class="text-sm text-g-500 mt-0 mb-3">顶栏图标与名称，对应落地页左上角品牌区</p>
        <div class="brand-row">
          <div class="brand-preview">
            <img
              v-if="form.iconUrl"
              :src="mediaUrl(form.iconUrl)"
              alt="下载页图标"
              class="brand-preview__img"
            />
            <span v-else class="brand-preview__empty">图标</span>
          </div>
          <div class="brand-fields">
            <ElInput
              v-model="form.brandName"
              maxlength="40"
              show-word-limit
              placeholder="品牌名，如 XhaMil"
              class="mb-2"
            />
            <ElInput
              v-model="form.tagline"
              maxlength="60"
              show-word-limit
              placeholder="标语，如 聊聊 · 更轻松"
            />
          </div>
          <div class="brand-actions">
            <ElUpload
              :show-file-list="false"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              :http-request="onUploadIcon"
              :disabled="uploadingIcon"
            >
              <ElButton size="small" plain :loading="uploadingIcon">上传图标</ElButton>
            </ElUpload>
            <ElButton v-if="form.iconUrl" size="small" plain class="mt-1" @click="clearIcon">
              清除
            </ElButton>
          </div>
        </div>
      </div>

      <ElDivider />

      <ElForm label-position="top" class="max-w-xl">
        <ElFormItem label="开启下载页对外下载">
          <ElSwitch v-model="form.enabled" />
          <span class="text-xs text-g-400 ml-2">关闭后落地页会显示暂无安装包</span>
        </ElFormItem>
        <ElFormItem label="落地页主标题（可选）">
          <ElInput
            v-model="form.title"
            maxlength="80"
            show-word-limit
            placeholder="留空则用下载页默认文案"
          />
        </ElFormItem>
        <ElFormItem label="落地页副标题（可选）">
          <ElInput
            v-model="form.subtitle"
            maxlength="160"
            show-word-limit
            placeholder="留空则用下载页默认文案"
          />
        </ElFormItem>
      </ElForm>

      <p class="text-xs text-g-500 mb-0">
        当前合计 {{ releases.length }} 个包 ·
        {{ formatSize(totalSize) }}
        <template v-if="form.versionName"> · 对外 v{{ form.versionName }}</template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { UploadFile } from 'element-plus'
  import { xhamilApi } from '@/api/xhamil'

  defineOptions({ name: 'XhamilDownloadPage' })

  const loading = ref(false)
  const saving = ref(false)
  const uploading = ref(false)
  const uploadingIcon = ref(false)
  const clearing = ref(false)
  const releases = ref<any[]>([])
  const totalSize = ref(0)

  const form = reactive({
    enabled: true,
    apkFilename: '',
    apkUrl: '',
    versionName: '',
    versionCode: 0,
    title: '',
    subtitle: '',
    brandName: '',
    tagline: '',
    iconUrl: ''
  })

  const pageUrl = computed(() => `${window.location.origin}/download/`)

  function mediaUrl(path: string) {
    if (!path) return '#'
    if (/^https?:\/\//i.test(path)) return path
    return `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`
  }

  function formatSize(n: number) {
    const size = Number(n) || 0
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  async function load() {
    loading.value = true
    try {
      const res = await xhamilApi.getDownloadPageConfig()
      Object.assign(form, {
        enabled: res?.enabled !== false,
        apkFilename: res?.apkFilename || '',
        apkUrl: res?.apkUrl || '',
        versionName: res?.versionName || '',
        versionCode: res?.versionCode || 0,
        title: res?.title || '',
        subtitle: res?.subtitle || '',
        brandName: res?.brandName || '',
        tagline: res?.tagline || '',
        iconUrl: res?.iconUrl || ''
      })
      releases.value = res?.releases?.list || []
      totalSize.value = res?.releases?.totalSize || 0
    } finally {
      loading.value = false
    }
  }

  async function save() {
    saving.value = true
    try {
      const res = await xhamilApi.saveDownloadPageConfig({
        enabled: form.enabled,
        apkFilename: form.apkFilename,
        title: form.title,
        subtitle: form.subtitle,
        brandName: form.brandName,
        tagline: form.tagline,
        iconUrl: form.iconUrl
      })
      Object.assign(form, {
        enabled: res?.enabled !== false,
        apkFilename: res?.apkFilename || '',
        apkUrl: res?.apkUrl || '',
        versionName: res?.versionName || '',
        versionCode: res?.versionCode || 0,
        title: res?.title || '',
        subtitle: res?.subtitle || '',
        brandName: res?.brandName || '',
        tagline: res?.tagline || '',
        iconUrl: res?.iconUrl || ''
      })
    } finally {
      saving.value = false
    }
  }

  async function onUploadIcon(opt: { file: File }) {
    uploadingIcon.value = true
    try {
      const res = await xhamilApi.uploadDownloadPageIcon(opt.file)
      form.iconUrl = res?.iconUrl || form.iconUrl
    } finally {
      uploadingIcon.value = false
    }
  }

  async function clearIcon() {
    form.iconUrl = ''
    await xhamilApi.saveDownloadPageConfig({ iconUrl: '' })
  }

  async function onPickApk(upload: UploadFile) {
    const file = upload.raw
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.apk')) {
      ElMessage.error('请选择 APK 文件')
      return
    }
    uploading.value = true
    try {
      const res = await xhamilApi.uploadDownloadPageApk(file)
      Object.assign(form, {
        enabled: true,
        apkFilename: res?.filename || res?.config?.apkFilename || '',
        apkUrl: res?.url || res?.config?.apkUrl || '',
        versionName: res?.versionName || res?.config?.versionName || '',
        versionCode: res?.versionCode || res?.config?.versionCode || 0
      })
      releases.value = res?.releases?.list || releases.value
      totalSize.value = res?.releases?.totalSize || totalSize.value
    } finally {
      uploading.value = false
    }
  }

  async function selectApk(filename: string) {
    const res = await xhamilApi.selectDownloadPageApk(filename)
    Object.assign(form, {
      apkFilename: res?.apkFilename || filename,
      apkUrl: res?.apkUrl || '',
      versionName: res?.versionName || '',
      versionCode: res?.versionCode || 0,
      enabled: res?.enabled !== false
    })
  }

  async function removeOne(filename: string) {
    await ElMessageBox.confirm(`删除 ${filename}？`, '删除安装包', { type: 'warning' })
    await xhamilApi.deleteDownloadPageApk(filename)
    await load()
  }

  async function clearAll() {
    await ElMessageBox.confirm(
      '将清空「Download Page」目录下全部 APK，下载页将暂时无法下载。不影响 App 发版目录。',
      '清理全部',
      { type: 'warning', confirmButtonText: '清理全部' }
    )
    clearing.value = true
    try {
      await xhamilApi.clearDownloadPageApks()
      await load()
    } finally {
      clearing.value = false
    }
  }

  onMounted(load)
</script>

<style scoped>
  .apk-current {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    padding: 12px 14px;
    background: var(--el-fill-color-blank);
  }

  .apk-current__badge {
    display: inline-block;
    font-size: 12px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-radius: 6px;
    padding: 2px 8px;
    margin-bottom: 6px;
  }

  .apk-current__version {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .apk-current__file,
  .apk-current__url {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    word-break: break-all;
  }

  .brand-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    flex-wrap: wrap;
  }

  .brand-preview {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-preview__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .brand-preview__empty {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .brand-fields {
    flex: 1;
    min-width: 200px;
    max-width: 360px;
  }

  .brand-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
</style>
