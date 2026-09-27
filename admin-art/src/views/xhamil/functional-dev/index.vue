<!-- 功能性开发配置 -->
<template>
  <div class="functional-dev-page" v-loading="loading">
    <ElForm label-position="top" size="small" @submit.prevent>
      <div class="card-row">
        <!-- 帮助与客服 -->
        <div class="dev-card">
          <div class="dev-card-title">帮助与客服</div>
          <div class="dev-card-body">
            <ElFormItem label="弹窗标题">
              <ElInput v-model="form.helpSupport.title" maxlength="64" placeholder="帮助与客服">
                <template #prefix>
                  <ArtSvgIcon icon="ri:customer-service-2-line" />
                </template>
              </ElInput>
            </ElFormItem>
            <ElFormItem label="弹窗说明">
              <ElInput
                v-model="form.helpSupport.content"
                type="textarea"
                :rows="2"
                maxlength="300"
                placeholder="联系客服说明…"
              />
            </ElFormItem>
            <ElFormItem label="QQ 号">
              <ElInput v-model="form.helpSupport.qq" maxlength="32" placeholder="123456789">
                <template #prefix>
                  <ArtSvgIcon icon="ri:qq-line" />
                </template>
              </ElInput>
            </ElFormItem>
            <ElFormItem label="微信号" class="!mb-0">
              <ElInput v-model="form.helpSupport.wechat" maxlength="32" placeholder="xhamil_support">
                <template #prefix>
                  <ArtSvgIcon icon="ri:wechat-line" />
                </template>
              </ElInput>
            </ElFormItem>
          </div>
        </div>

        <!-- 入群门禁 -->
        <div class="dev-card">
          <div class="dev-card-title">入群门禁</div>
          <div class="dev-card-body">
            <ElFormItem label="启用">
              <ElSwitch v-model="form.gateGroup.enabled" />
            </ElFormItem>
            <ElFormItem label="门禁群号">
              <ElInput
                v-model="form.gateGroup.groupCode"
                :disabled="!form.gateGroup.enabled"
                placeholder="仅数字群号"
                maxlength="20"
                @input="onGroupCodeInput"
              >
                <template #prefix>
                  <ArtSvgIcon icon="ri:group-line" />
                </template>
              </ElInput>
            </ElFormItem>
            <ElFormItem label="弹窗标题">
              <ElInput
                v-model="form.gateGroup.title"
                :disabled="!form.gateGroup.enabled"
                maxlength="64"
                placeholder="欢迎加入"
              >
                <template #prefix>
                  <ArtSvgIcon icon="ri:door-open-line" />
                </template>
              </ElInput>
            </ElFormItem>
            <ElFormItem label="弹窗内容">
              <ElInput
                v-model="form.gateGroup.content"
                type="textarea"
                :rows="2"
                :disabled="!form.gateGroup.enabled"
                maxlength="500"
                placeholder="进群说明…"
              />
            </ElFormItem>
            <div class="grid grid-cols-2 gap-2">
              <ElFormItem label="确认" class="!mb-0">
                <ElInput
                  v-model="form.gateGroup.confirmText"
                  :disabled="!form.gateGroup.enabled"
                  maxlength="16"
                  placeholder="进入"
                />
              </ElFormItem>
              <ElFormItem label="取消" class="!mb-0">
                <ElInput
                  v-model="form.gateGroup.cancelText"
                  :disabled="!form.gateGroup.enabled"
                  maxlength="16"
                  placeholder="退出"
                />
              </ElFormItem>
            </div>
          </div>
        </div>

        <!-- 私聊通话 -->
        <div class="dev-card">
          <div class="dev-card-title">私聊通话</div>
          <div class="dev-card-body">
            <ElFormItem label="关闭私聊语音/视频通话" class="!mb-0">
              <ElSwitch v-model="form.privateCall.disabled" />
              <div class="field-extra">开启后，用户无法在私聊中发起或接听语音、视频通话</div>
            </ElFormItem>
            <div class="call-hint mt-4">
              <ArtSvgIcon icon="ri:phone-off-line" class="shrink-0 mt-0.5" />
              <span>仅影响一对一私聊；群聊多人语音不受影响。</span>
            </div>
          </div>
        </div>

        <!-- 发送位置（高德） -->
        <div class="dev-card">
          <div class="dev-card-title">
            发送位置
            <ElTag
              class="ml-2"
              size="small"
              effect="plain"
              :type="amap.configured ? 'success' : 'info'"
            >
              {{ amap.configured ? '已配置 Key' : '未配置' }}
            </ElTag>
          </div>
          <div class="dev-card-body">
            <ElFormItem label="启用位置服务">
              <ElSwitch v-model="amap.enabled" />
              <div class="field-extra">关闭后客户端「+」面板不显示「发送位置」</div>
            </ElFormItem>

            <ElFormItem>
              <template #label>
                <span class="label-with-tip">
                  Web 服务
                  <ElTooltip placement="top" :show-after="200">
                    <template #content>
                      <div class="tip-lines">
                        <div>填写后：服务器可搜附近地点、逆地理转地址</div>
                        <div>不填：选点页附近列表/搜索不可用</div>
                      </div>
                    </template>
                    <ArtSvgIcon icon="ri:question-line" class="label-tip" />
                  </ElTooltip>
                </span>
              </template>
              <ElInput
                v-model="amap.webApiKey"
                type="password"
                show-password
                :placeholder="amap.hasKey ? '已保存，留空不修改' : '高德「Web服务」Key'"
              />
            </ElFormItem>

            <ElFormItem>
              <template #label>
                <span class="label-with-tip">
                  Web 端 (JS API)
                  <ElTooltip placement="top" :show-after="200">
                    <template #content>
                      <div class="tip-lines">
                        <div>填写后：选点页 / 查看位置可显示高德地图</div>
                        <div>不填：地图降级或无法加载官方样式</div>
                      </div>
                    </template>
                    <ArtSvgIcon icon="ri:question-line" class="label-tip" />
                  </ElTooltip>
                </span>
              </template>
              <ElInput
                v-model="amap.jsApiKey"
                type="password"
                show-password
                :placeholder="amap.hasJsKey ? '已保存，留空不修改' : '高德「Web端」Key'"
              />
            </ElFormItem>

            <ElFormItem>
              <template #label>
                <span class="label-with-tip">
                  JS 安全密钥
                  <ElTooltip placement="top" :show-after="200">
                    <template #content>
                      <div class="tip-lines">
                        <div>填写后：配合 Web 端 Key 使用官方 JS 地图（含 3D）</div>
                        <div>不填：仅有 Web 端 Key 时可能降级，地图体验变差</div>
                      </div>
                    </template>
                    <ArtSvgIcon icon="ri:question-line" class="label-tip" />
                  </ElTooltip>
                </span>
              </template>
              <ElInput
                v-model="amap.jsSecurityCode"
                type="password"
                show-password
                :placeholder="amap.hasSecurity ? '已保存，留空不修改' : '与 Web 端 Key 同一行的安全密钥'"
              />
            </ElFormItem>

            <ElFormItem>
              <template #label>
                <span class="label-with-tip">
                  Android 平台
                  <ElTooltip placement="top" :show-after="200">
                    <template #content>
                      <div class="tip-lines">
                        <div>填写后：手机可定位到「当前位置」</div>
                        <div>不填：无法自动定位（仍可手动拖地图选点，若地图 Key 已配）</div>
                        <div>需在高德控制台绑定包名 + SHA1</div>
                      </div>
                    </template>
                    <ArtSvgIcon icon="ri:question-line" class="label-tip" />
                  </ElTooltip>
                </span>
              </template>
              <ElInput
                v-model="amap.androidKey"
                type="password"
                show-password
                :placeholder="amap.hasAndroidKey ? '已保存，留空不修改' : '高德「Android平台」Key'"
              />
            </ElFormItem>

            <ElFormItem label="选点地图样式">
              <ElSelect v-model="amap.mapStyle" style="width: 100%">
                <ElOption label="远山黛（清新雅致）" value="amap://styles/whitesmoke" />
                <ElOption label="标准" value="amap://styles/normal" />
                <ElOption label="幻影黑" value="amap://styles/dark" />
                <ElOption label="月光银" value="amap://styles/light" />
                <ElOption label="草色青" value="amap://styles/fresh" />
              </ElSelect>
            </ElFormItem>

            <div class="call-hint amap-notes">
              <ArtSvgIcon icon="ri:information-line" class="shrink-0 mt-0.5" />
              <div>
                <div class="amap-notes-title">注意事项</div>
                <div>显示地图 → Web 端 Key + JS 安全密钥</div>
                <div>搜地点 / 地址解析 → Web 服务 Key</div>
                <div>定位到当前位置 → Android 平台 Key</div>
                <div>客户端不写死 Key；未配齐对应项时，该项能力不可用</div>
              </div>
            </div>

            <ElButton
              class="mt-4"
              type="primary"
              :loading="savingAmap"
              v-ripple
              @click="saveAmap"
            >
              保存位置服务
            </ElButton>
          </div>
        </div>

        <!-- 关于页（手机端）：与其它配置卡同尺寸，细节可展开 -->
        <div class="dev-card">
          <div class="dev-card-title">关于页（手机端）</div>
          <div class="dev-card-body about-card-body">
            <ElFormItem label="标语" class="!mb-2">
              <ElInput v-model="form.aboutPage.tagline" maxlength="64" placeholder="用心做好每一次聊天" />
            </ElFormItem>
            <ElFormItem label="底部版权" class="!mb-2">
              <ElInput v-model="form.aboutPage.copyright" maxlength="80" placeholder="© XhaMil · xhaoy" />
            </ElFormItem>

            <div class="about-dev-line">
              <div class="avatar-preview avatar-preview--sm" :style="{ background: '#e8eef6' }">
                <img
                  v-if="form.aboutPage.developerAvatarUrl"
                  :src="previewUrl(form.aboutPage.developerAvatarUrl)"
                  alt="开发者"
                />
                <span v-else class="avatar-placeholder">头像</span>
              </div>
              <div class="about-dev-fields">
                <ElInput
                  v-model="form.aboutPage.developerName"
                  maxlength="32"
                  placeholder="开发者名字"
                  class="!mb-1"
                />
                <ElInput
                  v-model="form.aboutPage.developerBadge"
                  maxlength="16"
                  placeholder="徽章 Dev"
                />
              </div>
              <div class="about-dev-actions">
                <ElUpload
                  :show-file-list="false"
                  accept="image/*"
                  :http-request="(opt) => onUploadAvatar(opt, 'developer')"
                  :disabled="uploadingAvatar"
                >
                  <ElButton size="small" plain :loading="uploadingAvatar">上传</ElButton>
                </ElUpload>
                <ElButton
                  v-if="form.aboutPage.developerAvatarUrl"
                  size="small"
                  plain
                  @click="form.aboutPage.developerAvatarUrl = ''"
                >
                  清
                </ElButton>
              </div>
            </div>
            <ElFormItem label="角色" class="!mb-2 !mt-2">
              <ElInput
                v-model="form.aboutPage.developerRole"
                maxlength="64"
                placeholder="全栈开发 · 独自扛下所有"
              />
            </ElFormItem>

            <ElCollapse class="about-collapse">
              <ElCollapseItem title="更多文案" name="copy">
                <ElFormItem label="致谢标题" class="!mb-2">
                  <ElInput v-model="form.aboutPage.creditsTitle" maxlength="32" placeholder="致谢" />
                </ElFormItem>
                <ElFormItem label="特别鸣谢标题" class="!mb-2">
                  <ElInput v-model="form.aboutPage.thanksTitle" maxlength="32" placeholder="特别鸣谢" />
                </ElFormItem>
                <ElFormItem label="特别鸣谢说明" class="!mb-0">
                  <ElInput
                    v-model="form.aboutPage.thanksHint"
                    maxlength="80"
                    placeholder="开发狂魔 + 测试运营双人组"
                  />
                </ElFormItem>
              </ElCollapseItem>
              <ElCollapseItem name="thanks">
                <template #title>
                  <span>特别鸣谢列表（{{ form.aboutPage.thanks.length }}）</span>
                </template>
                <div class="thanks-head">
                  <span class="field-extra">点保存全部后生效</span>
                  <ElButton size="small" type="primary" plain @click.stop="addThanks">添加</ElButton>
                </div>
                <div class="thanks-list">
                  <div v-for="(item, idx) in form.aboutPage.thanks" :key="idx" class="thanks-row">
                    <div
                      class="avatar-preview avatar-preview--xs"
                      :style="{ background: item.tint || '#2F6FED' }"
                    >
                      <img
                        v-if="item.avatarUrl"
                        :src="previewUrl(item.avatarUrl)"
                        :alt="item.name || '头像'"
                      />
                      <span v-else class="avatar-placeholder">{{
                        (item.name || '?').slice(0, 1)
                      }}</span>
                    </div>
                    <ElInput v-model="item.name" maxlength="32" placeholder="名字" />
                    <ElInput v-model="item.role" maxlength="48" placeholder="角色" />
                    <input v-model="item.tint" type="color" class="tint-picker" title="主题色" />
                    <ElUpload
                      :show-file-list="false"
                      accept="image/*"
                      :http-request="(opt) => onUploadAvatar(opt, 'thanks', idx)"
                      :disabled="uploadingAvatar"
                    >
                      <ElButton size="small" plain link :loading="uploadingAvatar">图</ElButton>
                    </ElUpload>
                    <ElButton type="danger" plain link @click="removeThanks(idx)">删</ElButton>
                  </div>
                  <div v-if="!form.aboutPage.thanks.length" class="field-extra">暂无条目</div>
                </div>
              </ElCollapseItem>
            </ElCollapse>
          </div>
        </div>
      </div>

      <ElSpace class="mt-5">
        <ElButton :loading="loading" v-ripple @click="load">重置</ElButton>
        <ElButton type="primary" :loading="saving" v-ripple @click="save">保存全部</ElButton>
      </ElSpace>
    </ElForm>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import type { UploadRequestOptions } from 'element-plus'
  import { xhamilApi } from '@/api/xhamil'
  import { mediaUrl } from '@/utils/xhamilMedia'

  defineOptions({ name: 'XhamilFunctionalDev' })

  const loading = ref(false)
  const saving = ref(false)
  const savingAmap = ref(false)
  const uploadingAvatar = ref(false)

  const amap = reactive({
    enabled: true,
    webApiKey: '',
    jsApiKey: '',
    jsSecurityCode: '',
    androidKey: '',
    hasKey: false,
    hasJsKey: false,
    hasSecurity: false,
    hasAndroidKey: false,
    mapStyle: 'amap://styles/whitesmoke',
    configured: false
  })

  function defaultForm() {
    return {
      gateGroup: {
        enabled: false,
        groupCode: '',
        title: '欢迎加入聊天室',
        content:
          '本功能适用于开发者交流或校园聊天室场景。确认后将直接进入指定群聊，无需额外申请。',
        confirmText: '进入',
        cancelText: '退出'
      },
      helpSupport: {
        title: '帮助与客服',
        content: '如有问题请联系客服。',
        qq: '',
        wechat: ''
      },
      aboutPage: {
        tagline: '用心做好每一次聊天',
        creditsTitle: '致谢',
        developerName: 'xhaoy',
        developerRole: '全栈开发 · 独自扛下所有',
        developerBadge: 'Dev',
        developerAvatarUrl: '',
        thanksTitle: '特别鸣谢',
        thanksHint: '开发狂魔 + 测试运营双人组',
        copyright: '© XhaMil · xhaoy',
        thanks: [
          { name: 'xhaoy', role: '前端开发', tint: '#2F6FED', avatarUrl: '' },
          { name: 'xhaoy', role: '后端优化', tint: '#10B981', avatarUrl: '' },
          { name: 'xhaoy', role: '产品设计', tint: '#8B5CF6', avatarUrl: '' },
          { name: 'xhaoy', role: '交互动效', tint: '#F97316', avatarUrl: '' },
          { name: 'xhaoy', role: '音视频架构', tint: '#EA4335', avatarUrl: '' },
          { name: 'xhaoy', role: '安全与性能', tint: '#06B6D4', avatarUrl: '' },
          { name: 'xhaoy', role: '运维部署', tint: '#EC4899', avatarUrl: '' },
          { name: 'xhaoy', role: '深夜修 Bug', tint: '#64748B', avatarUrl: '' },
          { name: 'fuyelk', role: '测试运营', tint: '#0EA5E9', avatarUrl: '' },
          { name: 'DOYWB🤔', role: '测试运营', tint: '#A855F7', avatarUrl: '' }
        ]
      },
      privateCall: {
        disabled: false
      }
    }
  }

  const form = reactive(defaultForm())

  function sanitizeDigits(v: string) {
    return String(v || '').replace(/\D/g, '')
  }

  function onGroupCodeInput(val: string) {
    form.gateGroup.groupCode = sanitizeDigits(val)
  }

  function normalizeThanksList(list: any): Array<{
    name: string
    role: string
    tint: string
    avatarUrl: string
  }> {
    const base = defaultForm().aboutPage.thanks
    if (!Array.isArray(list) || !list.length) return base.map((x) => ({ ...x }))
    return list.map((item) => ({
      name: String(item?.name || '').trim(),
      role: String(item?.role || '').trim(),
      tint: String(item?.tint || '#2F6FED').trim() || '#2F6FED',
      avatarUrl: String(item?.avatarUrl || '').trim()
    }))
  }

  function addThanks() {
    form.aboutPage.thanks.push({
      name: '',
      role: '',
      tint: '#2F6FED',
      avatarUrl: ''
    })
  }

  function removeThanks(idx: number) {
    form.aboutPage.thanks.splice(idx, 1)
  }

  function previewUrl(path: string) {
    return mediaUrl(path)
  }

  async function onUploadAvatar(
    opt: UploadRequestOptions,
    target: 'developer' | 'thanks',
    thanksIndex = -1
  ) {
    uploadingAvatar.value = true
    try {
      const res = await xhamilApi.uploadAboutPageAvatar(opt.file as File)
      const url = String(res?.avatarUrl || '').trim()
      if (!url) throw new Error('上传成功但未返回地址')
      if (target === 'developer') {
        form.aboutPage.developerAvatarUrl = url
      } else if (thanksIndex >= 0 && form.aboutPage.thanks[thanksIndex]) {
        form.aboutPage.thanks[thanksIndex].avatarUrl = url
      }
      opt.onSuccess?.({} as any)
    } catch (e: any) {
      opt.onError?.(e)
      ElMessage.error(e?.message || '上传失败')
    } finally {
      uploadingAvatar.value = false
    }
  }

  function applyRes(res: any) {
    const base = defaultForm()
    Object.assign(form, {
      gateGroup: {
        enabled: !!res?.gateGroup?.enabled,
        groupCode: sanitizeDigits(res?.gateGroup?.groupCode || ''),
        title: res?.gateGroup?.title || base.gateGroup.title,
        content: res?.gateGroup?.content || base.gateGroup.content,
        confirmText: res?.gateGroup?.confirmText || '进入',
        cancelText: res?.gateGroup?.cancelText || '退出'
      },
      helpSupport: {
        title: res?.helpSupport?.title || '帮助与客服',
        content: res?.helpSupport?.content || '',
        qq: res?.helpSupport?.qq || '',
        wechat: res?.helpSupport?.wechat || ''
      },
      aboutPage: {
        tagline: res?.aboutPage?.tagline || base.aboutPage.tagline,
        creditsTitle: res?.aboutPage?.creditsTitle || base.aboutPage.creditsTitle,
        developerName: res?.aboutPage?.developerName || base.aboutPage.developerName,
        developerRole: res?.aboutPage?.developerRole || base.aboutPage.developerRole,
        developerBadge: res?.aboutPage?.developerBadge || base.aboutPage.developerBadge,
        developerAvatarUrl: res?.aboutPage?.developerAvatarUrl || '',
        thanksTitle: res?.aboutPage?.thanksTitle || base.aboutPage.thanksTitle,
        thanksHint:
          res?.aboutPage?.thanksHint !== undefined && res?.aboutPage?.thanksHint !== null
            ? String(res.aboutPage.thanksHint)
            : base.aboutPage.thanksHint,
        copyright: res?.aboutPage?.copyright || base.aboutPage.copyright,
        thanks: normalizeThanksList(res?.aboutPage?.thanks)
      },
      privateCall: {
        disabled: !!res?.privateCall?.disabled
      }
    })
  }

  function validate(): string | null {
    const required: [string, string][] = [
      [form.helpSupport.title, '请填写客服弹窗标题'],
      [form.gateGroup.title, '请填写门禁弹窗标题'],
      [form.gateGroup.content, '请填写门禁弹窗内容'],
      [form.gateGroup.confirmText, '请填写门禁确认文案'],
      [form.gateGroup.cancelText, '请填写门禁取消文案'],
      [form.aboutPage.tagline, '请填写关于页标语'],
      [form.aboutPage.creditsTitle, '请填写致谢标题'],
      [form.aboutPage.developerName, '请填写开发者名字'],
      [form.aboutPage.developerRole, '请填写开发者角色'],
      [form.aboutPage.developerBadge, '请填写徽章文案'],
      [form.aboutPage.thanksTitle, '请填写特别鸣谢标题'],
      [form.aboutPage.copyright, '请填写底部版权']
    ]
    for (const [val, msg] of required) {
      if (!String(val || '').trim()) return msg
    }
    if (form.gateGroup.enabled && !form.gateGroup.groupCode) {
      return '启用门禁时请填写群号'
    }
    for (let i = 0; i < form.aboutPage.thanks.length; i++) {
      const item = form.aboutPage.thanks[i]
      if (!String(item.name || '').trim()) return `特别鸣谢第 ${i + 1} 项请填写名字`
      if (!String(item.role || '').trim()) return `特别鸣谢第 ${i + 1} 项请填写角色`
    }
    return null
  }

  async function loadAmap() {
    try {
      const res = await xhamilApi.getAmapConfig()
      amap.enabled = res?.amapEnabled !== false && res?.enabled !== false
      amap.hasKey = !!res?.hasWebApiKey
      amap.hasJsKey = !!res?.hasJsApiKey
      amap.hasSecurity = !!res?.hasJsSecurityCode
      amap.hasAndroidKey = !!res?.hasAndroidKey
      amap.configured = !!res?.configured
      amap.mapStyle = String(res?.amapMapStyle || '').trim() || 'amap://styles/whitesmoke'
      amap.webApiKey = ''
      amap.jsApiKey = ''
      amap.jsSecurityCode = ''
      amap.androidKey = ''
    } catch {
      /* ignore */
    }
  }

  async function saveAmap() {
    savingAmap.value = true
    try {
      const body: Record<string, unknown> = {
        amapEnabled: !!amap.enabled,
        amapMapStyle: String(amap.mapStyle || '').trim() || 'amap://styles/whitesmoke'
      }
      if (String(amap.webApiKey || '').trim()) body.amapWebApiKey = String(amap.webApiKey).trim()
      if (String(amap.jsApiKey || '').trim()) body.amapJsApiKey = String(amap.jsApiKey).trim()
      if (String(amap.jsSecurityCode || '').trim()) {
        body.amapJsSecurityCode = String(amap.jsSecurityCode).trim()
      }
      if (String(amap.androidKey || '').trim()) body.amapAndroidKey = String(amap.androidKey).trim()
      const res = await xhamilApi.saveAmapConfig(body)
      amap.enabled = res?.amapEnabled !== false && res?.enabled !== false
      amap.hasKey = !!res?.hasWebApiKey
      amap.hasJsKey = !!res?.hasJsApiKey
      amap.hasSecurity = !!res?.hasJsSecurityCode
      amap.hasAndroidKey = !!res?.hasAndroidKey
      amap.configured = !!res?.configured
      amap.mapStyle = String(res?.amapMapStyle || '').trim() || 'amap://styles/whitesmoke'
      amap.webApiKey = ''
      amap.jsApiKey = ''
      amap.jsSecurityCode = ''
      amap.androidKey = ''
      ElMessage.success('位置服务配置已保存')
    } finally {
      savingAmap.value = false
    }
  }

  async function load() {
    loading.value = true
    try {
      applyRes(await xhamilApi.getFrontendConfig())
      await loadAmap()
    } finally {
      loading.value = false
    }
  }

  async function save() {
    const err = validate()
    if (err) {
      ElMessage.warning(err)
      return
    }
    saving.value = true
    try {
      const payload = {
        gateGroup: {
          ...form.gateGroup,
          groupCode: sanitizeDigits(form.gateGroup.groupCode)
        },
        helpSupport: { ...form.helpSupport },
        aboutPage: {
          ...form.aboutPage,
          thanks: form.aboutPage.thanks.map((item) => ({ ...item }))
        },
        privateCall: { ...form.privateCall }
      }
      const res = await xhamilApi.setFrontendConfig(payload)
      applyRes(res)
      ElMessage.success('配置已保存')
    } finally {
      saving.value = false
    }
  }

  onMounted(load)
