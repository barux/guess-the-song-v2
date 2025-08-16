<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { searchDeezerTracksPaged } from '../services/deezer'
import TomSelect from 'tom-select'
import confetti from 'canvas-confetti'
import 'tom-select/dist/css/tom-select.css'

type Song = {
	title: string
	artist?: string
	url: string
	cover?: string
}

const songs = ref<Song[]>([])

const snippetDurationsSeconds = [1, 5, 9, 14, 19]

const attemptsUsed = ref(0)
const currentSong = ref<Song | null>(null)
const lastSongUrl = ref<string | null>(null)
const selectedArtist = ref<'Lady Gaga' | 'Panic! at the Disco' | 'The Weeknd' | 'Bresh' | 'Leon Faun' | 'Olly' | 'Lazza' | 'Bad Bunny'>('Lady Gaga')
const userGuess = ref('')
const feedback = ref('')
const hasEnded = ref(false)
const audioEl = ref<HTMLAudioElement | null>(null)
const tomSelectEl = ref<HTMLInputElement | null>(null)
let tom: any = null
const guesses = ref<{ text: string, correct: boolean, snippet: number }[]>([])
const volume = ref(0.4)
const progressMs = ref(0)
let rafId: number | null = null
const isCelebrating = ref(false)
const celebrateItems = ref<{ id: number, emoji: string, left: string, delayMs: number, durationMs: number, rotate: number }[]>([])

const attemptsLeft = computed(() => 5 - attemptsUsed.value)
const currentSnippetSeconds = computed(() => snippetDurationsSeconds[Math.min(attemptsUsed.value, snippetDurationsSeconds.length - 1)])
const playableSongs = computed(() => songs.value.filter(s => canPlayUrl(s.url)))
const selectOptions = computed(() => playableSongs.value.map(s => ({ value: s.title, text: `${s.title}${s.artist ? ' — ' + s.artist : ''}` })))

function getPathname(url: string): string {
	try {
		return new URL(url).pathname
	} catch {
		return url.split('?')[0]
	}
}

function getMimeFromUrl(url: string): string {
	const path = getPathname(url)
	if (path.endsWith('.ogg')) return 'audio/ogg'
	if (path.endsWith('.mp3')) return 'audio/mpeg'
	return ''
}

function canPlayUrl(url: string): boolean {
	const mime = getMimeFromUrl(url)
	const probe = document.createElement('audio')
	if (!probe || !probe.canPlayType || !mime) return true
	return probe.canPlayType(mime) !== ''
}

function pickRandomSong() {
	const pool = playableSongs.value.length ? playableSongs.value : songs.value
	if (pool.length === 0) {
		currentSong.value = null
		return
	}
	if (pool.length === 1) {
		currentSong.value = pool[0]
		lastSongUrl.value = currentSong.value.url
		return
	}
	let candidate: Song | null = null
	do {
		candidate = pool[Math.floor(Math.random() * pool.length)]
	} while (candidate.url === lastSongUrl.value)
	currentSong.value = candidate
	lastSongUrl.value = candidate.url
}

function resetGame() {
	attemptsUsed.value = 0
	userGuess.value = ''
	feedback.value = ''
	hasEnded.value = false
	guesses.value = []
	pickRandomSong()
	if (tom) tom.clear(true)
}

function stopAudio() {
	const el = audioEl.value
	if (!el) return
	el.pause()
	el.currentTime = 0
	if (rafId !== null) {
		cancelAnimationFrame(rafId)
		rafId = null
	}
}

async function playSnippet() {
	if (hasEnded.value) return
	const el = audioEl.value
	if (!el || !currentSong.value) return
	try {
		stopAudio()
		progressMs.value = 0
		await el.play()
		const ms = currentSnippetSeconds.value * 1000
		const start = performance.now()
		const tick = () => {
			const current = Math.min(el.currentTime * 1000, ms)
			progressMs.value = current
			if (current < ms && !el.paused) {
				rafId = requestAnimationFrame(tick)
			}
		}
		rafId = requestAnimationFrame(tick)
		setTimeout(() => {
			el.pause()
		}, ms)
	} catch (e) {
		feedback.value = 'Audio playback blocked. Click play again.'
	}
}

