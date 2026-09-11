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
    :playback-rates="[0.5, 1, 1.5, 2, 3, 4, 5]"
    @download="onDownload"
  />
</template>
```
