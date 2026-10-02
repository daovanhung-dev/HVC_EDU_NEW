import { isYouTubeLink } from './youtube.ts';

Deno.test('accepts supported YouTube watch and short links', () => {
  if (!isYouTubeLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')) throw new Error('watch URL should pass');
  if (!isYouTubeLink('https://youtu.be/dQw4w9WgXcQ?t=5')) throw new Error('short URL should pass');
  if (!isYouTubeLink('https://youtube.com/shorts/dQw4w9WgXcQ')) throw new Error('shorts URL should pass');
});

Deno.test('rejects non-YouTube hosts, malformed IDs and URL spoofing', () => {
  for (const url of [
    'https://example.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=short',
    'javascript:alert(1)',
    'https://youtube.com:8080/watch?v=dQw4w9WgXcQ',
  ]) if (isYouTubeLink(url)) throw new Error(`unsafe link accepted: ${url}`);
});
