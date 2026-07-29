import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const UV_CACHE_DIR = resolve(ROOT, '.cache', 'uv')
const modules = [
  'apps.electron.resources.scripts.tests.test_pdf_tool_smoke',
  'apps.electron.resources.scripts.tests.test_xlsx_tool_smoke',
  'apps.electron.resources.scripts.tests.test_docx_tool_smoke',
  'apps.electron.resources.scripts.tests.test_pptx_tool_smoke',
  'apps.electron.resources.scripts.tests.test_img_tool_smoke',
  'apps.electron.resources.scripts.tests.test_ical_tool_smoke',
  'apps.electron.resources.scripts.tests.test_doc_diff_smoke',
  'apps.electron.resources.scripts.tests.test_markitdown_smoke',
]

const proc = Bun.spawn([
  'uv',
  'run',
  '--python',
  '3.12',
  'python',
  '-m',
  'unittest',
  ...modules,
], {
  cwd: ROOT,
  env: {
    ...process.env,
    // Keep validation self-contained on managed Windows accounts where the
    // default user-level uv cache may not be writable.
    UV_CACHE_DIR,
    // The tool wrappers emit UTF-8. Force Python's subprocess decoding away
    // from the legacy Windows GBK locale so captured stdout/stderr is stable.
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
  },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
  windowsHide: true,
})

const exitCode = await proc.exited
if (exitCode !== 0) {
  throw new Error(`Document tool tests exited with ${exitCode}`)
}