</script>

<style scoped lang="scss">
  .card-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    width: 100%;
  }

  .dev-card {
    width: auto;
    min-width: 0;
    height: 480px;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    overflow: hidden;
  }

  .about-card-body {
    display: flex;
    flex-direction: column;
  }

  .about-dev-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .about-dev-fields {
    flex: 1;
    min-width: 0;
  }

  .about-dev-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .about-collapse {
    border: none;
    --el-collapse-header-height: 36px;

    :deep(.el-collapse-item__header) {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-regular);
      background: transparent;
      border-bottom-color: var(--el-border-color-lighter);
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
      background: transparent;
    }

    :deep(.el-collapse-item__content) {
      padding-bottom: 8px;
    }
  }

  .avatar-preview {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .avatar-preview--sm {
    width: 40px;
    height: 40px;
  }

  .avatar-preview--xs {
    width: 28px;
    height: 28px;
  }

  .avatar-placeholder {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-weight: 600;
  }

  .thanks-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .thanks-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow: auto;
  }

  .thanks-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 24px auto auto;
    gap: 4px;
    align-items: center;
  }

  .tint-picker {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }

  .dev-card-title {
    flex-shrink: 0;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .dev-card-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  .dev-card-body :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  .dev-card-body :deep(.el-form-item__label) {
    margin-bottom: 4px !important;
    line-height: 1.3;
  }

  .field-extra {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }

  .label-with-tip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .label-tip {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    cursor: help;
    outline: none;
  }

  .label-tip:hover {
    color: var(--el-color-primary);
  }

  .tip-lines {
    line-height: 1.55;
    max-width: 280px;
  }

  .amap-notes {
    margin-top: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--el-fill-color-light);
  }

  .amap-notes-title {
    font-weight: 600;
    color: var(--el-text-color-regular);
    margin-bottom: 4px;
  }

  .call-hint {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: #888;
  }

  @media (max-width: 1400px) {
    .card-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 1100px) {
    .card-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .card-row {
      grid-template-columns: 1fr;
    }

    .dev-card {
      height: auto;
      min-height: 320px;
    }

    .thanks-row {
      grid-template-columns: 28px 1fr auto;
    }
  }
</style>
