# 배포 기록

## 0.1.0 (1) — 2026-10-07

- App Store Connect 앱 ID: `6820007121`
- 앱 식별자: `com.wongil.taximeter`
- 위젯 식별자: `com.wongil.taximeter.widgets`
- 배포용 Archive 및 IPA 생성 성공. 20:21 KST App Store Connect 업로드 성공.
- Apple Distribution 정식 서명 사용. 앱과 위젯 모두 `group.com.wongil.taximeter` 포함 확인.
- 서명 자료: `/Users/kim-wongil/Documents/iOS/taxi-meter`
- 배포 IPA와 로그: 위 폴더의 `releases/0.1.0-1/`
- 개인 키는 macOS 키체인에 보관하며 저장소에 포함하지 않는다.
- 업로드 경고: React, ReactNativeDependencies, hermesvm 사전 빌드 프레임워크의 dSYM이 없어 해당 프레임워크 충돌 심볼 분석에 제한이 있다. 앱 업로드는 성공했다.
- 다음 빌드부터 암호화 질문 반복을 줄이도록 `app.json`에 `ITSAppUsesNonExemptEncryption: false`를 추가했다. 이미 업로드한 빌드 1에는 포함되지 않는다.

## 스토어 준비

- 한국어 이름, 부제, 설명, 키워드, 심사 메모 등록.
- 유틸리티 카테고리, 4+ 연령 등급, 로그인 불필요, 수동 출시 설정.
- 개인정보 처리방침: https://wongil12.github.io/app-policy/taxi-meter/privacy.html
- 지원: https://wongil12.github.io/app-policy/taxi-meter/support.html
- 정책 사이트는 `wongil12/app-policy`의 `680b1d2` 커밋으로 게시됨.
- 1320×2868 실제 앱 스크린샷 4장 업로드. 중형 iPhone에는 기존 자산이 자동 적용됨.
- 내부 테스트 그룹 생성 및 계정 소유자 등록. 빌드 1 연결 및 초대 1건 표시 확인.
- 수출 규정 문서 누락 해소, 빌드 상태 ‘제출 준비 완료’ 확인.
- TestFlight 테스트 안내 저장.
- 무료 가격, 대한민국 출시 지역 설정.
- App Store 버전에 빌드 1 연결 후 저장 요청. 마지막 페이지가 응답하지 않아 재확인이 필요하다.
- App Review 제출은 하지 않았다. 개인정보 공개 최종 게시 동의는 아직 남아 있다.

## 0.1.0 (2) — 속도 측정 수정

- 걷기 중 40→10km/h로 튀는 실기기 제보에 따라 네이티브 속도 우선/위치 보조 계산/불확실 속도 표시를 개선했다. `GPS_MEASUREMENT.md` 참고.
- 타입 검사 및 테스트 56개 통과.
- 정식 서명 Archive 생성 성공: `/private/tmp/taxi-meter-build2.xcarchive`.
- 앱·위젯 빌드 번호 2, 앱의 `ITSAppUsesNonExemptEncryption=false` 확인.
- 20:44 KST 업로드 시 Xcode 계정 키체인 접근 오류(`Failed to Use Accounts`). UI 도구에서 Mac 잠금 상태를 확인했다. 사용자의 잠금 해제 후 다시 업로드해야 한다.
- 빌드 2는 아직 TestFlight에 업로드되지 않았다. 빌드 1은 기존 테스트용으로 유지된다.
- 스토어 버전에 빌드 1을 연결하려던 저장은 재조회 시 반영되지 않았다. 수정본 빌드 2 처리 완료 후 연결해야 한다.

## 독립 CarPlay 개발 — 아직 미배포

