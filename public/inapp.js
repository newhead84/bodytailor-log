/* [2026-10-30] 인앱 브라우저(카카오톡·인스타그램·네이버 등) → 기본 브라우저로 열기
 * 왜: 구글은 인앱 브라우저(WebView)에서 구글 로그인을 막는다(403 disallowed_useragent). 홈 화면 추가(PWA 설치)도 기본 브라우저에서만 된다.
 * 동작: <head>에서 동기 로드(앱 index.html·홍보 페이지 /intro/ 공용).
 *  1) 카카오톡: kakaotalk://web/openExternal?url=… 로 기본 브라우저에서 다시 연다(비공식이지만 널리 쓰이는 스킴, 안드로이드·iOS) - 자동.
 *  2) 라인: ?openExternalBrowser=1 - 자동.
 *  3) 그 외 인앱(인스타그램·네이버·밴드 등): 지원되지 않는 스킴으로 자동 이동하면 오류 화면이 뜰 수 있어 자동 이동은 하지 않고,
 *     화면 위 안내 띠의 "기본 브라우저로 열기"(안드로이드는 intent://로 크롬)·"주소 복사" 버튼으로 사용자가 직접 연다.
 *  같은 탭에서 자동 이동은 한 번만(sessionStorage) - 무한 반복 방지. window.__btInApp으로 앱(LoginScreen 등)에 노출.
 */
(function () {
  var ua = (navigator.userAgent || '').toLowerCase()
  var isAndroid = ua.indexOf('android') > -1
  var kind = null
  if (ua.indexOf('kakaotalk') > -1) kind = 'kakao'
  else if (/\bline\//.test(ua)) kind = 'line'
  else if (ua.indexOf('instagram') > -1) kind = 'instagram'
  else if (ua.indexOf('fban') > -1 || ua.indexOf('fbav') > -1) kind = 'facebook'
  else if (ua.indexOf('naver(inapp') > -1) kind = 'naver'
  else if (ua.indexOf('band/') > -1) kind = 'band'
  else if (ua.indexOf('daumapps') > -1) kind = 'daum'
  else if (ua.indexOf('everytimeapp') > -1) kind = 'everytime'
  else if (ua.indexOf('trill') > -1 || ua.indexOf('musical_ly') > -1) kind = 'tiktok'

  function openExternal() {
    var url = location.href
    try {
      if (kind === 'kakao') {
        location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
        return true
      }
      if (kind === 'line') {
        location.href = url + (url.indexOf('?') > -1 ? '&' : '?') + 'openExternalBrowser=1'
        return true
      }
      if (isAndroid) {
        location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end'
        return true
      }
    } catch (e) {}
    return false
  }

  window.__btInApp = { isInApp: !!kind, kind: kind, openExternal: openExternal }
  if (!kind) return

  var KEY = 'bt-inapp-redirected'
  var tried = false
  try { tried = sessionStorage.getItem(KEY) === '1' } catch (e) {}
  if (!tried && (kind === 'kakao' || kind === 'line')) {
    try { sessionStorage.setItem(KEY, '1') } catch (e) {}
    openExternal()
  }

  function showBar() {
    if (document.getElementById('bt-inapp-bar')) return
    var bar = document.createElement('div')
    bar.id = 'bt-inapp-bar'
    bar.setAttribute('role', 'alert')
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 12px;background:#141210;color:#f5efe6;border-bottom:2px solid #c8f53c;font:14px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all;box-shadow:0 6px 20px rgba(0,0,0,.35)'
    var menu = kind === 'kakao' || kind === 'line' ? '오른쪽 위(또는 아래) ⋮ 메뉴 → "다른 브라우저로 열기"' : '오른쪽 위 ⋯ 메뉴 → "브라우저에서 열기" 또는 "Safari로 열기"'
    bar.innerHTML =
      '<b style="display:block;font-size:15px;margin-bottom:4px">기본 브라우저에서 열어 주세요</b>' +
      '<span style="color:#cfc6b8">앱 안 브라우저에서는 구글 로그인과 홈 화면 추가가 안 돼요. ' + menu + '를 눌러 주세요.</span>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button type="button" id="bt-inapp-open" style="font:700 14px inherit;font-family:inherit;padding:9px 14px;border-radius:10px;border:0;background:#c8f53c;color:#11170a">기본 브라우저로 열기</button>' +
      '<button type="button" id="bt-inapp-copy" style="font:600 14px inherit;font-family:inherit;padding:9px 14px;border-radius:10px;border:1px solid #3a342d;background:transparent;color:#f5efe6">주소 복사</button>' +
      '<button type="button" id="bt-inapp-close" aria-label="안내 닫기" style="margin-left:auto;font:600 14px inherit;font-family:inherit;padding:9px 10px;border:0;background:transparent;color:#a39b8f">닫기</button>' +
      '</div>'
    document.body.appendChild(bar)
    document.getElementById('bt-inapp-open').onclick = function () {
      if (!openExternal()) alert(menu + '를 눌러 주세요.')
    }
    document.getElementById('bt-inapp-copy').onclick = function () {
      var done = function () { document.getElementById('bt-inapp-copy').textContent = '복사했어요' }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, function () { prompt('주소를 복사해 주세요', location.href) })
      else prompt('주소를 복사해 주세요', location.href)
    }
    document.getElementById('bt-inapp-close').onclick = function () { bar.remove() }
  }
  function whenBody() {
    if (document.body) showBar()
    else setTimeout(whenBody, 50)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenBody)
  else whenBody()
})()
