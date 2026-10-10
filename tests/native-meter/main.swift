import Foundation

var checks = 0
func expect(_ condition: @autoclosure () -> Bool, _ message: String, line: UInt = #line) {
  checks += 1
  if !condition() { fatalError("Line \(line): \(message)") }
}
func near(_ value: Double, _ expected: Double, _ message: String, tolerance: Double = 1e-7) {
  expect(abs(value - expected) < tolerance, "\(message): \(value) != \(expected)")
}
func started() -> TaxiMeterEngine {
  var meter = TaxiMeterEngine()
  meter.begin(mode: .taxi)
  return meter
}
func tick(_ meter: inout TaxiMeterEngine, _ seconds: Double, _ meters: Double, _ speed: Double? = nil,
          unknown: Bool = false) {
  meter.tick(elapsedSeconds: seconds, distanceMeters: meters,
    speedKmh: unknown ? nil : speed ?? meters / seconds * 3.6)
}

// Same tariff boundaries and mixed-speed scenarios as src/domain/meter.test.ts.
do {
  var meter = TaxiMeterEngine()
  expect(meter.fare == 0, "idle fare")
  meter.begin(mode: .taxi)
  expect(meter.fare == 4800, "base fare")
  tick(&meter, 60, 500)
  meter.pause()
  tick(&meter, 60, 500)
  near(meter.totalDistanceMeters, 500, "paused meter ignores samples")
  meter.begin()
  tick(&meter, 60, 500)
  meter.finish()
  tick(&meter, 60, 500)
  near(meter.totalDistanceMeters, 1000, "finished meter ignores samples")
  meter.begin()
  expect(meter.status == .finished, "finished trip cannot restart")
  meter.reset()
  expect(meter.status == .idle && meter.fare == 0, "reset")
}
do {
  var meter = started()
  tick(&meter, 160, 1600)
  tick(&meter, 13, 130)
  expect(meter.fare == 4800, "partial distance unit is free")
  tick(&meter, 0.1, 1)
  expect(meter.fare == 4900, "exact distance boundary")
  near(meter.lowSpeedSeconds, 0, "high speed excludes time")
}
do {
  var meter = started()
  tick(&meter, 160, 1600)
  tick(&meter, 30, 125, 15)
  expect(meter.fare == 4900, "15 km/h threshold includes time")
  tick(&meter, 30, 0)
  expect(meter.fare == 5000, "stationary time")
  tick(&meter, 13.1, 131)
  expect(meter.fare == 5100, "distance continues at every speed")
  near(meter.chargeableDistanceMeters, 256, "mixed distance")
  near(meter.lowSpeedSeconds, 60, "mixed low speed duration")
}
do {
  var meter = started()
  tick(&meter, 120, 0)
  near(meter.lowSpeedSeconds, 0, "waiting within base distance is free")
  tick(&meter, 150, 1500)
  tick(&meter, 60, 200, 12)
  near(meter.lowSpeedSeconds, 30, "base crossing prorates time")
  near(meter.chargeableDistanceMeters, 100, "base crossing counts excess only")
  expect(meter.fare == 4900, "base crossing fare")
}
do {
  var meter = started()
  tick(&meter, 160, 1600)
  tick(&meter, 90, 262)
  expect(meter.fare == 5300, "distance and time units can complete together")
  var split = started()
  for _ in 0..<20 { tick(&split, 100, 250) }
  var whole = started()
  tick(&whole, 2000, 5000)
  expect(split.fare == whole.fare, "uniform split intervals preserve fare")
  near(split.lowSpeedSeconds, whole.lowSpeedSeconds, "uniform split preserves low time")
  var fractional = started()
  tick(&fractional, 160, 1600)
  for _ in 0..<300 { tick(&fractional, 0.1, 0) }
  expect(fractional.fare == 4900, "fractional billing boundary tolerance")
}
do {
  var meter = started()
  tick(&meter, 160, 1600)
  tick(&meter, 60, 131, unknown: true)
  expect(meter.fare == 4900, "unknown speed still counts trusted distance")
  near(meter.lowSpeedSeconds, 0, "unknown is not stationary")
  tick(&meter, 30, 0, 0)
  expect(meter.fare == 5000, "known stationary adds time")
  let before = meter.fare
  meter.tick(elapsedSeconds: .nan, distanceMeters: 30, speedKmh: 0)
  meter.tick(elapsedSeconds: 0, distanceMeters: 30, speedKmh: 0)
  meter.tick(elapsedSeconds: 1, distanceMeters: -1, speedKmh: 0)
  expect(meter.fare == before, "invalid ticks cannot mutate fare")
  let restored = try JSONDecoder().decode(TaxiMeterEngine.self, from: JSONEncoder().encode(meter))
  expect(restored.fare == meter.fare && restored.isValid, "fare checkpoint round trip")
}

