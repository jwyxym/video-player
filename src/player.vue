<template>
	<div ref="player" class="player" :class="{ 'is-playing': isPlaying, 'is-fullscreen': isFullscreen }" @fullscreenchange="onFullscreenChange" @webkitfullscreenchange="onWebkitFullscreenChange">
		<video ref="video" class="player__video" playsinline preload="metadata" @play="isPlaying = true" @pause="isPlaying = false" @loadedmetadata="syncDuration" @timeupdate="syncProgress" @click="togglePlayback" />

		<div class="player__controls" aria-label="Video controls">
			<button class="control-button control-button--primary" type="button" :aria-label="isPlaying ? 'Pause' : 'Play'" @click="togglePlayback"><span v-if="isPlaying">&#10074;&#10074;</span><span v-else>&#9654;</span></button>
			<span class="player__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
			<input class="player__progress" type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime" aria-label="Playback progress" @input="seek" />
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
	playbackRates?: number[];
}>(), {
	download: false,
	playbackRates: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
});

const emit = defineEmits<{
	(e: 'download', event: MouseEvent): void;
	(e: 'fullscreenchange', event: Event): void;
	(e: 'webkitfullscreenchange', event: Event): void;
}>();

const video = ref<HTMLVideoElement | null>(null);
const player = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const volume = ref(1);
const currentTime = ref(0);
const duration = ref(0);
const playbackRate = ref(1);
const validPlaybackRates = computed(() => {
	const rates = props.playbackRates.filter(rate => Number.isFinite(rate) && rate > 0);
	return rates.length ? [...new Set(rates)] : [1];
});
let hls: Hls | undefined;

function loadSource() {
	if (!video.value) return;
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
	void (video.value.paused ? video.value.play() : video.value.pause());
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
function seek(event: Event) {
	if (video.value) video.value.currentTime = Number((event.target as HTMLInputElement).value);
}
function syncDuration() { duration.value = Number.isFinite(video.value?.duration) ? video.value!.duration : 0; }
function syncProgress() { currentTime.value = video.value?.currentTime ?? 0; }
function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) return '0:00';
	return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
function syncFullscreen() {
	const fullscreenDocument = document as WebkitFullscreenDocument;
	isFullscreen.value = (fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement) === player.value;
}
function onFullscreenChange(event: Event) {
	syncFullscreen();
	emit('fullscreenchange', event);
}
function onWebkitFullscreenChange(event: Event) {
	syncFullscreen();
	emit('webkitfullscreenchange', event);
}
async function toggleFullscreen() {
	const element = player.value as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
	const fullscreenDocument = document as WebkitFullscreenDocument;
	if (!element) return;
	try {
		if (fullscreenDocument.fullscreenElement === element) {
			await document.exitFullscreen();
		} else if (fullscreenDocument.webkitFullscreenElement === element) {
			await fullscreenDocument.webkitExitFullscreen?.();
		} else if (element.requestFullscreen) {
			await element.requestFullscreen();
		} else if (element.webkitRequestFullscreen) {
			await element.webkitRequestFullscreen();
		}
	} catch (error) {
		console.error('Fullscreen request failed:', error);
	}
}

watch(playbackRate, rate => { if (video.value) video.value.playbackRate = rate; });
watch(() => props.src, loadSource);
onMounted(() => {
	loadSource();
});
onUnmounted(() => hls?.destroy());
</script>

<style scoped>
.player { position: relative; overflow: hidden; width: 100%; border-radius: 14px; background: #000; box-shadow: 0 16px 40px rgb(0 0 0 / 35%); color: #fff; }
.player__video { display: block; width: 100%; max-height: 80vh; background: #000; cursor: pointer; }
.player.is-fullscreen { width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
.player.is-fullscreen .player__video { width: 100%; height: 100%; max-height: none; object-fit: contain; }
.player.is-fullscreen .player__controls { z-index: 1; }
@media (hover: none) { .player .player__controls { opacity: 1; transform: none; } }
.player__controls { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; gap: 10px; padding: 30px 16px 14px; background: linear-gradient(transparent, #000 55%); color: #fff; opacity: 0; transform: translateY(8px); transition: opacity .2s ease, transform .2s ease; }
.player:hover .player__controls, .player:focus-within .player__controls, .player:not(.is-playing) .player__controls { opacity: 1; transform: translateY(0); }
.control-button, .player__rate { display: inline-grid; place-items: center; min-width: 34px; height: 34px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: #fff; font: inherit; cursor: pointer; }
.control-button:hover, .control-button:focus-visible, .player__rate:hover, .player__rate:focus-visible { outline: none; background: rgb(255 255 255 / 18%); }.control-button--primary { background: #3b82f6; font-size: 13px; }.control-button--primary:hover { background: #2563eb; }
.player__time { flex: none; min-width: 82px; color: #fff; font-size: 12px; font-variant-numeric: tabular-nums; }.player__progress, .player__volume { accent-color: #fff; }.player__progress { flex: 1; min-width: 40px; }.player__volume { width: 72px; }.player__rate { appearance: auto; background: #000; color: #fff; border: 1px solid #555; font-size: 13px; }.player__rate option { background: #000; color: #fff; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 640px) { .player__controls { gap: 6px; padding: 8px; }.player__time, .player__volume { display: none; }.control-button, .player__rate { min-width: 30px; height: 30px; padding: 0 6px; font-size: 11px; } }
</style>
