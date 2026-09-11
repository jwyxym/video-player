# @jwyxym/video-player

A Vue 3 video player with HLS playback, configurable playback rates, custom controls, and fullscreen events.

## Install

```bash
npm install @jwyxym/video-player
```

## Usage

```vue
<script setup lang="ts">
import VideoPlayer from '@jwyxym/video-player'
import '@jwyxym/video-player/style.css'

function onDownload() {
  // Implement downloading in the host application.
}
</script>

<template>
  <VideoPlayer
    src="https://example.com/video.m3u8"
    :download="true"
    :loop="true"
    :controls-hide-delay="3000"
    :playback-rates="[0.5, 1, 1.5, 2, 3, 4, 5]"
    @download="onDownload"
  />
</template>
```

## Screen orientation

```ts
import { lockLandscape, unlockOrientation } from '@jwyxym/video-player'

// Call after entering fullscreen. Returns false if unsupported or denied.
const locked = await lockLandscape()

// Restore the device's default orientation behavior (not forced portrait).
const unlocked = unlockOrientation()
```

These functions do not enter or exit fullscreen automatically.

### 配合全屏事件自动横屏

通过 `@enter-fullscreen` 和 `@exit-fullscreen` 分别处理进入和退出全屏。
组件内部兼容标准和 WebKit 全屏事件，同一次状态变化只触发一次；系统返回键或 Esc
退出全屏也会触发退出事件。回调可选接收浏览器原始 `Event`，无需自行判断全屏状态。
旧的 `@fullscreenchange` / `@webkitfullscreenchange` 组件事件已被这两个事件替代。

```vue
<script setup lang="ts">
import VideoPlayer, {
  lockLandscape,
  unlockOrientation,
} from '@jwyxym/video-player'
import '@jwyxym/video-player/style.css'

let requestId = 0

async function onEnterFullscreen() {
  const currentRequest = ++requestId
  const locked = await lockLandscape()
  // 等待锁定时可能已经退出全屏，忽略过期结果。
  if (currentRequest !== requestId) return
  if (!locked) console.info('无法锁定横屏，请手动旋转设备')
}

function onExitFullscreen() {
  ++requestId
  unlockOrientation()
}
</script>

<template>
  <VideoPlayer
    src="https://example.com/video.mp4"
    @enter-fullscreen="onEnterFullscreen"
    @exit-fullscreen="onExitFullscreen"
  />
</template>
```

`lockLandscape()` 返回 `Promise<boolean>`；不支持或被浏览器拒绝时返回 `false`。
`unlockOrientation()` 返回 `boolean`，解除方向锁定并恢复设备默认行为，不是强制竖屏。
这两个函数不会主动进入或退出全屏。上例适用于单个播放器；多个播放器应各自维护回调状态。