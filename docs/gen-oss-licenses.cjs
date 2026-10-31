const fs=require('fs'),path=require('path'),cp=require('child_process')
const out=cp.execSync('npm ls --omit=dev --all --parseable',{cwd:process.argv[2],encoding:'utf8'}).split('\n').filter(Boolean).slice(1)
const seen=new Map()
let APACHE='';for(const c of ['firebase/LICENSE','@grpc/grpc-js/LICENSE']){try{APACHE=fs.readFileSync(path.join(process.argv[2],'node_modules',c),'utf8').trim();break}catch{}}
for(const dir of out){
  let pj; try{pj=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'))}catch{continue}
  const key=pj.name+'@'+pj.version; if(seen.has(key))continue
  const lic=typeof pj.license==='string'?pj.license:(pj.license&&pj.license.type)||(Array.isArray(pj.licenses)?pj.licenses.map(l=>l.type).join(' OR '):'UNKNOWN')
  const f=fs.readdirSync(dir).find(n=>/^(licen[cs]e|copying)/i.test(n))
  const text=f?fs.readFileSync(path.join(dir,f),'utf8').trim():''
  seen.set(key,{name:pj.name,version:pj.version,lic,text,repo:(pj.repository&&(pj.repository.url||pj.repository))||pj.homepage||''})
}
const list=[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name))
let s=`BodyTailor Log — 오픈소스 라이선스 고지 (Open Source Notices)\n생성: ${new Date().toISOString().slice(0,10)} · 앱에 포함된 라이브러리 ${list.length}개\n\n`
s+='글꼴(SIL Open Font License 1.1): Pretendard (Kil Hyung-jin), Paperlogy, NanumSquare Neo (NAVER), Outfit (The Outfit Project Authors)\n'
s+='아이콘: Lucide (ISC License, Lucide Contributors)\n사진(홍보 페이지): Unsplash License\n\n'
s+='='.repeat(70)+'\n'
for(const p of list){
  s+=`\n${p.name} ${p.version}\nLicense: ${p.lic}${p.repo?`\nSource: ${String(p.repo).replace(/^git\+/,'')}`:''}\n\n${p.text||(/Apache-2\.0/.test(p.lic)&&APACHE?'(Apache License 2.0 — 전문은 이 문서 맨 아래)':'(라이선스 파일 없음 — package.json의 license 항목 참고)')}\n\n`+'-'.repeat(70)+'\n'
}
if(APACHE)s+='\n\nApache License 2.0 전문\n'+'='.repeat(70)+'\n'+APACHE+'\n'
fs.writeFileSync(process.argv[3],s)
console.log(list.length, list.map(p=>p.name+':'+p.lic).join(', ').slice(0,1500))
