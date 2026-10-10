import Foundation
import UIKit
@preconcurrency import CoreLocation

extension Notification.Name {
  static let taxiMeterDidChange = Notification.Name("TaxiMeterDidChange")
}

private struct TaxiNativeTrip: Codable {
  let id: String
  let startedAt: String
  let endedAt: String
  let durationSeconds: Double
  let distanceMeters: Double
  let fare: Int
  /// Missing only for records saved by the original taxi-only release.
  let mode: TaxiTripMode?

  var dictionary: [String: Any] {
    ["id": id, "startedAt": startedAt, "endedAt": endedAt, "durationSeconds": durationSeconds,
     "distanceMeters": distanceMeters, "fare": fare, "mode": (mode ?? .taxi).rawValue]
  }
}

private struct TaxiNativeCheckpoint: Codable {
  let version: Int
  var engine: TaxiMeterEngine
  let elapsedSeconds: Double
  let tripID: String?
  let startedAt: String?
  let completedTrip: TaxiNativeTrip?
  let pendingTrips: [TaxiNativeTrip]
}

/// One authoritative meter shared by Expo and CarPlay. No JS timer or location
/// callback is needed for a connected car to keep measuring.
@MainActor
final class TaxiMeterRuntime: NSObject, @preconcurrency CLLocationManagerDelegate {
  static let shared = TaxiMeterRuntime()

  private let manager = CLLocationManager()
  private let storage = UserDefaults.standard
  private let storageKey = "taxi-meter.native-runtime.v1"
  private var engine = TaxiMeterEngine()
  private var tracker = TaxiGPSTracker()
  private var accumulatedSeconds = 0.0
  private var runningSince: TimeInterval?
  private var tripID: String?
  private var startedAt: String?
  private var completedTrip: TaxiNativeTrip?
  private var pendingTrips: [TaxiNativeTrip] = []
  private var speedKmh: Double?
  private var gpsMessage = "시작하면 위치 접근 권한을 요청합니다."
  private var busy = false
  private var pendingBegin = false
  private var requestedMode: TaxiTripMode = .log
  private var carPlayConnected = false
  private var timer: Timer?
  private var lastCheckpointUptime = 0.0
  private var revision = 0

