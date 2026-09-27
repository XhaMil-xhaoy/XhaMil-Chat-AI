<!-- App 发版：上传 APK → 写更新说明 → 打开开关 -->
<template>
  <div class="app-update-page">
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-lg font-medium m-0 text-g-900">App 发版</h2>
        <p class="text-sm text-g-500 mt-1 mb-0">上传新包，写清更新内容，打开开关即可同步到 App</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <ElButton
          type="danger"
          plain
          :loading="withdrawing"
          :disabled="!form.enabled"
          @click="withdrawPublish"
        >
          {{ form.enabled ? '撤回发布' : '当前未发布' }}
        </ElButton>
        <ElButton type="primary" :loading="saving" v-ripple @click="save">保存并发布</ElButton>
      </div>
    </div>

    <ElRow :gutter="16" v-loading="loading">
      <ElCol :md="14" :xs="24" class="mb-4">
        <!-- 1. 版本号 + 安装包 -->
        <div class="art-card p-5 mb-4">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 class="text-base font-medium m-0 mb-1">1. 版本号 / 安装包</h3>
              <p class="text-sm text-g-500 mt-0 mb-0">拖入 APK 后自动读取版本，无需手填</p>
            </div>
            <ElButton
              v-if="releases.length"
              type="danger"
              plain
              size="small"
              :loading="clearing"
              @click="clearAllApks"
            >
              清空安装包
            </ElButton>
          </div>

          <div class="version-card mb-4">
            <div class="version-card__label">当前发版版本</div>
            <div
              class="version-card__name"
              :style="{ color: versionNameLooksBeta ? '#E53935' : form.aboutVersionColor || '#0f172a' }"
            >
              {{ form.versionName ? `v${form.versionName}` : '尚未选择安装包' }}
            </div>
            <div class="version-card__meta">
              <span>versionCode {{ form.latestVersionCode || '—' }}</span>
              <span v-if="form.apkFilename" class="version-card__file">{{ form.apkFilename }}</span>
              <ElTag v-if="versionNameLooksBeta" size="small" type="danger" effect="plain">
                Beta · 关于页红字 + 防外传水印
              </ElTag>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-sm text-g-700 mb-2 font-medium">关于页 · 版本号颜色</div>
            <div class="flex items-center gap-3 flex-wrap">
              <ElColorPicker v-model="form.aboutVersionColor" color-format="hex" />
              <ElInput
                v-model="form.aboutVersionColor"
                maxlength="7"
                placeholder="#64748B 留空=默认灰"
                class="!w-44"
                clearable
              />
              <ElButton
                link
                type="primary"
                @click="form.aboutVersionColor = '#64748B'"
              >
                默认灰
              </ElButton>
              <ElButton link @click="form.aboutVersionColor = ''">清空</ElButton>
            </div>
            <p class="text-xs text-g-400 mt-2 mb-0 leading-5">
              用户「关于」页版本号颜色。若安装包 versionName 含
              <b>Beta</b>（不区分大小写），客户端会强制红色，并铺「作者 xhaoy」隐私水印防外传。
            </p>
          </div>

          <ElUpload
            drag
            accept=".apk,application/vnd.android.package-archive"
            :show-file-list="false"
            :auto-upload="false"
            :disabled="uploading"
            @change="onPickApk"
          >
            <div class="py-6">
              <p class="text-base text-g-700 m-0 mb-1">
                {{ uploading ? '上传中…' : '点击或拖拽 APK 到这里' }}
              </p>
              <p class="text-sm text-g-400 m-0">最大 512MB · 覆盖上传即换新版</p>
            </div>
          </ElUpload>

          <ElTable v-if="releases.length > 1" :data="releases" size="small" class="mt-4">
            <ElTableColumn prop="filename" label="历史安装包" min-width="180" />
            <ElTableColumn label="大小" width="90">
              <template #default="{ row }">{{ formatSize(row.size) }}</template>
            </ElTableColumn>
            <ElTableColumn label="" width="120">
              <template #default="{ row }">
                <ElButton
                  link
                  type="primary"
                  :disabled="row.filename === form.apkFilename"
                  @click="selectApk(row.filename)"
                >
                  {{ row.filename === form.apkFilename ? '使用中' : '换这个' }}
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <!-- 2. 更新内容 -->
        <div class="art-card p-5 mb-4">
          <h3 class="text-base font-medium m-0 mb-1">2. 更新内容</h3>
          <p class="text-sm text-g-500 mt-0 mb-3">用户弹窗里会原样显示，建议按行写「新增 / 优化」</p>
          <ElInput
            v-model="form.content"
            type="textarea"
            :rows="8"
            :maxlength="maxLength"
            show-word-limit
            placeholder="新增 某某功能&#10;优化 某某体验&#10;修复 某某问题"
          />
        </div>

        <!-- 3. 开关 -->
        <div class="art-card p-5">
          <h3 class="text-base font-medium m-0 mb-4">3. 发布</h3>
          <ElForm label-position="left" label-width="120px">
            <ElFormItem label="开启更新提示">
              <ElSwitch v-model="form.enabled" />
              <span class="text-xs text-g-400 ml-2">打开后，旧版 App 启动会弹窗</span>
            </ElFormItem>
            <ElFormItem label="强制更新">
              <ElSwitch v-model="form.forceUpdate" :disabled="!form.enabled" />
              <span class="text-xs text-g-400 ml-2">开启后不能点「稍后再说」</span>
            </ElFormItem>
          </ElForm>

          <ElCollapse class="mt-1">
            <ElCollapseItem title="高级：通知 / 维护弹窗（不发安装包）" name="more">
              <ElForm label-position="top">
                <ElFormItem label="类型">
                  <ElRadioGroup v-model="form.dialogType">
                    <ElRadio value="update">发新版</ElRadio>
                    <ElRadio value="notice">系统通知</ElRadio>
                    <ElRadio value="maintenance">维护公告</ElRadio>
                  </ElRadioGroup>
                </ElFormItem>
                <ElFormItem label="弹窗标题（通知/维护时用）">
                  <ElInput v-model="form.title" placeholder="版本更新" />
                </ElFormItem>
                <ElRow :gutter="12">
                  <ElCol :span="12">
                    <ElFormItem label="确认按钮">
                      <ElInput v-model="form.confirmText" />
                    </ElFormItem>
                  </ElCol>
                  <ElCol :span="12">
                    <ElFormItem label="取消按钮">
                      <ElInput v-model="form.cancelText" />
                    </ElFormItem>
                  </ElCol>
                </ElRow>
              </ElForm>
            </ElCollapseItem>
          </ElCollapse>
        </div>
      </ElCol>

      <ElCol :md="10" :xs="24" class="mb-4">
        <div class="art-card p-5 sticky-preview">
          <h3 class="text-base font-medium m-0 mb-4">手机弹窗预览</h3>
          <div class="preview-dialog">
            <div class="preview-title">{{ previewTitle }}</div>
            <div class="preview-sub">{{ previewSubtitle }}</div>
            <div class="preview-body">{{ previewContent || '（写点更新内容吧）' }}</div>
            <div class="preview-actions">
              <span v-if="!form.forceUpdate && form.dialogType === 'update'" class="preview-btn ghost">
                {{ form.cancelText || '稍后再说' }}
              </span>
              <span class="preview-btn link">{{ form.confirmText || '立即更新' }}</span>
            </div>
          </div>
          <p class="text-xs text-g-500 mt-3 mb-0">
            {{ form.enabled ? '已开启：旧版打开 App 会看到此弹窗' : '未开启：不会提示更新' }}
          </p>
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { UploadFile } from 'element-plus'
  import { xhamilApi } from '@/api/xhamil'

  defineOptions({ name: 'XhamilAppUpdate' })

  const loading = ref(false)
  const saving = ref(false)
  const uploading = ref(false)
  const clearing = ref(false)
  const withdrawing = ref(false)
  const maxLength = ref(2000)
  const releases = ref<any[]>([])

  const form = reactive({
    enabled: false,
    dialogType: 'update',
    latestVersionCode: 0,
    versionName: '',
    apkFilename: '',
    forceUpdate: false,
    aboutVersionColor: '',
    title: '版本更新',
    content: '',
    confirmText: '立即更新',
    cancelText: '稍后再说'
  })

  const versionNameLooksBeta = computed(() =>
    /beta/i.test(String(form.versionName || ''))
  )

  const previewTitle = computed(() => {
    if (form.dialogType === 'notice') return form.title.trim() || '系统通知'
    if (form.dialogType === 'maintenance') return form.title.trim() || '维护公告'
    return '版本更新'
  })

  const previewSubtitle = computed(() => {
    if (form.dialogType !== 'update') return ''
    return form.versionName ? `发现新版本 v${form.versionName}` : '发现新版本'
  })

  const previewContent = computed(() => form.content.trim())

  function formatSize(bytes: number) {
    if (!bytes) return '0 B'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  function fillForm(res: any) {
    form.enabled = !!res?.enabled
    form.dialogType = res?.dialogType || 'update'
    form.latestVersionCode = Number(res?.latestVersionCode) || 0
    form.versionName = res?.versionName || ''
    form.apkFilename = res?.apkFilename || ''
    form.forceUpdate = !!res?.forceUpdate
    form.aboutVersionColor = res?.aboutVersionColor || ''
    form.title = res?.title || '版本更新'
    form.content = res?.content || ''
    form.confirmText = res?.confirmText || '立即更新'
    form.cancelText = res?.cancelText || '稍后再说'
    maxLength.value = Number(res?.contentMaxLength) || 2000
    releases.value = res?.releases?.list || []
  }

  function applyApkMeta(res: any) {
    if (res?.filename) form.apkFilename = res.filename
    if (res?.versionName) form.versionName = res.versionName
    if (res?.versionCode) form.latestVersionCode = Number(res.versionCode)
    if (res?.config) fillForm({ ...res.config, releases: { list: releases.value } })
    if (form.dialogType === 'update') {
      if (!form.title.trim() || form.title === '发现新版本' || form.title.startsWith('发现新版本 v')) {
        form.title = '版本更新'
      }
      if (!form.content.trim()) {
        form.content = '新增 …\n优化 …'
      }
      if (!form.confirmText.trim()) form.confirmText = '立即更新'
      if (!form.cancelText.trim()) form.cancelText = '稍后再说'
    }
  }

  async function load() {
    loading.value = true
    try {
      const res = await xhamilApi.getAppUpdateConfig()
      fillForm(res)
    } finally {
      loading.value = false
    }
  }

  async function withdrawPublish() {
    try {
      await ElMessageBox.confirm(
        '撤回后，App 不再弹出更新提示。安装包仍保留，可随时再次发布。',
        '撤回发布',
        {
          type: 'warning',
          confirmButtonText: '撤回',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }
    withdrawing.value = true
    try {
      const res = await xhamilApi.withdrawAppUpdate()
      fillForm({ ...res, releases: releases.value.length ? { list: releases.value } : undefined })
      form.enabled = false
      form.forceUpdate = false
      ElMessage.success('已撤回发布，用户不会再收到更新弹窗')
    } finally {
      withdrawing.value = false
    }
  }

  async function save() {
    // 「保存并发布」= 强制开启推送；撤回请用红色「撤回发布」
    form.enabled = true
    if (form.dialogType === 'update' && !form.apkFilename) {
      ElMessage.error('请先上传 APK')
      return
    }
    if (!form.content.trim()) {
      ElMessage.error('请填写更新内容')
      return
    }
    saving.value = true
    try {
      const res = await xhamilApi.saveAppUpdateConfig({
        enabled: true,
        dialogType: form.dialogType,
        apkFilename: form.apkFilename,
        forceUpdate: form.forceUpdate,
        aboutVersionColor: form.aboutVersionColor || '',
        title: form.dialogType === 'update' ? '版本更新' : form.title.trim(),
        content: form.content.trim(),
        confirmText: form.confirmText.trim() || '立即更新',
        cancelText: form.cancelText.trim() || '稍后再说'
      })
      fillForm({ ...res, releases: releases.value.length ? { list: releases.value } : undefined })
      ElMessage.success('已发布，旧版 App 打开后会收到更新弹窗')
    } finally {
      saving.value = false
    }
  }

  async function selectApk(filename: string) {
    uploading.value = true
    try {
      const res = await xhamilApi.selectAppReleaseApk(filename)
      fillForm({ ...res, releases: { list: releases.value } })
      applyApkMeta({ filename, versionName: res?.versionName, versionCode: res?.latestVersionCode })
    } finally {
      uploading.value = false
    }
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
      const res = await xhamilApi.uploadAppReleaseApk(file)
      if (res?.releases?.list) releases.value = res.releases.list
      applyApkMeta(res)
      ElMessage.success(`已识别版本 v${form.versionName || '—'}`)
    } finally {
      uploading.value = false
    }
  }

  async function clearAllApks() {
    try {
      await ElMessageBox.confirm('确定删除所有已上传的安装包？当前选用也会被清空。', '清空安装包', {
        type: 'warning',
        confirmButtonText: '清空',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    clearing.value = true
    try {
      const res = await xhamilApi.deleteAllAppReleaseApks()
      releases.value = res?.releases?.list || []
      form.apkFilename = ''
      form.versionName = ''
      form.latestVersionCode = 0
      ElMessage.success(`已清空 ${res?.deleted ?? 0} 个安装包`)
    } finally {
      clearing.value = false
    }
  }

  onMounted(load)
</script>

<style scoped lang="scss">
  .version-card {
    padding: 16px 18px;
    border-radius: 12px;
    background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
    border: 1px solid #bfdbfe;
  }

  .version-card__label {
    font-size: 12px;
    color: #1d4ed8;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .version-card__name {
    font-size: 26px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }

  .version-card__meta {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    font-size: 12px;
    color: #64748b;
  }

  .version-card__file {
    word-break: break-all;
  }

  .sticky-preview {
    position: sticky;
    top: 16px;
  }

  .preview-dialog {
    border-radius: 16px;
    background: #fff;
    border: 1px solid var(--el-border-color-lighter);
    padding: 18px 18px 12px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
  }

  .preview-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
  }

  .preview-sub {
    margin-top: 6px;
    font-size: 14px;
    color: #64748b;
    min-height: 20px;
  }

  .preview-body {
    margin-top: 14px;
    font-size: 14px;
    line-height: 1.6;
    color: rgba(15, 23, 42, 0.82);
    min-height: 88px;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .preview-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    min-height: 36px;
  }

  .preview-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    font-size: 15px;
    font-weight: 600;
  }

  .preview-btn.ghost {
    color: #64748b;
    font-weight: 500;
  }

  .preview-btn.link {
    color: #2080f0;
  }
</style>
