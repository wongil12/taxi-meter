import Foundation

enum TaxiMeterStatus: String, Codable {
  case idle, running, paused, finished
}

enum TaxiTripMode: String, Codable {
  case log, taxi
}

/// The shared native fare state. It intentionally contains no location history.
struct TaxiMeterEngine: Codable {
  private(set) var mode: TaxiTripMode = .log
  private(set) var status: TaxiMeterStatus = .idle
  private(set) var totalDistanceMeters = 0.0
  private(set) var chargeableDistanceMeters = 0.0
  private(set) var lowSpeedSeconds = 0.0

  init() {}

  private enum CodingKeys: String, CodingKey {
    case mode, status, totalDistanceMeters, chargeableDistanceMeters, lowSpeedSeconds
  }

  init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    // Existing interrupted taxi trips must never silently become free log trips.
    mode = try values.decodeIfPresent(TaxiTripMode.self, forKey: .mode) ?? .taxi
    status = try values.decode(TaxiMeterStatus.self, forKey: .status)
    totalDistanceMeters = try values.decode(Double.self, forKey: .totalDistanceMeters)
    chargeableDistanceMeters = try values.decode(Double.self, forKey: .chargeableDistanceMeters)
    lowSpeedSeconds = try values.decode(Double.self, forKey: .lowSpeedSeconds)
  }

  var fare: Int {
    guard status != .idle, mode == .taxi else { return 0 }
    return 4_800 + Int(floor((chargeableDistanceMeters + 1e-9) / 131)) * 100
      + Int(floor((lowSpeedSeconds + 1e-9) / 30)) * 100
  }

  var isValid: Bool {
    [totalDistanceMeters, chargeableDistanceMeters, lowSpeedSeconds].allSatisfy {
      $0.isFinite && $0 >= 0 && $0 < 1e12
    } && chargeableDistanceMeters <= totalDistanceMeters + 1e-6
  }

  mutating func begin(mode requestedMode: TaxiTripMode = .log) {
    if status == .idle { mode = requestedMode; status = .running }
    else if status == .paused { status = .running }
  }

  mutating func pause() {
    if status == .running { status = .paused }
  }

  mutating func finish() {
    if status == .running || status == .paused { status = .finished }
  }

  mutating func reset() { self = TaxiMeterEngine() }

  /// Unknown speed never means stationary. All measured distance above the base
  /// distance is charged; known low speed adds time, matching the JS engine.
  mutating func tick(elapsedSeconds: Double, distanceMeters: Double, speedKmh: Double?) {
    guard status == .running, elapsedSeconds.isFinite, elapsedSeconds > 0,
      distanceMeters.isFinite, distanceMeters >= 0,
      speedKmh == nil || (speedKmh!.isFinite && speedKmh! >= 0) else { return }
    let remainingBase = max(0, 1_600 - totalDistanceMeters)
    let extraDistance = max(0, distanceMeters - remainingBase)
    let fraction = remainingBase == 0 ? 1 : distanceMeters > 0 ? extraDistance / distanceMeters : 0
    totalDistanceMeters += distanceMeters
    guard mode == .taxi else { return }
    chargeableDistanceMeters += extraDistance
    if let speedKmh, speedKmh <= 15 { lowSpeedSeconds += elapsedSeconds * fraction }
  }
}

struct TaxiGPSFix {
  let latitude: Double
  let longitude: Double
  let accuracyMeters: Double
  let timestamp: TimeInterval
  let speedMetersPerSecond: Double?
  /// Core Location reports negative accuracy when speed accuracy is unavailable.
  let speedAccuracyMetersPerSecond: Double?

  init(latitude: Double, longitude: Double, accuracyMeters: Double, timestamp: TimeInterval,
       speedMetersPerSecond: Double? = nil, speedAccuracyMetersPerSecond: Double? = nil) {
    self.latitude = latitude
    self.longitude = longitude
    self.accuracyMeters = accuracyMeters
    self.timestamp = timestamp
    self.speedMetersPerSecond = speedMetersPerSecond
    self.speedAccuracyMetersPerSecond = speedAccuracyMetersPerSecond
  }

  var nativeSpeed: Double? {
    guard let speed = speedMetersPerSecond, speed.isFinite, speed >= 0, speed <= 50 else { return nil }
    if let accuracy = speedAccuracyMetersPerSecond {
      guard accuracy.isFinite, accuracy >= 0, accuracy <= 3 else { return nil }
    }
    return speed
  }
}

enum TaxiGPSReason: String {
  case initial, movement, stationary, gap
  case positionNoise = "position-noise"
  case invalid, inaccurate, stale
  case outOfOrder = "out-of-order"
  case unrealisticSpeed = "unrealistic-speed"
}

struct TaxiGPSResult {
  let accepted: Bool
  let reason: TaxiGPSReason
  let distanceMeters: Double
  let elapsedSeconds: Double
  let billingSpeedKmh: Double?
  let displaySpeedKmh: Double?
}

/// Pure foreground/background-independent filter, driven by actual fix times.
/// The runtime decides whether location collection is currently permitted.
struct TaxiGPSTracker {
  static let speedExpirySeconds = 4.0
  private(set) var lastFix: TaxiGPSFix?
  private var distanceAnchor: TaxiGPSFix?
  private var speedWindow: [TaxiGPSFix] = []
  private var nativeSpeeds: [(speed: Double, timestamp: TimeInterval)] = []
  private var displaySpeedKmh: Double?