- Apple 템플릿 기반 시작·일시정지·재개·종료 화면과 iPhone 공통 네이티브 미터를 구현했다.
- iOS simulator 전체 빌드 성공. TypeScript 테스트 61개, 설정 plugin 테스트 4개, Swift 계산 검사 55개 통과.
- Apple Driving Task 권한 신청 페이지에서 법적 CarPlay Entitlement Addendum 동의가 요구된다. 사용자에게 이번 약관 동의와 신청 제출 승인을 요청한 상태이며 아직 동의·제출하지 않았다.
- 승인된 배포 프로파일과 차량 검증은 없다. 보호된 entitlement는 기본 설정에서 제외한다.
- 공개 정책·지원 페이지와 App Store 설명은 현재 배포본 기준을 유지한다. 독립 CarPlay 배포 전 연결 중 백그라운드 위치 수집·네이티브 중단 복원 설명으로 갱신해야 한다.
- 이 변경은 이미 생성된 build 2 Archive에 포함되지 않는다.
- 시뮬레이터 화면 제어가 응답하지 않아 이번 독립 CarPlay UI 조작 검증은 완료하지 못했다. 최종 scene 동시 조작 보호와 런타임 scene 판별 수정은 Swift 6 iOS SDK 타입 검사를 통과했다.

## 2026-10-09 운행 기록 중심 개편 — 코드/시뮬레이터 완료

- 사용자 제공 Apple 이메일에 계정 CarPlay Driving Task 권한 할당이 명시됨. 앱 ID 권한 활성화 및 새 프로파일 배포 확인과는 별개.
- 일반 운행 무과금/택시 부가 기능 분리, 홈 월 요약·최근 기록, 종류별 필터, 요금 없는 일반 운행 공유 구현.
- 기존 기록·체크포인트 missing mode는 택시로 복원하며 신규 주행 기본은 일반 운행.
- TypeScript 67개, native 67개 검사 통과. iOS simulator 전체 빌드와 주요 두 모드 UI 흐름 확인.
- 개편본은 TestFlight에 업로드하지 않았다. 기존 앱 ID·설치 이름·아이콘·공개 스토어 자료는 유지.

## 2026-10-10 화면 이동·기록 검수 — 미배포

- 완료된 일반 운행에서 미터기 진입 시 이전 모드가 탭 선택을 가로채는 문제 수정. 저장 확인 후 이전 세션을 정리하며, 진행 중 다른 모드 진입은 현재 화면을 유지하고 안내한다.
- 선택 탭에 강조 배경과 대비 글자색 적용. 상세에서는 진입 탭 유지.
- 기록 종류 필터를 상위 화면 상태로 옮겨 상세 왕복 후 보존, 필터 변경 시 목록 위치 초기화.
- iOS 완료 기록은 native pending outbox만 자동 저장. 이미 확인된 completedTrip을 재시작 때 중복 저장하지 않는다. 삭제 전 native retry copy도 확인 처리하여 재수입 방지.
- TypeScript 검사와 테스트 69개 통과. iPhone 17 Pro 시뮬레이터에서 완료 상태→미터기, 홈/기록/설정 선택 표시, 기록 필터→상세→뒤로가기 확인.
- 이 회차의 실제 차량·Android UI·큰 글자/가로 화면 검증은 수행하지 않았다. TestFlight 미배포.

## 2026-10-14 TestFlight 빌드 4 준비 — 로그인 대기

- 누적 변경을 기능별 4개 커밋으로 분리하고 `origin/master`에 푸시 완료.
- `app.json`과 생성된 앱·위젯의 빌드 번호를 4로 일치시킴.
- CarPlay 설정을 활성화한 Release 무서명 아카이브 생성 성공: `/private/tmp/taxi-meter-build4-unsigned.xcarchive`.
- TypeScript 검사, JS 테스트 69개, 설정 테스트 4개, Swift 회귀 검사 67개 통과.
- 기존 `Taxi Meter App Store` 프로파일에 Driving Task entitlement가 없는 것을 확인. Apple Developer 웹 로그인 세션 만료로 앱 ID 권한 활성화 및 프로파일 재발급 대기 중.
- 새 빌드는 아직 서명·업로드하지 않았다. App Store Connect에서 확인된 기존 빌드는 1뿐이다.
- 지원·개인정보 HTML은 신규 동작에 맞춰 로컬 문서를 갱신했다. 공개 정책 사이트에는 아직 반영하지 않았다.

