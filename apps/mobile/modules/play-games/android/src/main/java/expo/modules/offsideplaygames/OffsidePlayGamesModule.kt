package expo.modules.offsideplaygames

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.leaderboard.LeaderboardVariant
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OffsidePlayGamesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OffsidePlayGames")

    AsyncFunction("getPlayer") { promise: Promise ->
      val activity = activity(promise) ?: return@AsyncFunction
      readPlayer(activity).addOnSuccessListener { promise.resolve(it) }
        .addOnFailureListener { fail(promise, it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("authenticate") { promise: Promise ->
      val activity = activity(promise) ?: return@AsyncFunction
      // Only the explicit Connect/Open action can initiate profile creation.
      PlayGames.getGamesSignInClient(activity).signIn().addOnSuccessListener { state ->
        if (!state.isAuthenticated) {
          promise.reject("ERR_GAME_CENTER_SIGN_IN", "Play Games sign-in was not completed", null)
        } else {
          readPlayer(activity).addOnSuccessListener { player ->
            if (player == null) promise.reject("ERR_GAME_CENTER_SIGN_IN", "No Play Games player", null)
            else promise.resolve(player)
          }.addOnFailureListener { fail(promise, it) }
        }
      }.addOnFailureListener { fail(promise, it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("submitProgress") {
      playerId: String, boardId: String, score: Double?, ids: List<String>, promise: Promise ->
      val activity = activity(promise) ?: return@AsyncFunction
      if (ids.size > 18 || score?.let { !it.isFinite() || it < 0 || it % 1.0 != 0.0 } == true) {
        promise.reject("ERR_GAME_CENTER_PROGRESS", "Invalid progress", null)
        return@AsyncFunction
      }
      verifyPlayer(activity, playerId, promise) {
        val scoreTask: Task<*> = if (score == null) Tasks.forResult(null)
        else PlayGames.getLeaderboardsClient(activity).submitScoreImmediate(boardId, score.toLong())
        scoreTask.addOnSuccessListener {
          // Recheck after score upload, before sending achievements to the platform account.
          verifyPlayer(activity, playerId, promise) {
            val client = PlayGames.getAchievementsClient(activity)
            Tasks.whenAll(ids.map { client.unlockImmediate(it) })
              .addOnSuccessListener { promise.resolve(true) }
              .addOnFailureListener { fail(promise, it) }
          }
        }.addOnFailureListener { fail(promise, it) }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("showDashboard") {
      playerId: String, boardId: String, achievements: Boolean, promise: Promise ->
      val activity = activity(promise) ?: return@AsyncFunction
      verifyPlayer(activity, playerId, promise) {
        val intent = if (achievements) PlayGames.getAchievementsClient(activity).achievementsIntent
        else PlayGames.getLeaderboardsClient(activity).allLeaderboardsIntent
        intent.addOnSuccessListener {
          try {
            @Suppress("DEPRECATION")
            activity.startActivityForResult(it, 7340)
            promise.resolve(true)
          } catch (error: Exception) { fail(promise, error) }
        }.addOnFailureListener { fail(promise, it) }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("showWeeklyLeaderboard") { playerId: String, boardId: String, promise: Promise ->
      val activity = activity(promise) ?: return@AsyncFunction
      verifyPlayer(activity, playerId, promise) {
        PlayGames.getLeaderboardsClient(activity)
          .getLeaderboardIntent(boardId, LeaderboardVariant.TIME_SPAN_WEEKLY)
          .addOnSuccessListener {
            try {
              @Suppress("DEPRECATION")
              activity.startActivityForResult(it, 7341)
              promise.resolve(true)
            } catch (error: Exception) { fail(promise, error) }
          }.addOnFailureListener { fail(promise, it) }
      }
    }.runOnQueue(Queues.MAIN)
  }

  private fun activity(promise: Promise): Activity? {
    val activity = appContext.currentActivity
    if (activity == null || activity.isFinishing || activity.isDestroyed) {
      promise.reject("ERR_GAME_CENTER_PRESENTATION", "No active activity", null)
      return null
    }
    return activity
  }

  private fun readPlayer(activity: Activity): Task<Map<String, String>?> =
    PlayGames.getGamesSignInClient(activity).isAuthenticated.continueWithTask<Map<String, String>?> { state ->
      if (!state.isSuccessful) Tasks.forException(state.exception ?: IllegalStateException("Authentication unavailable"))
      else if (!state.result.isAuthenticated) Tasks.forResult(null)
      else PlayGames.getPlayersClient(activity).currentPlayer.continueWith<Map<String, String>?> { result ->
        val player = result.result
        mapOf("id" to player.playerId, "alias" to player.displayName)
      }
    }

  private fun verifyPlayer(activity: Activity, expected: String, promise: Promise, next: () -> Unit) {
    readPlayer(activity).addOnSuccessListener { player ->
      if (player?.get("id") != expected) {
        promise.reject("ERR_GAME_CENTER_PLAYER_CHANGED", "Play Games player changed", null)
      } else next()
    }.addOnFailureListener { fail(promise, it) }
  }

  private fun fail(promise: Promise, error: Exception) {
    promise.reject("ERR_GAME_CENTER_UNAVAILABLE", "Play Games request failed", error)
  }
}
