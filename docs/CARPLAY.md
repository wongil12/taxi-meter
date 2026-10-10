# CarPlay 연동

확인일: 2026-10-09. 사용자 제공 이메일로 계정의 Driving Task 권한 할당을 확인했다. 앱 ID 활성화·새 프로파일·실차 검증은 아직 확인하지 않았다. 아래 10월 7일 상태 기록은 당시 기준이다. 독립 CarPlay 화면과 네이티브 미터 코드는 구현했지만 Driving Task entitlement 승인과 실제 차량 검증은 완료되지 않았다. 현재 배포된 Live Activity 방식과 독립 CarPlay 앱 빌드를 구분한다.

## 두 가지 표시 경로

| 경로 | 표시 위치 | 현재 상태 |
| --- | --- | --- |
| Live Activity | iOS 26 이상 CarPlay Dashboard의 요금 카드 | 구현됨. 기존 시뮬레이터 잠금 화면 표시 확인. 독립 앱 아이콘은 생성하지 않음 |
| 독립 CarPlay 앱 | CarPlay 앱 목록에서 열리는 미터 화면 | 네이티브 코드 구현. entitlement 승인·적합한 서명·재배포 필요. 기본 빌드에서 비활성 |

Apple은 별도 CarPlay 앱 없이 Live Activity를 Dashboard에 표시할 수 있으며, 차량의 해당 표시 영역은 비대화형이라고 설명한다. 앱 아이콘 목록에서 찾는 기능과 다르다. [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/216/)

## Live Activity 확인 방법

1. iPhone이 iOS 26 이상인지 확인한다.
2. iPhone 설정 → 앱 → 택시 미터 → 실시간 현황을 허용한다.
3. 휴대폰 앱에서 주행을 시작하고 잠금 화면 또는 Dynamic Island에 요금 카드가 생성되는지 확인한다.
4. 차량의 앱 목록이 아닌 CarPlay Dashboard를 확인한다.

