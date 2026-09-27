<!-- 说说视频管理：与聊天视频分目录 -->
<template>
  <MediaBrowser
    title="说说视频"
    subtitle="说说里的视频，目录与聊天视频分开，不参与 25 天聊天清理"
    kind="video"
    :load-fn="loadFn"
    :delete-fn="deleteFn"
    :delete-all-fn="deleteAllFn"
  />
</template>

<script setup lang="ts">
  import { xhamilApi } from '@/api/xhamil'
  import MediaBrowser from '../media/MediaBrowser.vue'

  defineOptions({ name: 'XhamilMomentsVideos' })

  const loadFn = () => xhamilApi.getMomentsVideos()
  const deleteFn = (filename: string) => xhamilApi.deleteMomentsVideo(filename)
  const deleteAllFn = () => xhamilApi.deleteAllMomentsVideos()
</script>
