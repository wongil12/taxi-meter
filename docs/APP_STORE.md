# App Store 등록 초안 — 택시 미터

작성 기준: 2026-10-07, 앱 0.1.0 / 빌드 1의 소스 코드. 이 문서는 입력용 초안이며 실제 등록 완료 기록이 아니다.

## 기본 정보

- 이름: 택시 미터
- 부제: GPS 거리와 시간으로 계산하는 요금
- 기본 언어: 한국어
- 기본 카테고리 권장: 유틸리티
- 키워드: 택시,미터기,주행,거리,시간,GPS,요금,영수증,운수,기록
- 프로모션 문구: 이동 거리와 저속 주행 시간을 함께 계산하세요. 주행 기록을 확인하고, 나만의 운수 이름을 넣은 영수증을 공유할 수 있습니다.

## 설명

택시 미터는 GPS로 이동 거리와 주행 시간을 측정하고 요금을 계산하는 앱입니다. 주행을 마치면 기록을 저장하고 영수증을 공유할 수 있습니다.

주행 정보를 한눈에
• 요금, 이동 거리, 속도와 측정 시간을 확인하세요.
• 주행 시작, 일시정지, 재개와 종료를 간편하게 조작하세요.
• 주행 중 일시정지와 종료 버튼은 화면 하단에 표시됩니다.

거리와 저속 시간을 함께 계산
• 기본 요금은 1.6km까지 4,800원입니다.
• 기본 거리 이후에는 이동 거리 131m마다 100원이 추가됩니다.
• 기본 거리 이후 시속 15km 이하인 구간에서는 30초마다 100원이 함께 추가됩니다.
• 기본 거리 이내에서는 시간 요금이 추가되지 않습니다.

주행 기록과 영수증
• 최근 주행 100건을 기기에 저장합니다.
• 주행 일시, 거리, 시간과 요금을 다시 확인하세요.
• 영수증을 이미지 또는 텍스트로 공유하세요.
• 설정에서 운수 이름을 바꾸면 영수증 하단에 반영됩니다.

측정 및 이용 안내
GPS 환경에 따라 거리와 속도에 오차가 생길 수 있으며, GPS 신호가 없거나 정확도가 낮은 구간은 요금 계산에서 제외됩니다. 앱을 벗어나거나 화면을 잠그면 측정이 일시정지됩니다. 앱으로 돌아와 재개해 주세요. 진행 중인 주행은 앱을 종료하면 복구되지 않습니다.

표시 요금은 앱의 계산 기준을 따르며 지역별 공식 택시 요금표와 다를 수 있습니다. 위치 좌표는 기기에서 처리하며 주행 기록에 저장하지 않습니다. 완료한 주행 기록과 운수 이름은 기기에 저장됩니다.

## 이 버전의 새로운 기능

첫 출시입니다. GPS 거리·저속 시간 요금 계산, 주행 기록, 영수증 공유와 운수 이름 설정을 제공합니다.

## TestFlight 테스트 안내

GPS 위치 권한을 허용한 후 주행을 시작해 주세요. 거리·속도·시간 표시, 저속 구간의 추가 요금, 일시정지·재개·종료, 주행 기록 저장, 영수증 이미지·텍스트 공유, 운수 이름 설정을 확인해 주세요. 앱을 벗어나거나 화면을 잠그면 측정이 일시정지되며 앱에서 직접 재개해야 합니다. iOS 26 이상에서는 Live Activity의 요금·상태 표시도 확인할 수 있습니다.

## App Review 메모

This app is a GPS-based taxi meter with local trip history and receipt sharing. No account or login is required, and there are no purchases or advertisements.

To test: open the meter tab, tap the start button, and allow location access while using the app. The meter displays a base fare immediately; distance and speed require valid GPS movement. You can pause, resume, and finish the trip. The completed trip appears in the history tab. Open a receipt to share an image or text using the iOS share sheet. The settings tab changes the company keyword shown before “운수” on receipts.

Fare calculation uses the app's fixed configuration: KRW 4,800 for the first 1.6 km; after that, KRW 100 per completed 131 m plus KRW 100 per completed 30 seconds at speeds of 15 km/h or below. Both distance and low-speed time can accrue during the same interval. Time charges do not accrue within the initial 1.6 km. This is not a claim of an official regional taxi tariff or certified taximeter.