설정 경로는 [Apple 지원 문서](https://support.apple.com/en-gb/guide/iphone/iph3d92302ee/26/ios/26)를 따른다. 현재 차량에서의 표시를 검증했다고 주장하지 않는다.

`expo-widgets`의 `bannerSmall`은 차량용 요금·상태, `banner`는 잠금 화면, compact/expanded 영역은 Dynamic Island용이다. 기능은 Expo Go에서 실행되지 않는다. 정적 요금·거리·분 단위 시간을 전달하며 초 단위 애니메이션 타이머를 사용하지 않는다. 종료·초기화 시 제거하고 재실행 시 이전 활동을 정리한다. 시스템 설정과 표시 정책이 적용된다.

## 독립 CarPlay 화면

`modules/taxi-carplay/ios/TaxiCarPlaySceneDelegate.swift`가 `CPInformationTemplate` 단일 화면에 요금, 거리·시간, GPS 안내를 표시한다. 시작·일시정지·재개·종료 중 현재 상태에 필요한 최대 두 동작을 제공하며, 종료는 `CPAlertTemplate`으로 확인한다. 완료 후 새 주행을 준비할 수 있다. 설정·기록·영수증 공유는 휴대폰에서 처리한다.

화면은 Apple 템플릿을 사용한다. Driving Task에서 CPInformationTemplate을 사용하는 예시는 [Apple WWDC22](https://developer.apple.com/videos/play/wwdc2022/10016/)에 설명되어 있다. 템플릿을 사용했다는 사실만으로 앱의 카테고리 적합성이나 승인이 보장되지는 않는다.

## 네이티브 미터와 수명 주기

- `TaxiMeterRuntime.shared`가 iPhone과 CarPlay의 공통 상태를 관리한다. CarPlay scene은 JavaScript가 실행되지 않아도 런타임을 생성하고 제어한다.
- GPS 계산과 경과 시간 측정은 네이티브에서 수행한다. CarPlay 연결 중 실행 상태이고 빌드에 background location 설정이 있을 때만 백그라운드 위치 수집을 켠다.
- CarPlay 연결 없이 앱이 백그라운드로 가거나, 백그라운드에서 CarPlay 연결이 해제되면 일시정지한다.
- 위치 권한이 아직 없으면 차량에서 권한 창을 대신 처리하지 않고 휴대폰에서 앱을 열어 허용하도록 안내한다. 거부·정확한 위치 미허용·신호 유실 상태를 표시한다.
- 프로세스 재시작 시 진행 중이던 주행은 일시정지 상태로 복원한다. 측정하지 않은 시간과 거리를 추측해 부과하지 않는다.
- 완료한 주행은 네이티브 대기열에 먼저 저장한다. 휴대폰 기록 저장 성공 후에만 네이티브 대기열에서 제거한다.

이는 구현된 정책이며, 잠금·cold launch·CarPlay 연결 해제와 재연결·실제 GPS 수집의 차량 검증 결과를 의미하지 않는다.

## 빌드와 승인

기본 `./plugins/withTaxiCarPlay` 설정은 독립 CarPlay scene, background location, 보호된 Driving Task entitlement를 추가하지 않는다. 기본 배포본이 CarPlay 앱 목록에 나타나지 않는 것은 예상 동작이다.

Apple 승인과 적합한 provisioning을 준비한 뒤 `TAXI_METER_CARPLAY_ENTITLEMENT=1`로 네이티브 설정을 생성한다. 이 환경 변수는 승인 증명이 아니라 코드 설정이다. 승인되지 않은 권한을 배포용 프로파일에 임의로 삽입하지 않는다. [Apple entitlement 신청 절차](https://developer.apple.com/documentation/carplay/requesting-carplay-entitlements)

현재 수동 서명이 구성된 `ios/`를 무작정 clean prebuild하지 않는다. 기존 팀·프로파일·앱 확장 설정을 보존하면서 변경 사항을 확인한다.

- 앱: `com.wongil.taximeter`
- Live Activity 확장: `com.wongil.taximeter.widgets`
- App Group: `group.com.wongil.taximeter`
- 검토 대상 entitlement: `com.apple.developer.carplay-driving-task`
- 신청 초안: [CARPLAY_ENTITLEMENT_REQUEST.md](CARPLAY_ENTITLEMENT_REQUEST.md)

## 검증 범위와 남은 작업

기존 Live Activity는 iPhone 17 Pro / iOS 26.5 시뮬레이터에서 잠금 화면 표시를 확인했다. 독립 CarPlay scene은 설치된 SDK에 대한 타입 검사를 통과했으며, 전체 앱의 검증 결과는 해당 변경의 빌드·테스트 기록을 따른다.

아직 완료하지 않은 항목은 Apple 카테고리 적합성·entitlement 승인, 승인된 권한으로 서명한 배포본, 차량 앱 목록 표시, 차량 단독 cold launch, 잠금 중 연속 GPS, 연결 해제·재연결, 권한 변경, 휴대폰과 차량 동시 조작 검증이다. 이러한 항목이 확인되기 전에는 독립 CarPlay 지원을 배포 완료 또는 차량 검증 완료로 안내하지 않는다.

시뮬레이터 Live Activity도 App Group을 읽으려면 임시 서명이 필요하다. `CODE_SIGNING_ALLOWED=NO` 빌드는 공유 그룹 등록이 빠져 빈 레이아웃 평가 오류가 날 수 있다. 이는 Apple 계정의 배포용 서명과 별개다.

## 2026-10-09 제품 방향 변경

차량 운행 기록 관리가 주기능이다. 독립 CarPlay 화면은 거리·측정 시간과 기록 시작·일시정지·종료를 제공하고 요금을 표시하지 않는다. CarPlay에서 새로 시작하면 log 모드이며 휴대폰에서 시작한 주행을 연결해도 기존 mode를 바꾸지 않는다. 택시 기능은 휴대폰의 부가 기능으로 선택한다. 기존 신청서 초안은 제품 개편 이전의 역사적 기록이며, 추가 설명 요청 시 최신 기능으로 갱신해 답해야 한다.