  mutating func reset() { self = TaxiGPSTracker() }

  static func distance(_ a: TaxiGPSFix, _ b: TaxiGPSFix) -> Double {
    let radians = Double.pi / 180
    let latitude = (b.latitude - a.latitude) * radians
    let longitude = (b.longitude - a.longitude) * radians
    let h = pow(sin(latitude / 2), 2) + cos(a.latitude * radians) * cos(b.latitude * radians)
      * pow(sin(longitude / 2), 2)
    return 6_371_000 * 2 * asin(sqrt(min(1, max(0, h))))
  }

  mutating func process(_ fix: TaxiGPSFix, now: TimeInterval) -> TaxiGPSResult {
    func rejected(_ reason: TaxiGPSReason) -> TaxiGPSResult {
      TaxiGPSResult(accepted: false, reason: reason, distanceMeters: 0, elapsedSeconds: 0,
        billingSpeedKmh: nil, displaySpeedKmh: nil)
    }
    // Old/duplicate callbacks must not invalidate a newer trusted baseline.
    if fix.timestamp.isFinite, let previous = lastFix, fix.timestamp <= previous.timestamp {
      return rejected(.outOfOrder)
    }
    guard [fix.latitude, fix.longitude, fix.accuracyMeters, fix.timestamp, now].allSatisfy({ $0.isFinite }),
      abs(fix.latitude) <= 90, abs(fix.longitude) <= 180, fix.accuracyMeters >= 0,
      fix.timestamp >= 0, fix.timestamp <= now + 2 else { return rejected(.invalid) }
    guard now - fix.timestamp <= Self.speedExpirySeconds else { return rejected(.stale) }
    guard fix.accuracyMeters <= 35 else { return rejected(.inaccurate) }

    guard let previous = lastFix, fix.timestamp - previous.timestamp <= Self.speedExpirySeconds else {
      let reason: TaxiGPSReason = lastFix == nil ? .initial : .gap
      reset()
      let speeds = measureSpeed(fix)
      lastFix = fix
      distanceAnchor = fix
      return TaxiGPSResult(accepted: true, reason: reason, distanceMeters: 0, elapsedSeconds: 0,
        billingSpeedKmh: speeds.raw, displaySpeedKmh: speeds.display)
    }

    let elapsed = fix.timestamp - previous.timestamp
    let segment = Self.distance(previous, fix)
    let limit = 50 * elapsed
    guard segment <= limit + previous.accuracyMeters + fix.accuracyMeters else {
      return rejected(.unrealisticSpeed)
    }
    let positionNoise = segment > limit
    let anchor = distanceAnchor ?? previous
    let distance = Self.distance(anchor, fix)
    let speeds = measureSpeed(fix)
    let stationary = fix.nativeSpeed.map { $0 <= 0.5 } ?? false
    let deadband = max(3, anchor.accuracyMeters + fix.accuracyMeters)
    let moving = !stationary && !positionNoise && distance >= deadband
    if moving || stationary || positionNoise { distanceAnchor = fix }
    lastFix = fix
    return TaxiGPSResult(accepted: true, reason: positionNoise ? .positionNoise : moving ? .movement : .stationary,
      distanceMeters: moving ? distance : 0, elapsedSeconds: elapsed,
      billingSpeedKmh: speeds.raw, displaySpeedKmh: speeds.display)
  }

  private mutating func measureSpeed(_ fix: TaxiGPSFix) -> (raw: Double?, display: Double?) {
    speedWindow.append(fix)
    speedWindow.removeAll { fix.timestamp - $0.timestamp > 5 }
    var raw: Double?
    if let native = fix.nativeSpeed {
      nativeSpeeds.append((native, fix.timestamp))
      nativeSpeeds = Array(nativeSpeeds.filter { fix.timestamp - $0.timestamp <= Self.speedExpirySeconds }.suffix(3))
      if native <= 0.5 {
        raw = 0
        nativeSpeeds = [(0, fix.timestamp)]
      } else if nativeSpeeds.count == 3 {
        raw = nativeSpeeds.map(\.speed).sorted()[1] * 3.6
      } else if nativeSpeeds.count == 2 {
        let previous = nativeSpeeds[0]
        let dt = fix.timestamp - previous.timestamp
        raw = (dt > 0 && abs(native - previous.speed) / dt > 8 ? previous.speed : native) * 3.6
      } else { raw = native * 3.6 }
    } else {
      nativeSpeeds = []
      if let first = speedWindow.first {
        let duration = fix.timestamp - first.timestamp
        let displacement = Self.distance(first, fix)
        if duration >= 3, displacement > max(3, first.accuracyMeters + fix.accuracyMeters) {
          let estimate = displacement / duration * 3.6
          if estimate <= 180 { raw = estimate }
        }
      }
    }
    if let raw, raw != 0, let previousDisplay = displaySpeedKmh, let previous = lastFix {
      let alpha = 1 - exp(-(fix.timestamp - previous.timestamp) / 1.5)
      displaySpeedKmh = previousDisplay + alpha * (raw - previousDisplay)
    } else { displaySpeedKmh = raw }
    return (raw, displaySpeedKmh)
  }
}
