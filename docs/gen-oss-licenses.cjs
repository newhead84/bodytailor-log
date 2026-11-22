// 오픈소스 고지 생성: node docs/gen-oss-licenses.cjs . public/oss-licenses.txt
// [2026-11-22] 앱 빌드에 실제로 들어간 패키지만 담는다(사용자: "39개만 담고").
// 소스맵을 켠 vite 빌드를 OS 임시 폴더에 만들고, 소스맵 sources의 node_modules 경로에서 패키지를 뽑은 뒤 임시 폴더를 지운다.
// 저장소의 dist나 배포 결과물에는 소스맵이 남지 않는다.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process')
const root = path.resolve(process.argv[2] || '.'), outFile = process.argv[3] || 'public/oss-licenses.txt'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-oss-'))
const pkgDirs = new Set()
try {
  cp.execSync(`npx vite build --sourcemap --outDir "${tmp}" --emptyOutDir --logLevel warn`, { cwd: root, stdio: 'inherit' })
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
  for (const f of walk(tmp).filter(f => f.endsWith('.map'))) {
    const map = JSON.parse(fs.readFileSync(f, 'utf8'))
    for (const src of map.sources || []) {
      const abs = path.resolve(path.dirname(f), (map.sourceRoot || '') + src).replace(/\\/g, '/')
      const i = abs.lastIndexOf('/node_modules/'); if (i < 0) continue
      const rest = abs.slice(i + 14).split('/'), name = rest[0].startsWith('@') ? rest[0] + '/' + rest[1] : rest[0]
      pkgDirs.add(abs.slice(0, i + 14) + name)
    }
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }) }
if (!pkgDirs.size) throw new Error('소스맵에서 패키지를 찾지 못함')

const seen = new Map()
let APACHE = ''; for (const c of ['firebase/LICENSE', '@grpc/grpc-js/LICENSE']) { try { APACHE = fs.readFileSync(path.join(root, 'node_modules', c), 'utf8').trim(); break } catch {} }
for (const dir of pkgDirs) {
  let pj; try { pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) } catch { continue }
  const key = pj.name + '@' + pj.version; if (seen.has(key)) continue
  const lic = typeof pj.license === 'string' ? pj.license : (pj.license && pj.license.type) || (Array.isArray(pj.licenses) ? pj.licenses.map(l => l.type).join(' OR ') : 'UNKNOWN')
  const f = fs.readdirSync(dir).find(n => /^(licen[cs]e|copying)/i.test(n))
  const text = f ? fs.readFileSync(path.join(dir, f), 'utf8').trim() : ''
  seen.set(key, { name: pj.name, version: pj.version, lic, text, repo: (pj.repository && (pj.repository.url || pj.repository)) || pj.homepage || '' })
}
const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
let s = `BodyTailor Log - 오픈소스 라이선스 고지 (Open Source Notices)\n생성: ${new Date().toISOString().slice(0, 10)} · 앱에 포함된 라이브러리 ${list.length}개\n\n`
s += '글꼴(SIL Open Font License 1.1): Pretendard (Kil Hyung-jin), Paperlogy, NanumSquare Neo (NAVER), Outfit (The Outfit Project Authors)\n'
s += '아이콘: Lucide (ISC License, Lucide Contributors)\n사진(홍보 페이지): Unsplash License\n'
s += '배경 영상(홍보 페이지): Mixkit #100549, Mixkit Stock Video Free License\n\n'
s += '='.repeat(70) + '\n'
const usesApache = list.some(p => !p.text && /Apache-2\.0/.test(p.lic))
for (const p of list) {
  s += `\n${p.name} ${p.version}\nLicense: ${p.lic}${p.repo ? `\nSource: ${String(p.repo).replace(/^git\+/, '')}` : ''}\n\n${p.text || (/Apache-2\.0/.test(p.lic) && APACHE ? '(Apache License 2.0 - 전문은 이 문서 맨 아래)' : '(라이선스 파일 없음 - package.json의 license 항목 참고)')}\n\n` + '-'.repeat(70) + '\n'
}
if (APACHE && usesApache) s += '\n\nApache License 2.0 전문\n' + '='.repeat(70) + '\n' + APACHE + '\n'
fs.writeFileSync(path.resolve(root, outFile), s)
console.log(`패키지 ${list.length}개 → ${outFile}`)