## 2026-10-14 운행노트 0.1.0 (5) — 업로드 완료, 처리 중

- 앱 이름을 운행노트로 변경하고 초록색 차량·주행 경로 아이콘 적용. 앱 ID와 기존 설치 데이터 식별자는 유지.
- Apple Developer에서 기존 App ID의 CarPlay Driving Task App capability 활성화 후 배포 프로파일 재발급 완료.
- 새 프로파일 UUID `010b31f5-9130-4ee8-bae9-e4208cc3c7af`. 실제 코드 서명에 `com.apple.developer.carplay-driving-task=true` 확인.
- 앱과 위젯 최종 빌드 번호 5 확인. 정식 서명 Archive: `/private/tmp/drive-log-build5.xcarchive`.
- Xcode 명령줄 업로드는 `Failed to Use Accounts`로 실패했으나, Xcode Organizer 업로드는 16:52 KST 성공. App Store Connect에서 빌드 5 ‘처리 중’ 확인.
- 배포 IPA·로그는 `/Users/kim-wongil/Documents/iOS/taxi-meter/releases/0.1.0-5/`에 보관.
- React, ReactNativeDependencies, hermesvm의 사전 빌드 dSYM 누락 경고가 있으나 앱 업로드 자체는 성공.
- App Store Connect 이름·부제 및 운행 기록 중심 설명·심사 메모 저장. App Review 제출은 하지 않음.
- 공개 정책 사이트 원본 폴더 `/Users/kim-wongil/Documents/wongil/app-policy`에 운행노트 목록/안내/개인정보/지원 페이지 추가. 공개 push는 별도 승인 대기.

### 빌드 5 처리 완료

- Apple 처리 완료 후 빌드 5 ‘제출 준비 완료’ 확인. 암호화 문서 누락 없음.
- 기존 내부 테스트 그룹(테스터 1명)에 빌드 5 연결 완료.
- 새 이름·아이콘, 운행 기록, CarPlay 실차 확인 항목을 TestFlight 테스트 안내에 저장.
- 앱 저장소 변경 커밋: `0b8ad30` (이름·아이콘·설명).
- 사용자 지정 `app-policy` 폴더에 정책/지원/앱 안내와 목록 링크를 커밋(`36457e1`)했으며 공개 게시 승인은 대기 중. 기존 사용자 `.DS_Store` 변경은 보존하고 커밋에서 제외.

## 2026-10-14 빌드 6 — 시작 충돌 수정, 업로드 대기

- 빌드 5의 시작 직후 EXC_BAD_ACCESS를 실제 TestFlight 충돌 보고서에서 확인하고 Release 시뮬레이터에서 동일하게 재현했다.
- 충돌 경로는 React Props → ExpoViewProps → native view 등록. Expo만 소스 빌드해도 실패했고 React Native까지 함께 소스 빌드하면 정상 실행됐다. 정확한 사전 빌드 바이너리 불일치 원인은 확정하지 않았다.
- iPhone 17 Pro / iOS 26.5 Release에서 홈 유지, 기록·미터기·설정 이동, 기존 기록 4건 유지, 강제 종료 후 재실행 확인. 설정 플러그인 테스트 4개 통과.
- 수정 커밋: `011b287`. 이후 생성에도 두 소스 빌드 설정을 유지한다.
- 서명된 Archive `/private/tmp/drive-log-build6.xcarchive` 생성 성공. 앱/위젯 0.1.0 (6), 운행노트 표시 이름, 암호화 면제 설정 및 실제 CarPlay entitlement=true 확인.
- Mac 잠금으로 Xcode Organizer 최종 업로드를 진행하지 못했다. 빌드 6은 아직 TestFlight에 올라가지 않았다. 잠금 해제 후 업로드 및 내부 테스트 그룹 연결 필요.
- 실제 iPhone / iOS 27 및 차량 CarPlay 실행은 새 빌드 설치 후 확인해야 한다.
