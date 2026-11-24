/* [2026-11-22] 홈 화면 설치 안내(공용): 소개 페이지 '앱 설치하기' 시트(A안)와 앱 로그인 전 전체 화면 안내(C안)가 같은 내용·문구를 쓴다.
 * 문구·기기 분기를 바꿀 때는 이 파일만 고친다. 두 페이지 모두 <head>에서 동기 로드(설치 신호 beforeinstallprompt를 일찍 잡기 위해).
 *  - 안드로이드: 설치 신호가 오면 '설치' 버튼, 안 오면(삼성 인터넷·웨일·파이어폭스·이미 설치 등) 메뉴 경로 안내
 *  - PC(확실한 데스크톱만, 2026-11-24): 설치 신호가 와도 PC 설치 대신 '휴대폰에서 설치해 주세요' + 앱 주소 QR(/install-qr.svg)·주소 복사
 *  - 아이폰: 사파리·크롬·엣지는 공유 → 홈 화면에 추가 3단계, 그 밖 iOS 브라우저는 사파리로 열기(아이폰은 설치 여부를 알 수 없음)
 *  - 인앱 브라우저(inapp.js의 window.__btInApp): 기본 브라우저로 열기·주소 복사
 *  - 이미 설치(안드로이드 크롬 getInstalledRelatedApps, manifest related_applications): 아이콘으로 열기 안내
 *  - '설치 없이 브라우저에서 계속': 7일 동안 앱의 전체 화면 안내를 다시 띄우지 않고, 로그인 뒤 상단 설치 배너(InstallBanner)도 같은 기간 숨긴다.
 * 쓰는 법: BTInstall.open({ mode: 'sheet' | 'full', opener, onSkip }) → 닫는 함수. BTInstall.shouldGate(): 앱 전체 화면 안내를 띄울지.
 */
