# Driving Task entitlement 신청 초안

확인일: 2026-10-07. Apple 포털 제출 전 검토용이다. entitlement 승인, App Store 승인 또는 차량 검증 완료를 뜻하지 않는다. 제품의 최초 목적은 오락용 택시 미터였으며, 신청에서 이 사실을 숨기거나 실제 영업용 인증 미터라고 표현하지 않는다.

## 신청 내용 초안

앱 이름: 택시 미터
Bundle ID: `com.wongil.taximeter`
검토 요청 카테고리: Driving Task (`com.apple.developer.carplay-driving-task`)

택시 미터는 iPhone GPS로 이동 거리와 주행 시간을 측정하고, 앱의 요금 규칙에 따라 금액을 표시하는 개인용 앱입니다. 처음에는 오락용 앱으로 기획했으며, 공인·검정된 택시 요금계나 결제 수단으로 제공하지 않습니다. 이 사용 목적이 Driving Task 카테고리에 적합한지 확인을 요청합니다.

CarPlay에서는 주행 시작과 종료 시 필요한 간단한 조작, 현재 요금·거리·경과 시간 확인만 제공하려 합니다. 차량 화면은 Apple의 CPInformationTemplate 단일 화면으로 구현하며 시작, 일시정지, 재개, 종료 중 현재 상태에 필요한 최대 두 동작만 표시합니다. 종료는 CPAlertTemplate으로 확인합니다. 요금 설정, 과거 기록 탐색, 영수증 공유는 iPhone에서 처리하며 CarPlay에 입력 폼·광고·게임 화면·임의 렌더링 화면을 제공하지 않습니다.

현재 독립 CarPlay scene과 iPhone/CarPlay가 공유하는 네이티브 측정 런타임을 코드로 구현했습니다. CarPlay 연결 중 실행 상태에서만 백그라운드 위치 수집을 허용하도록 구성했으며, 실제 차량의 cold launch·연결 해제·잠금 중 GPS 동작은 아직 검증하지 않았습니다. 기존 배포본의 CarPlay 관련 기능은 Dashboard Live Activity이며 독립 CarPlay 앱 승인을 받은 상태가 아닙니다. 독립 CarPlay 앱을 배포하려면 귀사의 카테고리 적합성 검토와 entitlement 승인이 필요함을 이해합니다.

## 제출 전에 실제 결과로 보완할 항목

- 앱의 최신 실제 기능과 위 설명이 일치하는지 확인한다. 오락용에서 제품 목적이 변경되었다면 변경된 사실과 근거를 설명한다.
- CarPlay 화면 캡처와 시작→일시정지→재개→종료 시연을 첨부한다. 시뮬레이터와 실차 결과를 구분한다.
- iPhone 화면을 닫은 상태, 연결 해제, GPS 권한 거부·신호 유실, 종료 후 기록 동기화 동작을 검증하고 실제 결과를 기록한다.
- 개인정보처리방침, 앱 설명, 지원 연락처와 필요하면 App Store/TestFlight 검토 경로를 준비한다. 확인되지 않은 연락처·URL은 넣지 않는다.
- 승인 후 App ID의 Additional Capabilities에 해당 권한을 켜고 프로비저닝 프로파일과 앱 entitlement를 일치시킨 뒤 재빌드한다.

## 적합성 판단의 한계

Apple은 Driving Task의 주목적이 실제 운전에 도움이 되는 작업이어야 한다고 설명한다. 단지 운전 중 사용할 수 있다는 이유만으로 해당 카테고리에 적합해지는 것은 아니다. 최초 오락 목적의 미터가 기준을 충족하는지는 Apple의 판단이 필요하며, 승인을 보장할 수 없다. 다른 카테고리로 위장하지 않는다.

공식 자료:

- [Get more mileage out of your app with CarPlay, WWDC22](https://developer.apple.com/videos/play/wwdc2022/10016/) — Driving Task 목적과 CPInformationTemplate 사용 예시.
- [CarPlay Driving Task App](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.carplay-driving-task) — 신청 대상 entitlement.
- [Requesting CarPlay Entitlements](https://developer.apple.com/documentation/carplay/requesting-carplay-entitlements) — 승인·App ID·프로비저닝 절차.
- [CarPlay 개발자 안내 및 신청 링크](https://developer.apple.com/carplay/) — 최신 카테고리와 entitlement 요청 경로.
