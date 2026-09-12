<template>
	<div ref="player" class="player" :class="{ 'is-playing': isPlaying, 'is-fullscreen': isFullscreen, 'controls-visible': controlsVisible }" @pointermove="onPointerMove" @fullscreenchange="onFullscreenChange" @webkitfullscreenchange="onFullscreenChange">
		<video ref="video" class="player__video" :loop="props.loop" playsinline preload="metadata" @play="isPlaying = true" @pause="isPlaying = false" @loadedmetadata="syncDuration" @durationchange="syncDuration" @progress="syncDuration" @timeupdate="syncProgress" @seeked="syncProgress" @pointerdown="startSwipe" @pointermove="moveSwipe" @pointerup="endSwipe" @pointercancel="cancelSwipe" @lostpointercapture="cancelSwipe" @click="onVideoClick" @dblclick.prevent />
		<div v-if="isScrubbing" class="player__seek-preview"><div>{{ formatSeekDelta(seekDelta) }}</div><div>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div></div>

		<div class="player__controls" aria-label="Video controls" :aria-hidden="!controlsVisible" @pointerdown="onControlsPointerDown" @click="restartControlsTimer" @input="restartControlsTimer" @change="restartControlsTimer" @keydown="restartControlsTimer">
			<button class="control-button control-button--primary" type="button" :aria-label="isPlaying ? 'Pause' : 'Play'" @click="togglePlayback"><span v-if="isPlaying">&#10074;&#10074;</span><span v-else>&#9654;</span></button>
			<span class="player__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
			<input class="player__progress" type="range" min="0" :max="duration || 0" :disabled="duration <= 0" step="0.1" :value="currentTime" aria-label="Playback progress" @pointerdown="startProgressSeek" @input="previewSeek" @change="commitSeek" />
			<button class="control-button" type="button" :aria-label="isMuted ? 'Unmute' : 'Mute'" @click="toggleMute"><span v-if="isMuted">&#128263;</span><span v-else>&#128266;</span></button>
			<label class="sr-only" for="player-volume">Volume</label>
			<input id="player-volume" class="player__volume" type="range" min="0" max="1" step="0.05" :value="volume" @input="setVolume" />
			<label class="sr-only" for="player-rate">Playback speed</label>
			<select id="player-rate" v-model.number="playbackRate" class="player__rate" aria-label="Playback speed"><option v-for="rate in validPlaybackRates" :key="rate" :value="rate">{{ rate }}x</option></select>
			<button v-if="download" class="control-button" type="button" aria-label="Download video" title="Download video" @click="emit('download', $event)">&#8681;</button>
			<button class="control-button" type="button" :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'" :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="toggleFullscreen">&#9974;</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import Hls from 'hls.js';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

type WebkitFullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => void;
};

const props = withDefaults(defineProps<{
	src: string;
	download?: boolean;
	/** 是否在播放结束后自动循环。 */
	loop?: boolean;
	playbackRates?: number[];
	/** 控制条无操作后隐藏的时间（毫秒），0 表示禁用自动隐藏。 */
	controlsHideDelay?: number;
}>(), {
	download: false,
	loop: false,
	controlsHideDelay: 3000,
	playbackRates: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
});

const emit = defineEmits<{
	(e: 'download', event: MouseEvent): void;
	(e: 'enter-fullscreen', event: Event): void;
	(e: 'exit-fullscreen', event: Event): void;
}>();

const video = ref<HTMLVideoElement | null>(null);
const player = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const volume = ref(1);
const currentTime = ref(0);
const duration = ref(0);
const isScrubbing = ref(false);
const seekStartTime = ref(0);
const seekDelta = computed(() => Math.round(currentTime.value - seekStartTime.value));
const playbackRate = ref(1);
const validPlaybackRates = computed(() => {
	const rates = props.playbackRates.filter(rate => Number.isFinite(rate) && rate > 0);
	return rates.length ? [...new Set(rates)] : [1];
});
let hls: Hls | undefined;
const controlsVisible = ref(true);
let controlsTimer: ReturnType<typeof setTimeout> | undefined;
let singleClickTimer: ReturnType<typeof setTimeout> | undefined;
let lastClick: { time: number; x: number; y: number } | undefined;
let controlsPressed = false;
const swiping = ref(false);
let swipe: { id: number; x: number; y: number; time: number; width: number; span: number } | undefined;
let suppressVideoClick = false;

