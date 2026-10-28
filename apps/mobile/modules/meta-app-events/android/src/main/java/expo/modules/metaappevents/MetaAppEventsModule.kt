package expo.modules.metaappevents

import android.app.Application
import com.facebook.FacebookSdk
import com.facebook.appevents.AppEventsLogger
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// T-11-561 Meta 앱 설치 측정(앱 설치 광고의 설치 수). 매니페스트에서 자동 초기화 · 자동 이벤트 · 광고 ID 수집을 꺼 두고
// (plugins/withMetaAppEvents.js), 앱 이용 분석에 동의한 경우에만 JS가 setEnabled(true)를 부른다. 켠 값은 SDK가 기기에
// 기억하므로 다음 실행부터는 SDK가 스스로 앱 실행을 보낸다. 철회하면 setEnabled(false)로 다시 끈다.
class MetaAppEventsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MetaAppEvents")

    /** 바꿨으면 true. 앱 ID · 클라이언트 토큰이 없는 빌드처럼 SDK가 준비되지 않았으면 false. */
    Function("setEnabled") { enabled: Boolean ->
      val app = appContext.reactContext?.applicationContext as? Application ?: return@Function false
      try {
        if (!FacebookSdk.isInitialized()) return@Function false
        val wasEnabled = FacebookSdk.getAutoInitEnabled()
        FacebookSdk.setAutoLogAppEventsEnabled(enabled)
        FacebookSdk.setAutoInitEnabled(enabled)
        if (enabled && !wasEnabled) {
          // 이번 실행은 이미 화면이 떠 있어 자동 기록이 놓친다. 처음 켤 때만 직접 한 번 보낸다.
          FacebookSdk.fullyInitialize()
          AppEventsLogger.activateApp(app)
        }
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