Location is accessed only while the app is in use. Measurement pauses when the app becomes inactive, moves to the background, or the phone is locked; the user must resume in the app. Unreliable or missing GPS intervals are excluded from fare calculation. In-progress trips are not restored after the app terminates. Completed trips are stored locally.

On iOS 26 or later, an ActivityKit Live Activity displays trip fare and status on supported system surfaces, including the CarPlay Dashboard. This is not a standalone CarPlay app and does not require the reviewer to find an app icon in the CarPlay launcher. Background GPS measurement is not implemented. CarPlay vehicle testing has not yet been completed.

No review account is required. Review contact details must be populated from verified account information by the app owner.

## 개인정보 공개 답안 권장

현재 소스 기준: “아니요, 이 앱에서 데이터를 수집하지 않습니다”(Data Not Collected).

근거:

- `src/hooks/useTaxiMeter.ts`: 사용 중 위치 권한만 요청. 좌표는 기기 메모리에서 거리·속도 산출에 사용하고 서버 전송 없음.
- `src/domain/tripHistory.ts` 및 `src/storage/tripHistoryStore.ts`: 일시·거리·시간·요금 등 완료 주행 요약만 로컬 저장. 위치 좌표·경로 저장 없음.
- `src/hooks/useReceiptSettings.ts`: 운수 이름 키워드는 AsyncStorage에 로컬 저장.
- `src/components/TripHistoryScreen.tsx`: 사용자가 선택하면 운영체제 공유 창으로 영수증을 전달. 개발자 서버 전송 없음.
- 앱 계정, 광고·분석 SDK, 추적, 개발자 서버 통신 기능 없음.
- Live Activity는 시스템 표시용 요약을 기기 내 앱 그룹을 통해 전달.

Apple은 데이터 수집을 개발자 또는 제3자 파트너가 접근할 수 있도록 기기 밖으로 데이터를 전송하는 행위로 정의한다. 기기 내 처리 자체와 위치 권한 사용이 바로 App Store의 데이터 수집에 해당하는 것은 아니다. 출처: https://developer.apple.com/app-store/app-privacy-details/ 및 https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy

최종 배포에 분석·광고·서버 기능을 추가한다면 답안을 다시 검토해야 한다. TestFlight/OS 자체의 Apple 데이터 처리는 앱 개발자의 수집 기능과 구분한다.

## URL 및 연락처 확인 결과

읽기 확인한 저장소:

- `/Users/kim-wongil/Documents/wongil/app-policy`: remote `git@github.com:wongil12/app-policy.git`. 현재 미미르 정책만 존재. 택시 미터의 위치 처리·기록·공유를 설명하지 않으므로 해당 정책을 그대로 개인정보 URL로 등록하면 안 된다.
- `/Users/kim-wongil/Documents/wongil/wongil-homepage`: remote `git@github.com:wongil12/wongil-homepage.git`. Next.js GitHub Pages 설정에서 `/wongil-homepage` basePath 확인.
- 기존 정책과 홈페이지의 연락처에 `judgevi52@gmail.com` 명시. 새 연락처를 추정하지 않았으며 이 문서 작성 중 외부 게시하지 않음.
- 추정 GitHub Pages 주소 `https://wongil12.github.io/app-policy/` 및 `https://wongil12.github.io/wongil-homepage/`는 웹 도구로 공개 접근 여부를 확인하지 못함. 확인 없이 유효한 지원·정책 URL로 간주하지 말 것.

등록 전 필요한 URL:

1. 택시 미터 전용 개인정보 처리방침 공개 페이지: 위치는 사용 중 기기 내 처리, 좌표 미보관, 완료 주행·운수 이름 로컬 저장, 사용자 선택 공유, 광고·분석 없음, 문의 방법 포함.
2. 택시 미터 지원 페이지: 문의 방법 및 위치 권한·측정 일시정지·요금 기준 안내 포함.

이 초안은 법적 약관의 동의나 실제 App Review 제출을 대신하지 않는다.