function startSwipe(event: PointerEvent) {
	if (swipe) return;
	suppressVideoClick = false;
	if (event.pointerType === 'mouse' || !event.isPrimary || !video.value) return;
	syncDuration();
	if (duration.value <= 0) return;
	swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, time: video.value.currentTime,
		width: Math.max(1, video.value.getBoundingClientRect().width), span: Math.min(duration.value, 120) };
	video.value.setPointerCapture(event.pointerId);
	clearControlsTimer();
}
function moveSwipe(event: PointerEvent) {
	if (!swipe || event.pointerId !== swipe.id) return;
	const dx = event.clientX - swipe.x;
	const dy = event.clientY - swipe.y;
	if (!swiping.value) {
		if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
		suppressVideoClick = true;
		clearTimeout(singleClickTimer);
		lastClick = undefined;
		if (Math.abs(dy) >= Math.abs(dx)) { cancelSwipe(); return; }
		swiping.value = true;
		seekStartTime.value = swipe.time;
		isScrubbing.value = true;
		controlsVisible.value = true;
	}
	event.preventDefault();
	currentTime.value = Math.max(0, Math.min(duration.value, swipe.time + dx / swipe.width * swipe.span));
}
function finishSwipe(commit: boolean) {
	if (!swipe) return;
	const id = swipe.id;
	swipe = undefined;
	if (swiping.value) {
		if (commit) commitSeek();
		else { isScrubbing.value = false; syncProgress(); }
	}
	swiping.value = false;
	if (video.value?.hasPointerCapture(id)) video.value.releasePointerCapture(id);
	restartControlsTimer();
}
function endSwipe(event: PointerEvent) {
	if (event.pointerId !== swipe?.id) return;
	moveSwipe(event);
	finishSwipe(true);
}
function cancelSwipe(event?: PointerEvent) {
	if (event && event.pointerId !== swipe?.id) return;
	finishSwipe(false);
}

function clearControlsTimer() {
	clearTimeout(controlsTimer);
	controlsTimer = undefined;
}
function restartControlsTimer() {
	clearControlsTimer();
	if (!isFullscreen.value) {
		controlsVisible.value = true;
		return;
	}
	if (!controlsVisible.value || controlsPressed || swipe || !Number.isFinite(props.controlsHideDelay) || props.controlsHideDelay <= 0) return;
	controlsTimer = setTimeout(() => {
		controlsVisible.value = false;
	}, props.controlsHideDelay);
}
function toggleControls() {
	if (!isFullscreen.value) {
		controlsVisible.value = true;
		return;
	}
	controlsVisible.value = !controlsVisible.value;
	restartControlsTimer();
}
function onVideoClick(event: MouseEvent) {
	if (suppressVideoClick) { suppressVideoClick = false; return; }
	const now = performance.now();
	const isDoubleClick = lastClick && now - lastClick.time < 300
		&& Math.hypot(event.clientX - lastClick.x, event.clientY - lastClick.y) < 40;
	clearTimeout(singleClickTimer);
	if (isDoubleClick) {
		lastClick = undefined;
		togglePlayback();
		restartControlsTimer();
	} else {
		// Two taps also work on touch browsers that do not dispatch dblclick.
		if (lastClick) toggleControls();
		lastClick = { time: now, x: event.clientX, y: event.clientY };
		clearControlsTimer();
		singleClickTimer = setTimeout(() => {
			lastClick = undefined;
			toggleControls();
		}, 300);
	}
}
function onPointerMove(event: PointerEvent) {
	if (event.pointerType === 'mouse') restartControlsTimer();
}
function onControlsPointerDown() {
	controlsPressed = true;
	clearControlsTimer();
}
function onControlsPointerUp() {
	if (!controlsPressed) return;
	commitSeek();
	controlsPressed = false;
	restartControlsTimer();
}

