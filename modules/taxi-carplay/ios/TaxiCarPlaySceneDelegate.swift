import CarPlay
import Foundation

/// A single, system-rendered driving-task screen. It has no React Native dependency.
@objc(TaxiCarPlaySceneDelegate)
@MainActor
public final class TaxiCarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var meterTemplate: CPInformationTemplate?
  private var lastContent = ""
  private var lastActions = ""
  private var showingFinishConfirmation = false

  public func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                       didConnect interfaceController: CPInterfaceController) {
    self.interfaceController = interfaceController
    let runtime = TaxiMeterRuntime.shared
    runtime.setCarPlayConnected(true)
    let template = CPInformationTemplate(title: "주행 기록", layout: .twoColumn, items: [], actions: [])
    meterTemplate = template
    lastContent = ""
    lastActions = ""
    NotificationCenter.default.removeObserver(self, name: .taxiMeterDidChange, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(meterDidChange), name: .taxiMeterDidChange, object: nil)
    render()
    interfaceController.setRootTemplate(template, animated: false, completion: nil)
  }

  public func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                       didDisconnectInterfaceController interfaceController: CPInterfaceController) {
    NotificationCenter.default.removeObserver(self, name: .taxiMeterDidChange, object: nil)
    self.interfaceController = nil
    meterTemplate = nil
    showingFinishConfirmation = false
    TaxiMeterRuntime.shared.setCarPlayConnected(false)
  }

  @objc private func meterDidChange(_ notification: Notification) {
    render()
  }

  private func render() {
    guard let template = meterTemplate else { return }
    let state = TaxiMeterRuntime.shared.snapshot()
    let status = state["status"] as? String ?? "idle"
    let busy = state["busy"] as? Bool ?? false
    let distance = (state["totalDistanceMeters"] as? NSNumber)?.doubleValue ?? 0
    let seconds = (state["elapsedSeconds"] as? NSNumber)?.doubleValue ?? 0
    let rawGPS = state["gpsMessage"] as? String ?? ""
    let gps = rawGPS.contains("요금") ? "속도 확인 중 · 이동 거리와 시간을 측정합니다." : rawGPS
    let statusTitle: String
    switch status {
    case "running": statusTitle = "주행 중"
    case "paused": statusTitle = "일시정지"
    case "finished": statusTitle = "주행 완료"
    default: statusTitle = "출발 준비"
    }
    let distanceText = String(format: "%.1f km", distance / 1000)
    let minutes = Int(max(0, seconds) / 60)
    let duration = minutes >= 60 ? "\(minutes / 60)시간 \(minutes % 60)분" : "\(minutes)분"
    let detail = status == "finished" || gps.isEmpty
      ? "자세한 주행 기록은 iPhone에서 확인하세요"
      : gps
    let content = "\(statusTitle)|\(distanceText)|\(duration)|\(detail)|\(busy)"
    if content != lastContent {
      template.title = "주행 기록 · \(statusTitle)"
      template.items = [
        CPInformationItem(title: "이동 거리", detail: distanceText),
        CPInformationItem(title: "주행 시간", detail: duration),
        CPInformationItem(title: busy ? "준비 중" : "안내", detail: detail)
      ]
      lastContent = content
    }
    // Do not rebuild controls for each GPS sample; retain rotary/touch focus.
    let actionKey = "\(status)|\(busy)|\(state["tripID"] as? String ?? "")"
    if actionKey != lastActions {
      template.actions = busy ? [] : actions(for: status)
      lastActions = actionKey
    }
  }

  private func actions(for status: String) -> [CPTextButton] {
    switch status {
    case "running":
      return [button("일시정지") { TaxiMeterRuntime.shared.pause() }, finishButton()]
    case "paused":
      return [button("다시 시작", style: .confirm) { TaxiMeterRuntime.shared.begin(mode: .log) }, finishButton()]
    case "finished":
      return [button("새 주행 준비", style: .confirm) { TaxiMeterRuntime.shared.reset() }]
    default:
      return [button("주행 기록 시작", style: .confirm) { TaxiMeterRuntime.shared.begin(mode: .log) }]
    }
  }

  private func button(_ title: String, style: CPTextButtonStyle = .normal,
                      action: @escaping @MainActor () -> Void) -> CPTextButton {
    let expected = TaxiMeterRuntime.shared.snapshot()
    let expectedStatus = expected["status"] as? String
    let expectedTripID = expected["tripID"] as? String
    return CPTextButton(title: title, textStyle: style) { [weak self] _ in
      Task { @MainActor in
        guard let self, self.interfaceController != nil,
              !(TaxiMeterRuntime.shared.snapshot()["busy"] as? Bool ?? false) else { return }
        let current = TaxiMeterRuntime.shared.snapshot()
        guard current["status"] as? String == expectedStatus,
              current["tripID"] as? String == expectedTripID else { self.render(); return }
        action()
        self.render()
      }
    }
  }

  private func finishButton() -> CPTextButton {
    button("주행 종료") { [weak self] in self?.confirmFinish() }
  }

  private func confirmFinish() {
    guard let controller = interfaceController, !showingFinishConfirmation,
          let tripID = TaxiMeterRuntime.shared.snapshot()["tripID"] as? String else { return }
    showingFinishConfirmation = true
    let cancel = CPAlertAction(title: "돌아가기", style: .cancel) { [weak self] _ in
      Task { @MainActor in self?.dismissConfirmation(finish: false, tripID: tripID) }
    }
    let finish = CPAlertAction(title: "종료", style: .destructive) { [weak self] _ in
      Task { @MainActor in self?.dismissConfirmation(finish: true, tripID: tripID) }
    }
    controller.presentTemplate(CPAlertTemplate(titleVariants: ["이번 주행을 종료할까요?"], actions: [cancel, finish]), animated: true) { [weak self] success, _ in
      Task { @MainActor in
        if !success { self?.showingFinishConfirmation = false }
      }
    }
  }

  private func dismissConfirmation(finish: Bool, tripID: String) {
    guard let controller = interfaceController else { return }
    controller.dismissTemplate(animated: true) { [weak self] _, _ in
      Task { @MainActor in
        guard let self, self.interfaceController != nil else { return }
        self.showingFinishConfirmation = false
        let current = TaxiMeterRuntime.shared.snapshot()
        let currentStatus = current["status"] as? String
        // The phone may finish/reset/start a different trip while this alert is open.
        if finish, current["tripID"] as? String == tripID,
           currentStatus == "running" || currentStatus == "paused" {
          TaxiMeterRuntime.shared.finish()
        }
        self.render()
      }
    }
  }
}