  private override init() {
    super.init()
    restore()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    manager.distanceFilter = kCLDistanceFilterNone
    manager.activityType = .automotiveNavigation
    manager.pausesLocationUpdatesAutomatically = false
    NotificationCenter.default.addObserver(self, selector: #selector(didEnterBackground),
      name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(didBecomeActive),
      name: UIApplication.didBecomeActiveNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(didEnterBackground),
      name: UIScene.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(didBecomeActive),
      name: UIScene.didActivateNotification, object: nil)
    let displayTimer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
      Task { @MainActor [weak self] in self?.timerTick() }
    }
    timer = displayTimer
    RunLoop.main.add(displayTimer, forMode: .common)
  }

  /// UIApplication.applicationState aggregates every scene, including CarPlay.
  /// Permission prompts specifically require a visible, active phone scene.
  private var foreground: Bool {
    let app = UIApplication.shared
    if Bundle.main.object(forInfoDictionaryKey: "UIApplicationSceneManifest") != nil {
      return app.connectedScenes.contains {
        $0.session.role == .windowApplication && $0.activationState == .foregroundActive
      }
    }
    return app.applicationState == .active
  }
  private var backgroundConfigured: Bool {
    (Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String])?.contains("location") == true
  }
  private var elapsedSeconds: Double {
    accumulatedSeconds + (runningSince.map { max(0, ProcessInfo.processInfo.systemUptime - $0) } ?? 0)
  }

  func snapshot() -> [String: Any] {
    ["revision": revision, "tripID": tripID as Any? ?? NSNull(),
     "status": engine.status.rawValue, "mode": engine.mode.rawValue, "fare": engine.fare,
     "totalDistanceMeters": engine.totalDistanceMeters,
     "chargeableDistanceMeters": engine.chargeableDistanceMeters,
     "lowSpeedSeconds": engine.lowSpeedSeconds,
     "elapsedSeconds": floor(elapsedSeconds),
     "speedKmh": speedKmh as Any? ?? NSNull(), "gpsMessage": gpsMessage,
     "busy": busy, "carPlayConnected": carPlayConnected,
     "completedTrip": completedTrip?.dictionary as Any? ?? NSNull(),
     "pendingTrips": pendingTrips.map(\.dictionary)]
  }

  func begin(mode: TaxiTripMode = .log) {
    guard engine.status == .idle || engine.status == .paused, !busy else { return }
    requestedMode = engine.status == .idle ? mode : engine.mode
    guard engine.status != .idle || pendingTrips.count < 100 else {
      gpsMessage = "보관 중인 주행 기록이 가득 찼습니다. 휴대폰 앱을 열어 기록을 저장해 주세요."
      publish(); return
    }
    guard foreground || carPlayConnected else {
      gpsMessage = "휴대폰 앱 또는 연결된 CarPlay에서 주행을 시작해 주세요."
      publish(); return
    }
    guard CLLocationManager.locationServicesEnabled() else {
      gpsMessage = "위치 서비스가 꺼져 있습니다. 휴대폰 설정에서 켜 주세요."
      publish(); return
    }
    switch manager.authorizationStatus {
    case .notDetermined:
      guard foreground else {
        gpsMessage = "휴대폰에서 앱을 열고 위치 접근 권한을 허용해 주세요."
        publish(); return
      }
      pendingBegin = true
      busy = true
      gpsMessage = "위치 접근 권한을 기다립니다."
      manager.requestWhenInUseAuthorization()
      publish()
    case .authorizedAlways, .authorizedWhenInUse:
      startAuthorized()
    case .denied, .restricted:
      gpsMessage = "휴대폰 설정에서 이 앱의 위치 접근과 정확한 위치를 허용해 주세요."
      publish()
    @unknown default:
      gpsMessage = "위치 권한을 확인할 수 없습니다. 휴대폰 설정을 확인해 주세요."
      publish()
    }
  }

  private func startAuthorized() {
    pendingBegin = false
    busy = false
    guard foreground || carPlayConnected else { publish(); return }
    guard manager.accuracyAuthorization == .fullAccuracy else {
      gpsMessage = "휴대폰 설정 > 이 앱 > 위치에서 ‘정확한 위치’를 켜 주세요."
      publish(); return
    }
    guard foreground || backgroundConfigured else {
      gpsMessage = "차량 측정을 지원하는 최신 앱으로 업데이트한 뒤 다시 시작해 주세요."
      publish(); return
    }
    if engine.status == .idle {
      tripID = UUID().uuidString
      startedAt = Self.dateString(Date())
      accumulatedSeconds = 0
      completedTrip = nil
    }
    engine.begin(mode: requestedMode)
    runningSince = ProcessInfo.processInfo.systemUptime
    tracker.reset()
    speedKmh = nil
    gpsMessage = "GPS 신호를 찾고 있습니다…"
    configureBackgroundCollection()
    manager.startUpdatingLocation()
    persist()
    publish()
  }

  func pause() {
    pendingBegin = false
    busy = false
    stopCollection()
    engine.pause()
    gpsMessage = "일시정지 · 측정을 멈췄습니다."
    persist()
    publish()
  }

  func finish() {
    guard engine.status == .running || engine.status == .paused,
      let tripID, let startedAt else { return }
    guard pendingTrips.count < 100 || pendingTrips.contains(where: { $0.id == tripID }) else {
      pause()
      gpsMessage = "기록 저장 공간이 가득 찼습니다. 휴대폰 앱에서 기록을 저장한 뒤 주행을 종료해 주세요."
      publish(); return
    }
    pendingBegin = false
    busy = false
    stopCollection()
    engine.finish()
    let startDate = Self.parseDate(startedAt) ?? Date()
    let ended = max(Date(), startDate)
    let trip = TaxiNativeTrip(id: tripID, startedAt: startedAt, endedAt: Self.dateString(ended),
      durationSeconds: floor(elapsedSeconds), distanceMeters: engine.totalDistanceMeters, fare: engine.fare,
      mode: engine.mode)
    completedTrip = trip
    pendingTrips.removeAll { $0.id == trip.id }
    pendingTrips.insert(trip, at: 0)
    gpsMessage = "이번 주행을 마쳤습니다."
    // Persist the native outbox before notifying either UI. JS acknowledges only
    // after its own history write succeeds, including after process restarts.
    persist()
    publish()
  }

  func reset() {
    pendingBegin = false
    busy = false
    stopCollection()
    engine.reset()
    requestedMode = .log
    accumulatedSeconds = 0
    tripID = nil
    startedAt = nil
    completedTrip = nil
    gpsMessage = "새로운 주행을 시작해 보세요."
    persist()
    publish()
  }

  func setCarPlayConnected(_ connected: Bool) {
    carPlayConnected = connected
    if !connected && !foreground && engine.status == .running {
      stopCollection()
      engine.pause()
      gpsMessage = "CarPlay 연결이 끊겨 측정을 멈췄습니다. 다시 시작해 주세요."
      persist()
    }
    configureBackgroundCollection()
    publish()
  }

  func acknowledgeTrips(ids: [String]) {
    let acknowledged = Set(ids)
    pendingTrips.removeAll { acknowledged.contains($0.id) }
    persist()
    publish()
  }

  private func configureBackgroundCollection() {
    let allowed = carPlayConnected && engine.status == .running && backgroundConfigured
    manager.allowsBackgroundLocationUpdates = allowed
    manager.showsBackgroundLocationIndicator = allowed
  }

  private func stopCollection() {
    if runningSince != nil {
      accumulatedSeconds = elapsedSeconds
      runningSince = nil
    }
    manager.stopUpdatingLocation()
    manager.allowsBackgroundLocationUpdates = false
    tracker.reset()
    speedKmh = nil
  }

  @objc private func didEnterBackground() {
    // Another scene may background while the phone remains visible.
    guard !foreground else { return }
    guard !foreground else { return }
    if engine.status == .running && (!carPlayConnected || !backgroundConfigured) {
      stopCollection()
      engine.pause()
      gpsMessage = "앱을 벗어나 측정을 멈췄습니다. 다시 시작해 주세요."
      persist()
      publish()
    } else if pendingBegin && !carPlayConnected {
      pendingBegin = false
      busy = false
      publish()
    }
  }

  @objc private func didBecomeActive() {
    if pendingBegin, manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
      startAuthorized()
    } else { publish() }
  }

  private func timerTick() {
    guard engine.status == .running else { return }
    if let fix = tracker.lastFix, Date().timeIntervalSince1970 - fix.timestamp > TaxiGPSTracker.speedExpirySeconds {
      tracker.reset()
      speedKmh = nil
      gpsMessage = "GPS 신호를 기다립니다. 미수신 구간은 계산하지 않습니다."
    }
    checkpointIfNeeded()
    publish()
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      if manager.accuracyAuthorization != .fullAccuracy {
        if engine.status == .running { stopCollection(); engine.pause() }
        pendingBegin = false
        busy = false
        gpsMessage = "휴대폰 설정 > 이 앱 > 위치에서 ‘정확한 위치’를 켜 주세요."
        persist(); publish()
      } else if pendingBegin {
        // Permission sheets temporarily make the phone inactive. Wait for the
        // active notification rather than treating the sheet as an app exit.
        if foreground || carPlayConnected { startAuthorized() }
      }
    case .denied, .restricted:
      pendingBegin = false
      busy = false
      if engine.status == .running { stopCollection(); engine.pause() }
      gpsMessage = "휴대폰 설정에서 이 앱의 위치 접근과 정확한 위치를 허용해 주세요."
      persist(); publish()
    case .notDetermined: break
    @unknown default: break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard engine.status == .running else { return }
    if !foreground && !carPlayConnected { didEnterBackground(); return }
    let now = Date().timeIntervalSince1970
    for location in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
      let fix = TaxiGPSFix(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
        accuracyMeters: location.horizontalAccuracy, timestamp: location.timestamp.timeIntervalSince1970,
        speedMetersPerSecond: location.speed, speedAccuracyMetersPerSecond: location.speedAccuracy)
      let result = tracker.process(fix, now: now)
      guard result.accepted else {
        if result.reason == .outOfOrder || result.reason == .stale { continue }
        tracker.reset()
        speedKmh = nil
        gpsMessage = "GPS 정확도가 낮습니다. 신호가 회복되면 계산합니다."
        continue
      }
      speedKmh = result.displaySpeedKmh
      engine.tick(elapsedSeconds: result.elapsedSeconds, distanceMeters: result.distanceMeters,
        speedKmh: result.billingSpeedKmh)
      gpsMessage = result.billingSpeedKmh == nil ? (engine.mode == .taxi
        ? "속도 확인 중 · 불확실한 구간의 시간 요금은 제외합니다." : "GPS 연결됨 · 속도 확인 중")
        : carPlayConnected ? "GPS 연결됨 · CarPlay에서 측정 중" : "GPS 연결됨 · 휴대폰에서 측정 중"
    }
    checkpointIfNeeded()
    publish()
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    guard engine.status == .running else { return }
    tracker.reset()
    speedKmh = nil
    if (error as? CLError)?.code == .denied {
      stopCollection()
      engine.pause()
      gpsMessage = "위치 접근이 중단됐습니다. 휴대폰 설정을 확인해 주세요."
      persist()
    } else {
      gpsMessage = "GPS 신호를 기다립니다. 미수신 구간은 계산하지 않습니다."
    }
    publish()
  }

  private func publish() {
    revision += 1
    NotificationCenter.default.post(name: .taxiMeterDidChange, object: self, userInfo: ["snapshot": snapshot()])
  }

  private func checkpointIfNeeded() {
    if ProcessInfo.processInfo.systemUptime - lastCheckpointUptime >= 5 { persist() }
  }

  private func persist() {
    let checkpoint = TaxiNativeCheckpoint(version: 1, engine: engine, elapsedSeconds: elapsedSeconds,
      tripID: tripID, startedAt: startedAt, completedTrip: completedTrip, pendingTrips: pendingTrips)
    if let data = try? JSONEncoder().encode(checkpoint) { storage.set(data, forKey: storageKey) }
    lastCheckpointUptime = ProcessInfo.processInfo.systemUptime
  }

  private func restore() {
    guard let data = storage.data(forKey: storageKey),
      let saved = try? JSONDecoder().decode(TaxiNativeCheckpoint.self, from: data),
      saved.version == 1, saved.engine.isValid, saved.elapsedSeconds.isFinite, saved.elapsedSeconds >= 0 else { return }
    engine = saved.engine
    accumulatedSeconds = saved.elapsedSeconds
    tripID = saved.tripID
    startedAt = saved.startedAt
    completedTrip = saved.completedTrip
    pendingTrips = Array(saved.pendingTrips.prefix(100))
    if engine.status == .running {
      engine.pause()
      gpsMessage = "중단된 주행을 복원했습니다. 다시 시작하면 이어서 측정합니다."
    } else if engine.status == .paused {
      gpsMessage = "일시정지한 주행입니다. 다시 시작하면 이어서 측정합니다."
    } else if engine.status == .finished {
      gpsMessage = "이번 주행을 마쳤습니다."
    }
  }

  private static func dateString(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }

  private static func parseDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value)
  }
}