function loadSource() {
	if (!video.value) return;
	cancelSwipe();
	isScrubbing.value = false;
	currentTime.value = 0;
	duration.value = 0;
	hls?.destroy();
	hls = undefined;
	if (props.src.includes('m3u8') && Hls.isSupported()) {
		hls = new Hls();
		hls.loadSource(props.src);
		hls.attachMedia(video.value);
		hls.on(Hls.Events.ERROR, (_, data) => console.error('HLS error:', data));
	} else video.value.src = props.src;
}
function togglePlayback() {
	if (!video.value) return;
	if (video.value.paused) void video.value.play().catch(error => console.error('Playback failed:', error));
	else video.value.pause();
}
function toggleMute() {
	if (!video.value) return;
	video.value.muted = !video.value.muted;
	isMuted.value = video.value.muted;
}
function setVolume(event: Event) {
	if (!video.value) return;
	volume.value = Number((event.target as HTMLInputElement).value);
	video.value.volume = volume.value;
	video.value.muted = volume.value === 0;
	isMuted.value = video.value.muted;
}
function startProgressSeek() {
	if (!video.value || duration.value <= 0) return;
	seekStartTime.value = video.value.currentTime;
	currentTime.value = seekStartTime.value;
	isScrubbing.value = true;
}
function previewSeek(event: Event) {
	const value = Number((event.target as HTMLInputElement).value);
	if (!Number.isFinite(value) || duration.value <= 0) return;
	if (!isScrubbing.value) startProgressSeek();
	currentTime.value = Math.max(0, Math.min(value, duration.value));
	// Keyboard input has no pointerup; apply it immediately.
	if (!controlsPressed) commitSeek();
}
function commitSeek() {
	if (!isScrubbing.value || !video.value) return;
	isScrubbing.value = false;
	try {
		video.value.currentTime = currentTime.value;
	} catch (error) {
		syncProgress();
		console.error('Seek failed:', error);
	}
}
function syncDuration() {
	const media = video.value;
	if (!media) return;
	if (Number.isFinite(media.duration) && media.duration > 0) {
		duration.value = media.duration;
	} else {
		duration.value = media.seekable.length ? media.seekable.end(media.seekable.length - 1) : 0;
	}
}
function syncProgress() {
	syncDuration();
	if (!isScrubbing.value && !video.value?.seeking) currentTime.value = video.value?.currentTime ?? 0;
}
function formatSeekDelta(seconds: number) {
	if (!Number.isFinite(seconds)) return '+0秒';
	const rounded = Math.round(seconds);
	let remaining = Math.abs(rounded);
	const units: [string, number][] = [
		['时', 60 * 60],
		['分', 60],
		['秒', 1],
	];
	const parts: string[] = [];
	for (const [label, size] of units) {
		const value = Math.floor(remaining / size);
		if (value > 0) parts.push(`${value}${label}`);
		remaining %= size;
	}
	return `${rounded < 0 ? '-' : '+'}${parts.join('') || '0秒'}`;
}
function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) return '0:00';
	return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
function onFullscreenChange(event: Event) {
	const fullscreenDocument = document as WebkitFullscreenDocument;
	const element = fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement;
	const active = Boolean(player.value && element === player.value);
	if (active === isFullscreen.value) return;
	isFullscreen.value = active;
	if (!isFullscreen.value) cancelSwipe();
	restartControlsTimer();
	if (active) emit('enter-fullscreen', event);
	else emit('exit-fullscreen', event);
}
/** 请求当前播放器进入全屏；不支持或请求失败时返回 false。 */
async function enterFullscreen(): Promise<boolean> {
	const element = player.value as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
	const fullscreenDocument = document as WebkitFullscreenDocument;
	if (!element) return false;
	if ((fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement) === element) return true;
	try {
		if (element.requestFullscreen) {
			await element.requestFullscreen();
		} else if (element.webkitRequestFullscreen) {
			await element.webkitRequestFullscreen();
		} else return false;
		return true;
	} catch (error) {
		console.error('Fullscreen request failed:', error);
		return false;
	}
}