func fix(_ seconds: Double, meters: Double = 0, speed: Double? = 10,
         accuracy: Double = 5, speedAccuracy: Double? = 0.5) -> TaxiGPSFix {
  TaxiGPSFix(latitude: meters / 111_194.92664455874, longitude: 0, accuracyMeters: accuracy,
    timestamp: 1_000 + seconds, speedMetersPerSecond: speed, speedAccuracyMetersPerSecond: speedAccuracy)
}
do {
  var tracker = TaxiGPSTracker()
  let initial = tracker.process(fix(0), now: 1000)
  expect(initial.accepted && initial.reason == .initial, "initial baseline")
  near(initial.elapsedSeconds, 0, "initial baseline does not bill")
  near(initial.displaySpeedKmh!, 36, "moving first fix uses native speed")
  let next = tracker.process(fix(2, meters: 20), now: 1002)
  near(next.distanceMeters, 20, "normal GPS distance")
  near(next.elapsedSeconds, 2, "actual fix duration")
  let duplicate = tracker.process(fix(2, meters: 90, accuracy: 100), now: 1002)
  expect(duplicate.reason == .outOfOrder, "duplicate inaccurate fix cannot poison state")
  near(tracker.lastFix!.timestamp, 1002, "trusted timestamp preserved")
}
do {
  var tracker = TaxiGPSTracker()
  _ = tracker.process(fix(0, speed: 0), now: 1000)
  let drift = tracker.process(fix(1, meters: 20, speed: 0), now: 1001)
  near(drift.distanceMeters, 0, "native zero suppresses coordinate drift")
  near(drift.displaySpeedKmh!, 0, "native zero never falls back")
  let moving = tracker.process(fix(2, meters: 40, speed: 10), now: 1002)
  near(moving.distanceMeters, 20, "stationary anchor discards prior drift")
}
do {
  var tracker = TaxiGPSTracker()
  _ = tracker.process(fix(0), now: 1000)
  let expired = tracker.process(fix(1, meters: 10), now: 1006)
  expect(expired.reason == .stale, "expired native speed cannot revive display")
  let gap = tracker.process(fix(6, meters: 200), now: 1006)
  expect(gap.reason == .gap, "gap rebaselines independently of timer callback")
  near(gap.distanceMeters, 0, "gap distance excluded")
  near(gap.elapsedSeconds, 0, "gap time excluded")
  near(gap.displaySpeedKmh!, 36, "fresh speed works after gap")
}
do {
  var tracker = TaxiGPSTracker()
  _ = tracker.process(fix(0, accuracy: 10), now: 1000)
  let burst = tracker.process(fix(0.1, meters: 6, accuracy: 10), now: 1000.1)
  expect(burst.accepted && burst.reason == .positionNoise, "short noisy segment retains native speed")
  near(burst.distanceMeters, 0, "noisy distance excluded")
  near(burst.displaySpeedKmh!, 36, "position noise does not clear speed")
  let teleport = tracker.process(fix(1, meters: 10_000), now: 1001)
  expect(teleport.reason == .unrealisticSpeed, "teleport rejected")
}
do {
  var tracker = TaxiGPSTracker()
  _ = tracker.process(fix(0), now: 1000)
  let spike = tracker.process(fix(1, meters: 10, speed: 40), now: 1001)
  near(spike.billingSpeedKmh!, 36, "isolated acceleration spike held")
  let recovered = tracker.process(fix(2, meters: 20), now: 1002)
  near(recovered.billingSpeedKmh!, 36, "median removes isolated spike")
  let stop = tracker.process(fix(3, meters: 20, speed: 0), now: 1003)
  near(stop.displaySpeedKmh!, 0, "stop bypasses display smoothing")
}
do {
  var tracker = TaxiGPSTracker()
  let first = tracker.process(fix(0, speed: -1), now: 1000)
  expect(first.billingSpeedKmh == nil, "negative speed is unavailable")
  let early = tracker.process(fix(1, meters: 10, speed: nil), now: 1001)
  expect(early.billingSpeedKmh == nil, "fallback waits for time window")
  let fallback = tracker.process(fix(3, meters: 30, speed: nil), now: 1003)
  near(fallback.billingSpeedKmh!, 36, "coordinate fallback uses recent window")
  var uncertain = TaxiGPSTracker()
  _ = uncertain.process(fix(0, speed: nil), now: 1000)
  let drift = uncertain.process(fix(3, meters: 4, speed: nil), now: 1003)
  expect(drift.billingSpeedKmh == nil, "ambiguous drift is unknown, not zero")
  var poorSpeed = TaxiGPSTracker()
  let invalidAccuracy = poorSpeed.process(fix(0, speedAccuracy: -1), now: 1000)
  expect(invalidAccuracy.billingSpeedKmh == nil, "invalid native speed accuracy uses fallback")
  var noisySpeed = TaxiGPSTracker()
  let noisy = noisySpeed.process(fix(0, speedAccuracy: 10), now: 1000)
  expect(noisy.billingSpeedKmh == nil, "unreliable native speed accuracy is excluded")
}

