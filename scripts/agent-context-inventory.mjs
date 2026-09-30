#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const unknownArgs = args.filter((arg) => arg !== '--check')
if (unknownArgs.length) {
  process.stderr.write('Usage: node scripts/agent-context-inventory.mjs [--check]\n')
  process.exit(2)
}

const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean)

const inventoryRelativePath = 'docs/agent-context/repository-inventory.md'
const entries = [...new Set([...tracked, ...untracked, inventoryRelativePath])]
  .sort((a, b) => a.localeCompare(b, 'en'))

function subsystem(file) {
  if (file === 'AGENTS.md' || file.endsWith('/AGENTS.md')) return 'Chỉ dẫn agent'
  if (file.startsWith('frontend/src/modules/admin/')) return 'Frontend / Admin'
  if (file.startsWith('frontend/src/modules/staff/')) return 'Frontend / Giáo viên'
  if (file.startsWith('frontend/src/modules/student/')) return 'Frontend / Học sinh'
  if (file.startsWith('frontend/src/modules/auth/')) return 'Frontend / Đăng nhập'
  if (file.startsWith('frontend/src/')) return 'Frontend / nền tảng và dịch vụ'
  if (file.startsWith('frontend/')) return 'Frontend / cấu hình và public'
  if (file.startsWith('supabase/migrations/')) return 'Supabase / migrations'
  if (file.startsWith('supabase/functions/')) return 'Supabase / Edge Functions'
  if (file.startsWith('supabase/tests/')) return 'Supabase / kiểm thử SQL'
  if (file.startsWith('supabase/')) return 'Supabase / cấu hình và seed'
  if (file.startsWith('docs/agent-context/')) return 'Agent context'
  if (file.startsWith('docs/data_seed/')) return 'Dữ liệu nguồn được bảo vệ'
  if (file.startsWith('docs/accounts/')) return 'Local-only được bảo vệ'
  if (file.startsWith('docs/plans/')) return 'Kế hoạch lịch sử theo nhiệm vụ'
  if (file.startsWith('docs/')) return 'Tài liệu sản phẩm / lịch sử'
  if (file.startsWith('.github/workflows/')) return 'CI và phát hành'
  if (file.startsWith('scripts/')) return 'Công cụ dự án'
  if (file.startsWith('assets/')) return 'Tài nguyên tĩnh'
  return 'Cấu hình ở repo root'
}

function fileType(file) {
  const name = path.basename(file).toLowerCase()
  if (name === 'package-lock.json') return 'npm lockfile'
  if (name === 'deno.lock') return 'Deno lockfile'
  if (name === '.gitignore') return 'Git ignore rules'
  if (name.endsWith('.env.example')) return 'Mẫu biến môi trường'
  const extension = path.extname(name).slice(1)
  const types = {
    md: 'Markdown',
    ts: 'TypeScript',
    vue: 'Vue SFC',
    sql: 'SQL',
    json: 'JSON/config',
    toml: 'TOML/config',
    yml: 'YAML workflow',
    yaml: 'YAML',
    sh: 'Shell',
    css: 'CSS',
    html: 'HTML',
    xlsm: 'Workbook nguồn; chỉ lập chỉ mục đường dẫn',
    jpg: 'Ảnh',
    png: 'Ảnh',
    svg: 'SVG',
  }
  return types[extension] || (extension ? extension.toUpperCase() : 'Không có extension')
}

const lines = [
  '# Danh mục cấu trúc repository',
  '',
  '> Tự sinh từ Git: file được theo dõi và file mới chưa bị ignore. Chỉ ghi đường dẫn, subsystem và loại file; không đọc hoặc chép nội dung.',
  '',
  '> Các mục thuộc docs/data_seed/ chỉ được liệt kê đường dẫn, subsystem và loại file. docs/accounts/ và node_modules/build/cache/ bị loại theo quy tắc ignore/local-only.',
  '',
  '| Đường dẫn | Subsystem | Loại file |',
  '|---|---|---|',
]

for (const file of entries) {
  const safePath = file.replaceAll('|', '\\|')
  lines.push('| ' + safePath + ' | ' + subsystem(file) + ' | ' + fileType(file) + ' |')
}
lines.push('', 'Tổng: ' + entries.length + ' đường dẫn có trong inventory.', '')

const expected = lines.join('\n')
const overridePath = process.env.AGENT_CONTEXT_INVENTORY_PATH
const inventoryPath = overridePath
  ? path.resolve(process.cwd(), overridePath)
  : path.join(repoRoot, inventoryRelativePath)

if (checkOnly) {
  let actual
  try {
    actual = readFileSync(inventoryPath, 'utf8')
  } catch {
    process.stderr.write('Thiếu ' + path.relative(repoRoot, inventoryPath) + '; chạy npm run agent:context:update.\n')
    process.exit(1)
  }
  if (actual !== expected) {
    process.stderr.write('Danh mục context chưa khớp với file Git hiện tại: ' + path.relative(repoRoot, inventoryPath) + '\n')
    process.stderr.write('Chạy npm run agent:context:update rồi rà lại thay đổi.\n')
    process.exit(1)
  }
  process.stdout.write('Agent context inventory khớp: ' + entries.length + ' đường dẫn.\n')
} else {
  writeFileSync(inventoryPath, expected, 'utf8')
  process.stdout.write('Đã cập nhật ' + path.relative(repoRoot, inventoryPath) + ' (' + entries.length + ' đường dẫn).\n')
}
