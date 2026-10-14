# iOS 배포 전 실행 검증

Archive 성공은 실행 성공을 의미하지 않는다. TestFlight 업로드 전에 배포와 같은 Release 설정에서 아래를 확인한다.

1. `TAXI_METER_CARPLAY_ENTITLEMENT=1`로 prebuild한다. 수동 서명 보존을 위해 `--no-clean`을 사용한다.
2. Podfile.properties.json의 `EXPO_USE_PRECOMPILED_MODULES=false`, `ios.buildReactNativeFromSource=true`를 확인하고 Pods를 설치한다. 이 설정은 config plugin에서 유지한다.
3. 새로운 DerivedData 경로에서 Release 시뮬레이터 앱을 빌드한다. Metro 연결 없이 실행해야 한다.
4. 기존 앱 위에 설치하고 홈 화면이 유지되는지, 기록·미터기·설정 이동이 되는지 확인한다. 강제 종료 후 재실행도 확인한다. `simctl launch`의 성공 응답만으로 합격 처리하지 않는다.
5. 충돌 보고서가 생성되거나 앱이 홈 화면으로 돌아가면 업로드하지 않는다. 변경 전후 동일 조건으로 비교한다.
6. 배포 Archive의 앱·위젯 빌드 번호, 표시 이름, 암호화 설정 및 실제 서명의 CarPlay entitlement를 확인한다.
7. 업로드 후 Apple 처리 완료와 내부 테스트 그룹 연결까지 확인한다. 실제 차량의 CarPlay 동작은 시뮬레이터 검증과 별도로 기록한다.

## 빌드 5 시작 충돌

- TestFlight iPhone 17 Pro / iOS 27.0.1에서 시작 직후 EXC_BAD_ACCESS 보고.
- iOS 26.5 Release 시뮬레이터에서도 `Props::Props → ExpoViewProps → registerNativeViews` 경로의 동일 충돌 재현.
- Expo만 소스 빌드해도 동일 충돌이 남아 React Native까지 소스 빌드하도록 범위를 확대.
- 두 모듈을 모두 소스 빌드한 Release 앱에서 정상 시작, 기존 4건 기록 유지, 기록·미터기·설정 이동, 강제 종료 후 재실행을 확인했다(iPhone 17 Pro / iOS 26.5 simulator).
- 최종 수정 검증 및 배포 결과는 RELEASE_STATUS.md에 기록한다.
