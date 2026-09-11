<script setup lang="ts">
import { ref } from 'vue';
import Player, { lockLandscape, unlockOrientation } from './index';

const showDownload = ref(true);
const fullscreenEvent = ref('尚未触发全屏事件');
const downloadEvent = ref('尚未点击下载按钮');
const orientationStatus = ref('进入全屏后尝试锁定横屏');
let orientationRequest = 0;
const videoUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

async function onEnterFullscreen() {
	fullscreenEvent.value = '已进入全屏';
	const request = ++orientationRequest;
	const locked = await lockLandscape();
	if (request !== orientationRequest) return;
	orientationStatus.value = locked ? '已锁定横屏' : '浏览器未允许锁定横屏，可手动旋转设备';
}

function onExitFullscreen() {
	++orientationRequest;
	fullscreenEvent.value = '已退出全屏';
	const unlocked = unlockOrientation();
	orientationStatus.value = unlocked ? '已解除方向锁定' : '浏览器不支持或未允许解除方向锁定';
}

function onDownload() {
	downloadEvent.value = '已触发 download 事件';
}
</script>

<template>
	<main class="demo">
		<section class="demo__card">
			<div class="demo__heading">
				<p class="demo__eyebrow">VIDEO PLAYER</p>
				<h1>视频播放器组件示例</h1>
				<p>演示自定义倍速、可选下载按钮，以及全屏事件透传。</p>
			</div>

			<Player
				:src="videoUrl"
				:download="showDownload"
				:controls-hide-delay="3000"
				:playback-rates="[0.5, 1, 1.5, 2, 3, 4, 5]"
				loop
				@download="onDownload"
				@enter-fullscreen="onEnterFullscreen"
				@exit-fullscreen="onExitFullscreen"
			/>

			<div class="demo__options">
				<label class="demo__switch">
					<input v-model="showDownload" type="checkbox" />
					<span>显示下载按钮</span>
				</label>
				<div class="demo__events"><p class="demo__event">{{ fullscreenEvent }}</p><p class="demo__event">{{ orientationStatus }}</p><p class="demo__event">{{ downloadEvent }}</p></div>
			</div>

			<pre class="demo__code">&lt;Player
  :src="videoUrl"
  :download="true"
  :controls-hide-delay="3000"
  :playback-rates="[0.5, 1, 1.5, 2, 3, 4, 5]"
  @download="onDownload"
  @enter-fullscreen="onEnterFullscreen"
  @exit-fullscreen="onExitFullscreen"
/&gt;</pre>
		</section>
	</main>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) { min-width: 320px; margin: 0; background: #eef3ff; color: #172033; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.demo { min-height: 100vh; padding: 48px 20px; background: radial-gradient(circle at top right, #c7d9ff, transparent 38%), #eef3ff; }
.demo__card { width: min(900px, 100%); margin: auto; padding: clamp(20px, 5vw, 44px); border: 1px solid rgb(255 255 255 / 75%); border-radius: 24px; background: rgb(255 255 255 / 82%); box-shadow: 0 24px 70px rgb(40 67 125 / 15%); backdrop-filter: blur(12px); }
.demo__heading { margin-bottom: 28px; }.demo__heading h1 { margin: 4px 0 8px; font-size: clamp(26px, 5vw, 38px); }.demo__heading p { margin: 0; color: #64748b; }.demo__eyebrow { color: #2563eb !important; font-size: 12px; font-weight: 800; letter-spacing: .12em; }
.demo__options { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: #f5f8ff; }.demo__switch { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }.demo__switch input { width: 16px; height: 16px; accent-color: #2563eb; }.demo__events { display: grid; gap: 4px; }.demo__event { margin: 0; color: #475569; font-size: 13px; text-align: right; }.demo__code { overflow-x: auto; margin: 18px 0 0; padding: 18px; border-radius: 12px; background: #172033; color: #dbeafe; font: 13px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
@media (max-width: 600px) { .demo { padding: 20px 12px; }.demo__options { align-items: flex-start; flex-direction: column; }.demo__event { text-align: left; } }
</style>
