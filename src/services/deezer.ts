import { jsonp } from './jsonp'

export type DeezerTrack = {
	id: number
	title: string
	preview: string // 30s mp3
	artist: { name: string }
	album?: {
		id: number
		title: string
		md5_image?: string
		cover?: string
		cover_small?: string
		cover_medium?: string
		cover_big?: string
		cover_xl?: string
	}
}

export type DeezerSearchResponse = {
	data: DeezerTrack[]
}

export async function searchDeezerTracks(
	query: string,
	index = 0,
	limit = 25,
	order:
		| 'RANKING'
		| 'TRACK_ASC'
		| 'TRACK_DESC'
		| 'ARTIST_ASC'
		| 'ARTIST_DESC'
		| 'ALBUM_ASC'
		| 'ALBUM_DESC'
		| 'RATING_ASC'
		| 'RATING_DESC'
		| 'DURATION_ASC'
		| 'DURATION_DESC' = 'RANKING'
): Promise<DeezerTrack[]> {
	const url = `https://api.deezer.com/search/track?q=${encodeURIComponent(query)}&index=${index}&limit=${limit}&order=${order}`
	const res = await jsonp<DeezerSearchResponse>(url)
	return res?.data ?? []
}

export async function searchDeezerTracksPaged(
	query: string,
	pages = 5,
	limit = 25,
	order: Parameters<typeof searchDeezerTracks>[3] = 'RANKING'
): Promise<DeezerTrack[]> {
	const pageIndexes = Array.from({ length: pages }, (_, i) => i * limit)
	const results = await Promise.all(pageIndexes.map((i) => searchDeezerTracks(query, i, limit, order)))
	return results.flat()
}


