import ExpoModulesCore
import GameKit
import UIKit

public final class OffsideGameCenterModule: Module {
  private var authentication: Promise?

  public func definition() -> ModuleDefinition {
    Name("OffsideGameCenter")

    AsyncFunction("getPlayer") { () -> [String: String]? in
      self.player()
    }.runOnQueue(.main)

    // Only an explicit user action calls authenticate; background sync never opens a login UI.
    AsyncFunction("authenticate") { (promise: Promise) in
      if let player = self.player() {
        promise.resolve(player)
        return
      }
      guard self.authentication == nil else {
        promise.reject("ERR_GAME_CENTER_BUSY", "Authentication is already in progress")
        return
      }
      self.authentication = promise
      GKLocalPlayer.local.authenticateHandler = { [weak self] controller, error in
        DispatchQueue.main.async {
          guard let self, let pending = self.authentication else { return }
          if let controller {
            guard let presenter = self.appContext?.utilities?.currentViewController(),
              !presenter.isBeingDismissed else {
              self.authentication = nil
              pending.reject("ERR_GAME_CENTER_PRESENTATION", "No active view controller")
              return
            }
            presenter.present(controller, animated: true)
          } else {
            self.authentication = nil
            if let player = self.player() {
              pending.resolve(player)
            } else if let error {
              pending.reject(error)
            } else {
              pending.reject("ERR_GAME_CENTER_SIGN_IN", "Game Center sign-in was not completed")
            }
          }
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("submitProgress") {
      (playerID: String, leaderboardID: String, score: Int?, achievementIDs: [String], promise: Promise) in
      guard self.matches(playerID), score.map({ $0 >= 0 }) ?? true, achievementIDs.count <= 4 else {
        promise.reject("ERR_GAME_CENTER_PLAYER_CHANGED", "Player changed or progress is invalid")
        return
      }
      if let score {
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
          leaderboardIDs: [leaderboardID]) { [weak self] error in
          DispatchQueue.main.async {
            guard let self else {
              promise.reject("ERR_GAME_CENTER_UNAVAILABLE", "Module is unavailable")
              return
            }
            if let error { promise.reject(error); return }
            self.reportAchievements(achievementIDs, playerID: playerID, promise: promise)
          }
        }
      } else {
        self.reportAchievements(achievementIDs, playerID: playerID, promise: promise)
      }
    }.runOnQueue(.main)

    AsyncFunction("showDashboard") {
      (playerID: String, leaderboardID: String, achievements: Bool, promise: Promise) in
      guard self.matches(playerID) else {
        promise.reject("ERR_GAME_CENTER_PLAYER_CHANGED", "Game Center player changed")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController(),
        presenter.viewIfLoaded?.window != nil,
        !GKAccessPoint.shared.isPresentingGameCenter else {
        promise.reject("ERR_GAME_CENTER_PRESENTATION", "Dashboard cannot be presented now")
        return
      }
      GKAccessPoint.shared.parentWindow = presenter.view.window
      // No floating access-point overlay: settings owns the accessible entry buttons.
      if achievements {
        GKAccessPoint.shared.trigger(state: .achievements) { promise.resolve(true) }
      } else if #available(iOS 18.0, *) {
        GKAccessPoint.shared.trigger(leaderboardID: leaderboardID,
          playerScope: .global, timeScope: .allTime) { promise.resolve(true) }
      } else {
        GKAccessPoint.shared.trigger(state: .leaderboards) { promise.resolve(true) }
      }
    }.runOnQueue(.main)

    OnDestroy {
      self.authentication?.reject("ERR_GAME_CENTER_UNAVAILABLE", "Module was destroyed")
      self.authentication = nil
      GKLocalPlayer.local.authenticateHandler = nil
    }
  }

  private func player() -> [String: String]? {
    guard GKLocalPlayer.local.isAuthenticated else { return nil }
    return ["id": GKLocalPlayer.local.gamePlayerID, "alias": GKLocalPlayer.local.displayName]
  }

  private func matches(_ playerID: String) -> Bool {
    GKLocalPlayer.local.isAuthenticated && GKLocalPlayer.local.gamePlayerID == playerID
  }

  private func reportAchievements(_ identifiers: [String], playerID: String, promise: Promise) {
    guard matches(playerID) else {
      promise.reject("ERR_GAME_CENTER_PLAYER_CHANGED", "Game Center player changed")
      return
    }
    guard !identifiers.isEmpty else { promise.resolve(true); return }
    let achievements = identifiers.map { identifier in
      let achievement = GKAchievement(identifier: identifier)
      achievement.percentComplete = 100
      achievement.showsCompletionBanner = true
      return achievement
    }
    GKAchievement.report(achievements) { error in
      if let error { promise.reject(error) } else { promise.resolve(true) }
    }
  }
}