do {
  var log = TaxiMeterEngine()
  expect(log.mode == .log, "new native meters default to trip log")
  log.begin()
  tick(&log, 2000, 5000, 9)
  expect(log.fare == 0, "log mode never charges a fare")
  near(log.totalDistanceMeters, 5000, "log mode still records distance")
  near(log.chargeableDistanceMeters, 0, "log mode has no billable distance")
  near(log.lowSpeedSeconds, 0, "log mode has no low-speed billing time")
  log.pause()
  log.begin(mode: .taxi)
  expect(log.mode == .log, "resume cannot change an existing trip mode")
  log.finish()
  log.reset()
  expect(log.mode == .log, "reset prepares a log trip")
  log.begin(mode: .taxi)
  expect(log.mode == .taxi && log.fare == 4800, "phone can explicitly start taxi mode")
  log.pause()
  log.begin(mode: .log)
  expect(log.mode == .taxi && log.fare == 4800, "resuming a taxi trip keeps its original mode")
  let legacy = Data("{\"status\":\"running\",\"totalDistanceMeters\":1731,\"chargeableDistanceMeters\":131,\"lowSpeedSeconds\":30}".utf8)
  var restored = try JSONDecoder().decode(TaxiMeterEngine.self, from: legacy)
  expect(restored.mode == .taxi && restored.fare == 5000, "legacy checkpoints stay taxi")
  restored.pause()
  restored.begin()
  expect(restored.mode == .taxi && restored.fare == 5000, "legacy resumed trips keep fare")
  let encoded = try JSONEncoder().encode(log)
  let roundTrip = try JSONDecoder().decode(TaxiMeterEngine.self, from: encoded)
  expect(roundTrip.mode == .taxi, "new checkpoints persist mode")
}

print("Native meter regression checks passed: \(checks)")
