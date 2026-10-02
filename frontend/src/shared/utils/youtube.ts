const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export function parseYouTubeVideoId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let id = ''
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || ''
    else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || ''
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || ''
    }
    return VIDEO_ID_PATTERN.test(id) ? id : null
  } catch { return null }
}

export function isValidYouTubeUrl(value: string | null | undefined): boolean {
  return parseYouTubeVideoId(value) !== null
}

export function toYouTubeEmbedUrl(value: string | null | undefined): string | null {
  const id = parseYouTubeVideoId(value)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
}

export function toYouTubeWatchUrl(value: string | null | undefined): string | null {
  const id = parseYouTubeVideoId(value)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}
