export function isYouTubeLink(value: string): boolean {
  let url: URL;
  try { url = new URL(value) } catch { return false }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId = '';
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
  else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
    else videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || '';
  }
  return /^[A-Za-z0-9_-]{11}$/.test(videoId);
}