/** 仅退出当前播放器的全屏，不干预其他元素。 */
async function exitFullscreen(): Promise<boolean> {
	const element = player.value;
	if (!element) return false;
	const doc = document as WebkitFullscreenDocument;
	try {
		if (doc.fullscreenElement === element) {
			await doc.exitFullscreen();
		} else if (doc.webkitFullscreenElement === element) {
			if (!doc.webkitExitFullscreen) return false;
			await doc.webkitExitFullscreen();
		}
		return true;
	} catch (error) {
		console.error('Exit fullscreen failed:', error);
		return false;
	}
}

async function toggleFullscreen(): Promise<boolean> {
	if (!player.value) return false;
	const doc = document as WebkitFullscreenDocument;
	return (doc.fullscreenElement || doc.webkitFullscreenElement) === player.value
		? exitFullscreen() : enterFullscreen();
}

defineExpose({ enterFullscreen, exitFullscreen, toggleFullscreen });

watch(playbackRate, rate => { if (video.value) video.value.playbackRate = rate; });
watch(() => props.src, loadSource);
watch(() => props.controlsHideDelay, restartControlsTimer);
onMounted(() => {
	loadSource();
	restartControlsTimer();
	window.addEventListener('pointerup', onControlsPointerUp);
	window.addEventListener('pointercancel', onControlsPointerUp);
});
onUnmounted(() => {
	cancelSwipe();
	hls?.destroy();
	clearControlsTimer();
	clearTimeout(singleClickTimer);
	window.removeEventListener('pointerup', onControlsPointerUp);
	window.removeEventListener('pointercancel', onControlsPointerUp);
});
</script>

<style scoped>
.player { position: relative; overflow: hidden; width: 100%; border-radius: 14px; background: #000; box-shadow: 0 16px 40px rgb(0 0 0 / 35%); color: #fff; -webkit-tap-highlight-color: transparent; }
.player__video { display: block; width: 100%; max-height: 80vh; background: #000; cursor: pointer; touch-action: pan-y pinch-zoom; }
.player.is-fullscreen { width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
.player.is-fullscreen .player__video { width: 100%; height: 100%; max-height: none; object-fit: contain; }
.player.is-fullscreen .player__video { touch-action: none; }
.player__seek-preview { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 12px 20px; border-radius: 8px; background: rgb(0 0 0 / 75%); color: #fff; font-variant-numeric: tabular-nums; pointer-events: none; text-align: center; line-height: 1.6; }
.player.is-fullscreen .player__controls { z-index: 1; }
.player__controls { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; gap: 10px; padding: 30px 16px 14px; background: linear-gradient(transparent, #000 55%); color: #fff; opacity: 0; transform: translateY(8px); transition: opacity .2s ease, transform .2s ease; }
.player__controls { visibility: hidden; pointer-events: none; }
.player.controls-visible .player__controls { visibility: visible; pointer-events: auto; opacity: 1; transform: translateY(0); }
.player__progress, .player__volume { touch-action: none; height: 32px; margin-block: 0; }
.control-button, .player__rate { display: inline-grid; place-items: center; min-width: 34px; height: 34px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: #fff; font: inherit; cursor: pointer; }
.control-button:hover, .control-button:focus-visible, .player__rate:hover, .player__rate:focus-visible { outline: none; background: rgb(255 255 255 / 18%); }.control-button--primary { background: #3b82f6; font-size: 13px; }.control-button--primary:hover { background: #2563eb; }
.player__time { flex: none; min-width: 82px; color: #fff; font-size: 12px; font-variant-numeric: tabular-nums; }.player__progress, .player__volume { accent-color: #fff; }.player__progress { flex: 1; min-width: 40px; }.player__volume { width: 72px; }.player__rate { appearance: auto; background: #000; color: #fff; border: 1px solid #555; font-size: 13px; }.player__rate option { background: #000; color: #fff; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 640px) { .player__controls { gap: 6px; padding: 8px; }.player__time, .player__volume { display: none; }.control-button, .player__rate { min-width: 30px; height: 30px; padding: 0 6px; font-size: 11px; } }
</style>
