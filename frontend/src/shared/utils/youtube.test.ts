import { describe, expect, it } from 'vitest'
import { isValidYouTubeUrl, parseYouTubeVideoId, toYouTubeEmbedUrl, toYouTubeWatchUrl } from './youtube'

describe('YouTube URL helpers', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=12', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('accepts a supported URL %s', (url, id) => {
    expect(parseYouTubeVideoId(url)).toBe(id)
    expect(toYouTubeEmbedUrl(url)).toBe(`https://www.youtube-nocookie.com/embed/${id}`)
  })

  it.each(['https://example.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://youtu.be/not-an-id'])('rejects unsafe or malformed URL %s', (url) => {
    expect(isValidYouTubeUrl(url)).toBe(false)
    expect(toYouTubeEmbedUrl(url)).toBeNull()
  })

  it('builds a direct YouTube link only after validating the video ID', () => {
    expect(toYouTubeWatchUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})
