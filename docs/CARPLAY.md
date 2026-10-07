# CarPlay 지원 검토

확인일: 2026-10-07. 아래 내용은 Apple 공식 문서를 확인한 개발 계획이며, CarPlay 구현·승인·차량 검증이 완료되었다는 의미가 아니다.

## 현재 결론

React Native + TypeScript로 휴대폰용 오락 미터를 구현하고, CarPlay는 별도 iOS 네이티브 기능으로 확장한다. React Native 화면을 그대로 자동차 디스플레이에 복제하는 방식이 아니다. CarPlay 프레임워크는 카테고리별 템플릿을 제공하며 글자·터치 영역 등의 표현을 시스템이 관리한다. [CarPlay framework](https://developer.apple.com/documentation/CarPlay)

독립 CarPlay 앱은 적합한 카테고리의 entitlement 신청과 Apple 승인이 필요하다. 승인 후 App ID, 프로비저닝 프로파일, entitlement, 코드 서명을 설정하며 추가 CarPlay 심사 기준도 적용된다. 단순 오락용 택시미터의 승인 가능성은 공개 문서만으로 확정할 수 없다. [Requesting CarPlay Entitlements](https://developer.apple.com/documentation/carplay/requesting-carplay-entitlements)

## 가능한 경로

| 경로 | 적합성 및 제약 | 계획 |
| --- | --- | --- |
| iPhone 앱 | 실제 GPS 이동 거리 기반 오락용 가상 요금과 미터 조작 제공 | 먼저 구현 |
| iOS 26 이상 Live Activity | 별도 CarPlay 앱이 없어도 CarPlay Dashboard에 표시 가능. 차량에서 비대화형이며 중요한 상태 위주로 표시 | 다음 단계 후보 |
| iOS 26 이상 작은 위젯 | `systemSmall` 위젯을 CarPlay에 표시 가능. 미터처럼 계속 바뀌는 수치의 초 단위 갱신을 보장하는 수단으로 사용하지 않음 | 보조 상태 표시 후보 |
| 독립 CarPlay 앱 | Apple의 적합성 판단 및 entitlement 승인 필요 | 실제 사용 목적 검토 후 신청 여부 결정 |

Live Activity와 위젯 경로는 Apple이 공식적으로 지원한다. 다만 오락용 앱이 차량에서 보여줄 정보의 적합성은 별도로 설계해야 하며, 이 경로 자체가 심사 통과를 보장하지 않는다. Live Activity를 CarPlay에서 시작/일시정지/종료 버튼이 있는 미터로 취급하지 않는다. [Turbocharge your app for CarPlay, WWDC25](https://developer.apple.com/videos/play/wwdc2025/216/), [What’s new in widgets, WWDC25](https://developer.apple.com/videos/play/wwdc2025/278/)

## 카테고리 판단

Apple은 오디오, 통신, 내비게이션, 충전, 주유, 주차, 공공 안전, 음식 주문, 운전 관련 작업, 음성 대화, 지원 차량의 주차 중 비디오 등 구체적인 사용 목적을 제시한다. 범용 오락 미터에 대한 별도 카테고리는 확인되지 않았다. [CarPlay for developers](https://developer.apple.com/carplay/)

`com.apple.developer.carplay-driving-task`는 운전 관련 작업을 돕는 앱을 위한 entitlement다. 택시 모양 UI나 이동 거리 계산 기능이 있다는 사실만으로 해당 자격을 얻는다고 가정하지 않는다. 현재 기획의 오락 목적을 그대로 설명해 Apple에 적합성을 문의해야 한다. 오디오·내비게이션 앱으로 위장하거나 승인 전에 entitlement를 활성화하지 않는다. [CarPlay Driving Task App](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.carplay-driving-task)

## 통합 순서

1. 휴대폰에서 시작, 일시정지, 종료와 요금 계산을 검증한다. 화면에는 실제 결제용 요금이 아닌 오락용임을 표시한다.
2. TypeScript 미터 상태와 화면 표현을 분리한다. 차량 표시용 상태는 요금, 진행 상태, 기준 시각처럼 작게 유지한다.
3. Live Activity를 선택하면 iOS Widget Extension과 ActivityKit 연동을 추가한다. React Native 상태를 네이티브 모듈을 통해 전달하고 작은 표시 크기에 맞춘다. Expo Go나 웹 미리보기만으로 이 기능을 검증할 수 없다.
4. 앱이 백그라운드로 이동하거나 종료될 때의 정지·복구 정책을 구현한다. JavaScript 타이머가 계속 실행된다고 가정하지 않는다. 표시값의 신선도와 종료 처리를 명시한다.
5. CarPlay Simulator와 iPhone에서 연결·해제, 화면 잠금, 앱 백그라운드 전환, Live Activity 종료, 큰 글자, 좁은 화면을 검증한다. 이후 지원 차량에서 확인한다.
6. 독립 CarPlay 앱이 필요하면 실제 기능을 설명해 entitlement를 신청한다. 승인된 카테고리에 허용된 템플릿만 사용하고, CarPlay scene 및 네이티브 브리지를 구현한다. 승인 이후에도 App Store 심사와 차량 검증은 별도다.

CarPlay용 React Native 라이브러리는 현재 필수 의존성으로 추가하지 않는다. 먼저 Live Activity와 독립 CarPlay 앱 중 지원 경로를 결정한다. 라이브러리를 채택하더라도 Apple의 승인 및 네이티브 설정을 대신해주지 않는다.

## 완료 판정

- 현재: 정책·통합 계획 조사. 네이티브 CarPlay 지원 미구현.
- Live Activity 완료: iOS 네이티브 빌드, 시스템 표시, 상태 갱신·종료, CarPlay 환경 검증이 통과해야 한다.
- 독립 CarPlay 완료: entitlement 승인, 코드 서명, scene/템플릿 구현, 연결 수명 주기 및 차량 테스트가 추가로 필요하다.

시뮬레이션 데이터 또는 화면 모형만 있는 상태를 “CarPlay 지원 완료”로 안내하지 않는다.