;(function () {
  var SKIP_KEY = 'bt_install_gate_skipped_at', BANNER_KEY = 'bt_install_banner_dismissed_at', DAYS = 7
  var ua = navigator.userAgent || ''
  var os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(ua) ? 'android' : /Macintosh/.test(ua) ? 'mac' : 'desktop'
  var br = /SamsungBrowser/i.test(ua) ? 'samsung' : /Whale/i.test(ua) ? 'whale' : /EdgiOS|EdgA|Edg\//i.test(ua) ? 'edge' : /FxiOS|Firefox/i.test(ua) ? 'firefox' : /CriOS|Chrome/i.test(ua) ? 'chrome' : /Safari/i.test(ua) ? 'safari' : 'other'
  // [2026-11-24] PC(윈도·맥·리눅스 데스크톱)는 앱을 설치하지 않고 휴대폰 설치를 안내한다(QR). 휴대폰에는 QR이 절대 나오면 안 되므로
  // 확실한 PC만 고른다: 데스크톱 UA + 모바일 표시 없음 + 마우스·터치패드(any-pointer: fine). 안드로이드 '데스크톱 사이트' 보기처럼 애매하면 PC로 보지 않는다.
  var pc = (os === 'desktop' || os === 'mac') && /Windows NT|Macintosh|X11|CrOS/.test(ua) && !/Mobi|Android|Tablet|iPhone|iPad/i.test(ua) &&
    !(navigator.userAgentData && navigator.userAgentData.mobile) && !!(window.matchMedia && matchMedia('(any-pointer: fine)').matches)
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true
  var deferred = null, installed = false, skippedNow = false, cur = null

  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (cur && cur.view === 'manual') cur.render() })
  // 설치 신호는 한 번만 쓸 수 있다: 상단 배너(InstallBanner)와 이 안내 중 한쪽이 쓰면 'bt-install-prompt-used'로 알려 둘 다 비운다
  addEventListener('bt-install-prompt-used', function () { deferred = null; if (cur && cur.view === 'main' && !installed && os !== 'ios' && !inApp()) cur.render() })
  addEventListener('appinstalled', function () { deferred = null; installed = true; if (cur) cur.render('done') })
  try { if (navigator.getInstalledRelatedApps) navigator.getInstalledRelatedApps().then(function (a) { if (a.length) installed = true }).catch(function () {}) } catch (e) {}

  var FORCE_KEY = 'bt_install_gate_force'
  var atApp = location.pathname === '/'
  // 메뉴(공유 → 홈 화면에 추가, 바로가기 추가, Dock에 추가)로 저장하면 브라우저가 지금 주소를 아이콘으로 쓰는 경우가 있다.
  // 소개 페이지에서 따라 하면 아이콘이 소개 페이지를 열 수 있으므로, 앱 첫 화면으로 보낸 뒤 같은 안내를 띄운다(한 번만 강제).
  var TOAPP = '<h2 id="btiT">앱 화면에서 추가해 주세요</h2><p class="p">앱 첫 화면에서 추가해야 홈 화면 아이콘이 바로 앱으로 열려요. 누르면 앱 화면으로 가서 같은 방법을 알려 드려요.</p><button class="b1" type="button" data-toapp>앱 화면에서 설치하기</button>'
  function inApp() { return window.__btInApp && window.__btInApp.isInApp ? window.__btInApp : null }
  function skippedRecently() {
    if (skippedNow) return true
    try { var t = Number(localStorage.getItem(SKIP_KEY) || 0); return t > 0 && Date.now() - t < DAYS * 864e5 } catch (e) { return false }
  }
  function recordSkip() {
    skippedNow = true
    try { var now = String(Date.now()); localStorage.setItem(SKIP_KEY, now); localStorage.setItem(BANNER_KEY, now) } catch (e) {}
    // 같은 화면에 떠 있는 상단 배너(InstallBanner)도 바로 숨긴다(저장이 막힌 환경 포함)
    dispatchEvent(new Event('bt-install-skip'))
  }

  var IN = { kakao: '카카오톡', line: '라인', instagram: '인스타그램', facebook: '페이스북', naver: '네이버 앱', band: '밴드', daum: '다음 앱', everytime: '에브리타임', tiktok: '틱톡' }
  var SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>'
  // 장점은 실제 기능만: 아이콘 실행, display standalone(주소창 없음), 휴식 끝 알림(RestTimer·MY 알림 설정)
  var WHY = '<ul class="why"><li>홈 화면 아이콘으로 바로 열기</li><li>주소창 없이 전체 화면으로 기록</li><li>휴식이 끝나면 알림(MY에서 켜기)</li></ul>'
  var COPY = '<button class="b2" type="button" data-copy>주소 복사</button>'
  function ill(svg, t) { return '<span class="ill" aria-hidden="true">' + (svg || '') + (t ? (svg ? '<i>' + t + '</i>' : t) : '') + '</span>' }

  function manual() {
    if (!atApp && os === 'android') return TOAPP
    if (os === 'android') {
      var s = br === 'samsung' ? '아래쪽 <b>메뉴(≡)</b> → <b>현재 페이지 추가</b> → <b>홈 화면</b>을 눌러요'
        : br === 'whale' ? '아래쪽 <b>메뉴(≡)</b> → <b>홈 화면에 추가</b>를 눌러요'
        : br === 'firefox' ? '오른쪽 <b>메뉴(⋮)</b> → <b>설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요'
        : '오른쪽 위 <b>메뉴(⋮)</b> → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요'
      return '<h2 id="btiT">홈 화면에 설치해 주세요</h2><p class="p">브라우저 메뉴에서 설치할 수 있어요.</p>' + WHY + '<ol><li><span>' + s + '</span></li><li><span>홈 화면의 <b>BodyTailor</b> 아이콘으로 열어요</span></li></ol><p class="n">이미 설치했다면 홈 화면의 BodyTailor 아이콘으로 여세요.</p>'
    }
    // 확실한 PC가 아닌 그 밖의 기기(판정이 애매한 경우): QR 없이 주소만
    return '<h2 id="btiT">휴대폰에서 설치해 주세요</h2><p class="p">휴대폰에서 이 주소를 열고 \'앱 설치하기\'를 누르면 홈 화면에 설치돼요.</p>' + COPY
  }
  function body(v) {
    var ia = inApp()
    if (v === 'done') return '<h2 id="btiT">설치를 시작했어요</h2><p class="p">설치가 끝나면 홈 화면의 <b>BodyTailor</b> 아이콘으로 열어 주세요.</p>'
    if (ia) {
      var menu = ia.kind === 'kakao' || ia.kind === 'line' ? '⋮ 메뉴 → \'다른 브라우저로 열기\'' : '⋯ 메뉴 → \'브라우저에서 열기\' 또는 \'Safari로 열기\''
      return '<h2 id="btiT">' + (IN[ia.kind] || '이 앱') + ' 안에서는 설치할 수 없어요</h2><p class="p">기본 브라우저(크롬·사파리)로 연 뒤 홈 화면에 설치해 주세요. 구글 로그인도 기본 브라우저에서만 돼요.</p><button class="b1" type="button" data-ext>기본 브라우저로 열기</button>' + COPY + '<p class="n" data-hint>안 열리면 오른쪽 위 ' + menu + '</p>'
    }
    // PC: 설치 신호가 와도 PC 설치 버튼 대신 휴대폰 설치 안내(QR은 앱 첫 화면 주소, 찍으면 휴대폰에서 설치 안내가 바로 뜬다)
    if (pc) return '<h2 id="btiT">휴대폰에서 설치해 주세요</h2><p class="p">BodyTailor는 운동하면서 휴대폰으로 기록하는 앱이에요.<br>휴대폰 카메라로 QR을 찍으면 설치 방법이 바로 나와요.</p><img class="qr" src="/install-qr.svg" width="176" height="176" alt="BodyTailor 앱 주소 QR 코드" />' + COPY
    if (installed) return '<h2 id="btiT">이미 설치돼 있어요</h2><p class="p">홈 화면의 <b>BodyTailor</b> 아이콘으로 열어 주세요.</p>'
    if (os === 'ios') {
      if (!atApp && br !== 'other' && br !== 'firefox' && br !== 'whale') return TOAPP
      if (br === 'safari') return '<h2 id="btiT">홈 화면에 추가해 주세요</h2><p class="p">아이폰은 사파리에서 세 번 누르면 앱처럼 설치돼요.</p><ol><li><span>아래쪽 <b>공유</b> 버튼을 눌러요</span>' + ill(SHARE) + '</li><li><span>목록을 내려 <b>홈 화면에 추가</b>를 눌러요</span>' + ill(PLUS, '홈 화면에 추가') + '</li><li><span>오른쪽 위 <b>추가</b>를 누르고, 홈 화면 아이콘으로 열어요</span>' + ill('', '추가') + '</li></ol>' + WHY
      if (br === 'chrome' || br === 'edge') return '<h2 id="btiT">홈 화면에 추가해 주세요</h2><p class="p">세 번 누르면 앱처럼 설치돼요.</p><ol><li><span>주소창 오른쪽 <b>공유</b> 버튼을 눌러요</span>' + ill(SHARE) + '</li><li><span><b>홈 화면에 추가</b>를 눌러요(안 보이면 목록을 내려 보세요)</span>' + ill(PLUS) + '</li><li><span><b>추가</b>를 누르고, 홈 화면 아이콘으로 열어요</span></li></ol>' + WHY
      return '<h2 id="btiT">사파리에서 열어 주세요</h2><p class="p">아이폰은 사파리에서 홈 화면에 추가할 수 있어요. 주소를 복사해 사파리에서 열어 주세요.</p>' + COPY
    }
    if (deferred) return '<h2 id="btiT">BodyTailor 앱을 설치해 주세요</h2><p class="p">홈 화면에 설치하고 앱으로 열어 쓰는 서비스예요.</p>' + WHY + '<button class="b1" type="button" data-prompt>설치</button><p class="n">누르면 브라우저의 설치 창이 떠요.</p>'
    return manual()
  }

  var CSS = '.bti{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;font-family:inherit;word-break:keep-all;-webkit-font-smoothing:antialiased}' +
    '.bti .dim{position:absolute;inset:0;background:rgba(0,0,0,.6);opacity:0;transition:opacity .25s}' +
    '.bti .sh{position:relative;width:100%;max-width:480px;max-height:92vh;overflow:auto;overscroll-behavior:contain;background:#1e1b18;color:#f5efe6;border-radius:22px 22px 0 0;padding:14px 22px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.45);transform:translateY(24px);opacity:0;transition:transform .3s cubic-bezier(.2,.7,.2,1),opacity .25s;box-sizing:border-box}' +
    '.bti.on .dim{opacity:1}.bti.on .sh{transform:none;opacity:1}' +
    '.bti.full{background:#141210;align-items:flex-start;overflow:auto}.bti.full .dim,.bti.full .grab,.bti.full .x{display:none}' +
    /* 짧은 화면(가로·큰 글씨)에서 위가 잘리지 않게: 가운데 정렬은 위아래 auto 여백으로(넘치면 위에서부터) */
    '.bti.full .sh{max-height:none;min-height:100%;overflow:visible;background:none;box-shadow:none;border-radius:0;margin:0 auto;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,0px) + 40px) 26px calc(env(safe-area-inset-bottom,0px) + 28px)}' +
    '.bti.full .ic{margin-top:auto}.bti.full .skip{margin-bottom:auto}' +
    '@media (min-width:821px){.bti{align-items:center}.bti .sh{border-radius:22px;padding:24px 28px}.bti .grab{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.bti .dim,.bti .sh{transition:none}}' +
    '.bti *{box-sizing:border-box;margin:0}' +
    '.bti .grab{width:40px;height:4px;border-radius:2px;background:#4a443d;margin:0 auto 14px}' +
    '.bti .x{position:absolute;top:10px;right:10px;width:40px;height:40px;border:0;border-radius:12px;background:none;color:#a39b8f;font-size:24px;line-height:1;cursor:pointer}' +
    '.bti .ic{display:block;width:60px;height:60px;border-radius:15px;margin:4px auto 12px}' +
    '.bti h2{font-size:21px;font-weight:800;text-align:center;line-height:1.35;letter-spacing:-.01em;color:#f5efe6}' +
    '.bti .p{font-size:14.5px;color:#cfc6b8;text-align:center;line-height:1.6;margin:8px 0 16px}' +
    '.bti .why{list-style:none;display:flex;flex-direction:column;gap:7px;margin:0 0 16px;padding:13px 16px;background:#26221e;border-radius:14px;font-size:14px;line-height:1.5;color:#cfc6b8}' +
    '.bti .why li::before{content:"✓";color:#c8f53c;font-weight:800;margin-right:8px}' +
    '.bti ol{list-style:none;padding:0;display:flex;flex-direction:column;gap:9px;margin:0 0 14px;counter-reset:s}' +
    '.bti ol li{counter-increment:s;display:flex;gap:12px;align-items:center;background:#26221e;border-radius:14px;padding:12px 14px;font-size:14.5px;line-height:1.45;color:#f5efe6}' +
    '.bti ol li::before{content:counter(s);flex:none;width:26px;height:26px;border-radius:50%;background:#c8f53c;color:#11170a;font-weight:800;font-size:14px;display:grid;place-items:center}' +
    '.bti b{color:#fff}' +
    '.bti .ill{flex:none;margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:9px;background:#141210;border:1.5px solid #c8f53c;color:#c8f53c;font-size:12px;font-weight:800;white-space:nowrap}' +
    '.bti .ill svg{width:18px;height:18px}.bti .ill i{font-style:normal}@media (max-width:360px){.bti .ill i{display:none}}' +
    '.bti .sh:focus{outline:none}' +
    '.bti .b1,.bti .b2{display:block;width:100%;padding:15px;border-radius:14px;font:inherit;font-weight:800;font-size:16.5px;text-align:center;cursor:pointer}' +
    '.bti .b1{border:0;background:#c8f53c;color:#11170a}' +
    '.bti .b2{border:1px solid #3a352f;background:none;color:#f5efe6;margin-top:10px;font-weight:600;font-size:15px}' +
    '.bti .url{display:block;width:100%;margin-top:10px;padding:13px;border-radius:14px;border:1px solid #c8f53c;background:#141210;color:#f5efe6;font:inherit;font-size:14px;text-align:center}' +
    '.bti .qr{display:block;width:176px;height:176px;margin:0 auto 4px;border-radius:14px;background:#fff}' +
    '.bti .n{font-size:13px;color:#a39b8f;text-align:center;margin-top:12px;line-height:1.55}' +
    '.bti .skip{display:block;width:max-content;max-width:100%;margin:14px auto 0;padding:6px 8px;font-size:13.5px;color:#a39b8f;text-decoration:underline;text-underline-offset:3px}' +
    '.bti :focus-visible{outline:2px solid #c8f53c;outline-offset:2px}' +
    'html.bti-open,html.bti-open body{overflow:hidden}html.bti-open #bt-inapp-bar{display:none!important}'

  function open(opt) {
    opt = opt || {}
    if (cur) cur.close()
    if (!document.getElementById('bti-css')) { var st = document.createElement('style'); st.id = 'bti-css'; st.textContent = CSS; document.head.appendChild(st) }
    var full = opt.mode === 'full', opener = opt.opener || document.activeElement
    var box = document.createElement('div'); box.className = 'bti' + (full ? ' full' : '')
    box.innerHTML = '<div class="dim" data-close></div><div class="sh" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="btiT"><div class="grab" aria-hidden="true"></div><button class="x" type="button" data-close aria-label="닫기">×</button><img class="ic" src="/icon-192.png" alt="" width="60" height="60" /><div data-body></div><a class="skip" href="/" data-skip>설치 없이 브라우저에서 계속</a></div>'
    var sh = box.querySelector('.sh'), b = box.querySelector('[data-body]')
    var others = [].filter.call(document.body.children, function (el) { return el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' })
    var focusables = function () { return [].filter.call(sh.querySelectorAll('button,a[href],input'), function (el) { return el.offsetParent !== null }) }
    // 주 버튼이 있으면 그 버튼, 없으면 대화상자 자체에 포커스(맨 아래 링크에 바로 테두리가 생기지 않게)
    var focusFirst = function () { var f = sh.querySelector('.b1'); if (f) f.focus(); else sh.focus() }
    var state = {
      view: '', full: full,
      render: function (v) {
        state.view = v || (deferred || installed || os === 'ios' || inApp() ? 'main' : 'manual')
        b.innerHTML = body(v)
      },
      close: function () {
        if (cur !== state) return
        cur = null; box.remove(); document.documentElement.classList.remove('bti-open')
        others.forEach(function (el) { el.inert = false })
        removeEventListener('keydown', onKey, true)
        if (opener && opener.focus && document.contains(opener)) opener.focus()
      },
    }
    function skip() { recordSkip(); state.close(); if (opt.onSkip) opt.onSkip() }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); return full ? skip() : state.close() }
      if (e.key !== 'Tab') return
      var f = focusables(), first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sh)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (!sh.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    }
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-close],[data-prompt],[data-copy],[data-ext],[data-skip],[data-toapp]'); if (!t) return
      if (t.hasAttribute('data-close')) return state.close()
      if (t.hasAttribute('data-skip')) { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); return skip() }
      if (t.hasAttribute('data-copy')) {
        var url = inApp() ? location.href : location.origin + (full ? '/' : '/intro/')
        var done = function () { t.textContent = '복사했어요' }
        var fail = function () {
          var ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
          sh.appendChild(ta); ta.select(); var okc = false; try { okc = document.execCommand('copy') } catch (er) {} ta.remove()
          if (okc) return done()
          var inp = document.createElement('input'); inp.className = 'url'; inp.readOnly = true; inp.value = url; inp.setAttribute('aria-label', '이 주소를 길게 눌러 복사해 주세요')
          t.replaceWith(inp); inp.focus(); inp.select()
        }
        try { navigator.clipboard.writeText(url).then(done, fail) } catch (err) { fail() }
        return
      }
      if (t.hasAttribute('data-toapp')) { try { sessionStorage.setItem(FORCE_KEY, '1') } catch (er) {} return location.replace('/') }
      if (t.hasAttribute('data-ext')) { var ia = inApp(); if (!ia || !ia.openExternal()) { var h = b.querySelector('[data-hint]'); if (h) h.style.color = '#c8f53c' } return }
      if (t.hasAttribute('data-prompt') && deferred) {
        var p = deferred; deferred = null
        p.prompt(); dispatchEvent(new Event('bt-install-prompt-used'))
        p.userChoice.then(function (r) { return r }, function () { return {} }).then(function (r) { if (cur === state) { state.render(r && r.outcome === 'accepted' ? 'done' : undefined); focusFirst() } })
      }
    })
    cur = state
    state.render()
    document.body.appendChild(box); document.documentElement.classList.add('bti-open')
    others.forEach(function (el) { el.inert = true })
    addEventListener('keydown', onKey, true)
    if (full) box.classList.add('on'); else requestAnimationFrame(function () { box.classList.add('on') })
    focusFirst()
    return state.close
  }

  // 소개 페이지에서 '앱 화면에서 설치하기'로 넘어왔으면 로그인 여부와 상관없이 앱 첫 화면에서 바로 같은 안내를 띄운다(한 번만)
  if (atApp && !standalone) {
    var force = false
    try { force = sessionStorage.getItem(FORCE_KEY) === '1'; sessionStorage.removeItem(FORCE_KEY) } catch (e) {}
    if (force) { var go = function () { open({ mode: 'full' }) }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go() }
  }

  window.BTInstall = {
    open: open,
    isStandalone: function () { return standalone },
    // 앱 로그인 전 전체 화면 안내: 브라우저 모드의 휴대폰(아이폰·안드로이드·인앱)에서만, '브라우저에서 계속' 뒤 7일은 띄우지 않음.
    // PC는 띄우지 않는다(관리자·트레이너가 PC 브라우저로 쓰고, PC 설치를 권할 이유가 없음).
    shouldGate: function () { return !standalone && !(cur && cur.full) && (os === 'ios' || os === 'android' || !!inApp()) && !skippedRecently() },
  }
})()
