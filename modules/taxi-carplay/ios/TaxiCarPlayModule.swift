import ExpoModulesCore
import Foundation

public final class TaxiCarPlayModule: Module {
  private var stateObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("TaxiCarPlay")
    Events("onStateChange")

    OnStartObserving { [weak self] in
      guard let self, self.stateObserver == nil else { return }
      self.stateObserver = NotificationCenter.default.addObserver(
        forName: .taxiMeterDidChange, object: nil, queue: .main
      ) { [weak self] _ in
        MainActor.assumeIsolated {
          self?.sendEvent("onStateChange", TaxiMeterRuntime.shared.snapshot())
        }
      }
    }
    OnStopObserving { [weak self] in self?.removeObserver() }
    OnDestroy { [weak self] in self?.removeObserver() }

    AsyncFunction("getSnapshot") { () -> [String: Any] in
      MainActor.assumeIsolated { TaxiMeterRuntime.shared.snapshot() }
    }.runOnQueue(.main)
    AsyncFunction("begin") { (mode: String?) -> [String: Any] in
      MainActor.assumeIsolated {
        TaxiMeterRuntime.shared.begin(mode: mode.flatMap(TaxiTripMode.init(rawValue:)) ?? .log)
        return TaxiMeterRuntime.shared.snapshot()
      }
    }.runOnQueue(.main)
    AsyncFunction("pause") { () -> [String: Any] in
      MainActor.assumeIsolated {
        TaxiMeterRuntime.shared.pause()
        return TaxiMeterRuntime.shared.snapshot()
      }
    }.runOnQueue(.main)
    AsyncFunction("finish") { () -> [String: Any] in
      MainActor.assumeIsolated {
        TaxiMeterRuntime.shared.finish()
        return TaxiMeterRuntime.shared.snapshot()
      }
    }.runOnQueue(.main)
    AsyncFunction("reset") { () -> [String: Any] in
      MainActor.assumeIsolated {
        TaxiMeterRuntime.shared.reset()
        return TaxiMeterRuntime.shared.snapshot()
      }
    }.runOnQueue(.main)
    AsyncFunction("acknowledgeTrips") { (ids: [String]) -> [String: Any] in
      MainActor.assumeIsolated {
        TaxiMeterRuntime.shared.acknowledgeTrips(ids: ids)
        return TaxiMeterRuntime.shared.snapshot()
      }
    }.runOnQueue(.main)
  }

  private func removeObserver() {
    if let stateObserver { NotificationCenter.default.removeObserver(stateObserver) }
    stateObserver = nil
  }
}