function normalize(text: string) {
	return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function submitGuess() {
	if (!currentSong.value || hasEnded.value) return
	const correct = normalize(userGuess.value)
		.includes(normalize(currentSong.value.title))
	if (correct) {
		feedback.value = `Correct! ${currentSong.value.title}${currentSong.value.artist ? ' — ' + currentSong.value.artist : ''}`
		guesses.value.push({ text: userGuess.value, correct: true, snippet: currentSnippetSeconds.value })
		hasEnded.value = true
		stopAudio()
		triggerCelebration()
		if (tom) tom.clear(true)
		return
	}
	guesses.value.push({ text: userGuess.value, correct: false, snippet: currentSnippetSeconds.value })
	attemptsUsed.value += 1
	progressMs.value = 0
	if (attemptsUsed.value >= 5) {
		feedback.value = `Out of guesses. It was "${currentSong.value.title}"${currentSong.value.artist ? ' — ' + currentSong.value.artist : ''}`
		hasEnded.value = true
		stopAudio()
		if (tom) tom.clear(true)
		return
	}
	feedback.value = `Incorrect. ${attemptsLeft.value} guesses left. Snippet: ${currentSnippetSeconds.value}s`
	userGuess.value = ''
	if (tom) {
		tom.clear(true)
	}
}

function triggerCelebration() {
	isCelebrating.value = true
	const durationMs = 2500
	const end = Date.now() + durationMs
	;(function frame() {
		confetti({ particleCount: 6, spread: 70, startVelocity: 45, ticks: 120, origin: { x: Math.random(), y: Math.random() * 0.3 + 0.1 } })
		if (Date.now() < end) requestAnimationFrame(frame)
	})()
	const emojis = ['🎉', '🥳', '🎊', '🎺', '🎈']
	celebrateItems.value = Array.from({ length: 20 }, (_, i) => ({
		id: i,
		emoji: emojis[Math.floor(Math.random() * emojis.length)],
		left: `${Math.random() * 100}%`,
		delayMs: Math.floor(Math.random() * 600),
		durationMs: 2000 + Math.floor(Math.random() * 1400),
		rotate: Math.floor(Math.random() * 60) - 30,
	}))
	setTimeout(() => { isCelebrating.value = false }, durationMs + 800)
}

onMounted(() => {
	resetGame()
	// Unlock media playback on the first user gesture (Safari/iOS/Chrome autoplay policies)
	const unlockWithGesture = async () => {
		const el = audioEl.value
		if (!el) return
		const prevVol = volume.value
		try {
			el.muted = true
			el.volume = 0
			await el.play().catch(() => {})
			el.pause()
			el.currentTime = 0
		} finally {
			el.muted = false
			el.volume = prevVol
		}
		window.removeEventListener('pointerdown', unlockWithGesture)
		window.removeEventListener('touchstart', unlockWithGesture)
		window.removeEventListener('click', unlockWithGesture)
	}
	window.addEventListener('pointerdown', unlockWithGesture, { once: true })
	window.addEventListener('touchstart', unlockWithGesture, { once: true })
	window.addEventListener('click', unlockWithGesture, { once: true })
	// init Tom Select
	if (tomSelectEl.value) {
		tom = new TomSelect(tomSelectEl.value, {
			options: selectOptions.value,
			valueField: 'value',
			labelField: 'text',
			searchField: ['value', 'text'],
			persist: false,
			create: true,
			maxItems: 1,
			maxOptions: 500,
			onChange: (val: string) => { userGuess.value = val || ''; if (val) submitGuess() },
			onType: (str: string) => { userGuess.value = str || '' },
		})
	}
})

onUnmounted(() => {
	if (tom) {
		tom.destroy()
		tom = null
	}
})

async function load2020Mp3Songs() {
	feedback.value = 'Loading 2020 tracks...'
	try {
		const queries = [
			'year:2020',
			'year:2020 hit',
			'year:2020 top',
			'year:2020 billboard',
		]
		const resultsArrays = await Promise.all(queries.map(q => searchDeezerTracksPaged(q, 4, 25, 'RANKING')))
		const seen = new Set<string>()
		const merged: Song[] = []
		for (const arr of resultsArrays) {
			for (const t of arr) {
				if (!t.preview) continue
				const path = getPathname(t.preview)
				if (!path.endsWith('.mp3')) continue
				const key = `${t.title}|${t.artist?.name}|${t.preview}`
				if (seen.has(key)) continue
				seen.add(key)
				const cover = (t as any).album?.cover_medium || (t as any).album?.cover || undefined
				merged.push({ title: t.title, artist: t.artist?.name, url: t.preview, cover })
			}
		}
		songs.value = merged
		resetGame()
		feedback.value = `Loaded ${merged.length} tracks`
	} catch (e) {
		feedback.value = 'Failed to load 2020 tracks'
	}
}

async function loadArtistMp3Songs(artistName: string, pages = 8) {
    feedback.value = `Loading ${artistName} tracks...`
    try {
        const altQueries: string[] = []
        if (/panic/i.test(artistName)) {
            altQueries.push('Panic! at the Disco', 'Panic at the Disco')
        }
        if (/weekend/i.test(artistName)) {
            altQueries.push('The Weeknd')
        }
        const queries = [
            `artist:"${artistName}"`,
            `${artistName}`,
            ...altQueries,
        ]
        const resultsArrays = await Promise.all(queries.map(q => searchDeezerTracksPaged(q, pages, 25, 'RANKING')))
        const seen = new Set<string>()
        const merged: Song[] = []
        for (const arr of resultsArrays) {
            for (const t of arr) {
                if (!t.preview) continue
                const path = getPathname(t.preview)
                if (!path.endsWith('.mp3')) continue
                const key = `${t.title}|${t.artist?.name}|${path}`
                if (seen.has(key)) continue
                if (!t.artist?.name) continue
                const artistLower = t.artist.name.toLowerCase()
                const targetLower = artistName.toLowerCase()
                const matchArtist = artistLower.includes(targetLower)
                    || (/panic/i.test(targetLower) && /panic!? at the disco/.test(artistLower))
                    || (/weekend/i.test(targetLower) && /weeknd/.test(artistLower))
                if (!matchArtist) continue
                seen.add(key)
                const cover = (t as any).album?.cover_medium || (t as any).album?.cover || undefined
                merged.push({ title: t.title, artist: t.artist?.name, url: t.preview, cover })
            }
        }
        songs.value = merged
        resetGame()
        feedback.value = `Loaded ${merged.length} ${artistName} tracks`
    } catch (e) {
        feedback.value = `Failed to load ${artistName} tracks`
    }
}

watch(selectedArtist, (val) => {
    const pages = /panic/i.test(val) ? 12 : 8
    loadArtistMp3Songs(val, pages)
})

watch(currentSong, async () => {
	const el = audioEl.value
	if (!el) return
	stopAudio()
	await nextTick()
	el.load()
	el.volume = volume.value
})

watch(selectOptions, (opts) => {
	if (!tom) return
	tom.clearOptions()
	tom.addOptions(opts as any)
})

function changeSong() {
	// Print the answer for the current song before switching
	if (currentSong.value) {
		feedback.value = `Answer: ${currentSong.value.title}${currentSong.value.artist ? ' — ' + currentSong.value.artist : ''}`
	}
	stopAudio()
	if (tom) tom.clear(true)
	userGuess.value = ''
	attemptsUsed.value = 0
	hasEnded.value = false
	guesses.value = []
	pickRandomSong()
}

watch(volume, (v) => {
	const el = audioEl.value
	if (el) el.volume = Math.max(0, Math.min(1, v))
})
</script>

<template>
	<div class="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
		<div class="w-full max-w-xl">
			<h1 class="text-3xl font-bold mb-6 text-center">Guess The Song</h1>
			<div class="bg-slate-800 rounded-lg p-6 shadow">
				<div class="flex items-center justify-between mb-4">
					<div class="text-sm opacity-80">Guesses left: <span class="font-semibold">{{ attemptsLeft }}</span></div>
					<div class="text-sm opacity-80">Snippet length: <span class="font-semibold">{{ currentSnippetSeconds }}s</span></div>
				</div>

				<div v-if="!currentSong" class="text-sm mb-3">
					No playable tracks for your browser. Try another browser.
				</div>
				<!-- Hide native controls; we only allow snippets via the Play button and stepper -->
				<audio ref="audioEl" :src="currentSong?.url ?? ''" playsinline preload="auto" class="hidden"></audio>
				<div class="flex items-center gap-3 mb-4">
					<label class="text-sm opacity-80">Artist</label>
					<select v-model="selectedArtist" class="px-3 py-2 rounded bg-slate-900 border border-slate-700">
						<option>Lady Gaga</option>
						<option>Panic! at the Disco</option>
						<option>The Weeknd</option>
						<option>Bresh</option>
						<option>Leon Faun</option>
						<option>Olly</option>
						<option>Lazza</option>
						<option>Bad Bunny</option>
					</select>
					<div class="ml-auto flex items-center gap-2 text-sm">
						<span class="opacity-80">Volume</span>
						<input type="range" min="0" max="1" step="0.01" v-model.number="volume" class="w-32" />
						<span class="w-10 text-right tabular-nums">{{ Math.round(volume * 100) }}%</span>
					</div>
				</div>

				<!-- Cover image -->
				<div v-if="currentSong?.cover" class="mb-4 flex justify-center">
					<img :src="currentSong.cover" alt="Cover" class="w-40 h-40 object-cover rounded shadow" />
				</div>

				<!-- Second-by-second progress bar stepper -->
				<div class="flex items-center gap-2 mb-2">
					<div class="relative w-full h-2 bg-slate-700 rounded overflow-hidden">
						<div class="absolute inset-y-0 left-0 bg-emerald-600/40" :style="{ width: (currentSnippetSeconds / Math.max(...snippetDurationsSeconds) * 100) + '%' }"></div>
						<div class="absolute inset-y-0 left-0 bg-amber-400" :style="{ width: (Math.min(progressMs / (currentSnippetSeconds * 1000), 1) * 100) + '%' }"></div>
					</div>
					<div class="text-xs opacity-80 whitespace-nowrap">{{ Math.floor(progressMs / 1000) }}s / {{ currentSnippetSeconds }}s</div>
				</div>

				<div class="flex items-center gap-2 mb-3">
					<label class="text-sm opacity-80">Guess</label>
					<input ref="tomSelectEl" placeholder="Type song title..." />
					<button class="ml-auto px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50" @click="submitGuess" :disabled="hasEnded">Submit</button>
					<button class="ml-auto px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50" @click="playSnippet" :disabled="hasEnded">
						Play snippet
					</button>
					<button class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600" v-if="hasEnded" @click="resetGame">New song</button>
					<button class="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500" @click="changeSong">Change song</button>
				</div>

				<!-- Guesses table -->
				<div class="mt-4">
					<div class="text-sm font-semibold mb-2">Guesses</div>
					<!-- Celebration overlay -->
					<div v-if="isCelebrating" class="pointer-events-none fixed inset-0">
						<div v-for="item in celebrateItems" :key="item.id"
							class="absolute text-3xl will-change-transform"
							:style="{ left: item.left, top: 0, animation: `fall ${item.durationMs}ms ${item.delayMs}ms linear forwards`, transform: `rotate(${item.rotate}deg)` }"
						>{{ item.emoji }}</div>
					</div>
					<div class="overflow-hidden rounded border border-slate-700">
						<table class="w-full text-sm">
							<thead class="bg-slate-700/40">
								<tr>
									<th class="text-left px-3 py-2">#</th>
									<th class="text-left px-3 py-2">Your guess</th>
									<th class="text-left px-3 py-2">Snippet</th>
									<th class="text-left px-3 py-2">Result</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(g, i) in guesses" :key="i" :class="g.correct ? 'bg-emerald-900/30' : 'bg-transparent'">
									<td class="px-3 py-2">{{ i + 1 }}</td>
									<td class="px-3 py-2">{{ g.text }}</td>
									<td class="px-3 py-2">{{ g.snippet }}s</td>
									<td class="px-3 py-2">
										<span :class="g.correct ? 'text-emerald-400' : 'text-rose-400'">{{ g.correct ? 'Correct' : 'Wrong' }}</span>
									</td>
								</tr>
								<tr v-if="!guesses.length">
									<td colspan="4" class="px-3 py-4 text-center opacity-60">No guesses yet</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
				<p class="min-h-6 text-sm opacity-90">{{ feedback }}</p>
			</div>
			<p class="mt-4 text-xs text-center opacity-70">Tracks from Wikimedia Commons (public domain/CC). For demo only.</p>
		</div>
	</div>
</template>

<style scoped>
@keyframes fall {
	0% { transform: translateY(-10%) rotate(0deg); opacity: 1; }
	100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
}
</style>


