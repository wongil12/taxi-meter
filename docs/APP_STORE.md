# App Store 등록 초안 — 운행노트

작성 기준: 2026-10-14, 앱 0.1.0 / 빌드 5. 실제 등록 완료 여부는 RELEASE_STATUS.md를 확인한다.

## 기본 정보

- 이름: 운행노트
- 부제: 차량 운행 기록과 거리·시간 관리
- 기본 언어: 한국어
- 카테고리: 유틸리티
- 키워드: 운행,기록,차량,주행,거리,시간,GPS,드라이브,미터기,영수증
- 프로모션 문구: 오늘의 운행을 기록하세요. 거리와 시간을 확인하고, 최근 기록과 월별 요약을 간편하게 관리하세요.

## 설명

운행노트는 차량 운행의 거리와 시간을 기록하고 관리하는 앱입니다. 주행을 마친 뒤 기록을 확인하고 이미지나 텍스트로 공유할 수 있습니다.

운행 기록을 한눈에
• GPS로 이동 거리와 속도를 측정하고 주행 시간을 기록합니다.
• 시작, 일시정지, 재개, 종료를 간편하게 조작하세요.
• 최근 기록 100건을 기기에 저장하고, 저장된 기록을 기준으로 월별 거리와 시간을 확인하세요.
• 일반 운행 기록과 미터기 기록을 나누어 볼 수 있습니다.

CarPlay에서 운행 기록
• CarPlay 앱 목록에서 운행노트를 실행해 주행 기록을 시작하세요.
• 이동 거리, 주행 시간과 상태를 확인하고 일시정지하거나 종료할 수 있습니다.
• CarPlay 연결 중에는 iPhone 화면을 잠가도 측정이 계속됩니다.
• 자세한 기록 확인, 공유와 설정은 iPhone에서 이용하세요.

부가 기능: 택시 미터기
• 미터기 메뉴에서 거리와 저속 시간을 기준으로 요금을 계산합니다.
• 기본 1.6km까지 4,800원, 이후 131m마다 100원이 추가됩니다.
• 기본 거리 이후 시속 15km 이하에서는 30초마다 100원이 함께 추가됩니다.
• 미터기 영수증에는 설정한 운수 이름을 넣어 공유할 수 있습니다.
• 일반 운행 기록에는 요금이 부과되지 않습니다.

측정 안내
GPS 환경에 따라 거리와 속도에 오차가 있을 수 있습니다. CarPlay가 연결되지 않은 상태에서 다른 앱으로 전환하거나 화면을 잠그면 측정을 일시정지합니다. 앱이 종료되면 마지막으로 저장된 주행 상태를 일시정지 상태로 복원하며, 중단된 동안의 이동은 측정하지 않습니다.

위치 좌표와 이동 경로는 저장하거나 개발자 서버에 전송하지 않습니다. 완료한 주행 요약과 진행 상태는 기기에 저장합니다. 미터기 요금은 앱의 계산 기준이며 지역별 공식 택시 요금과 다를 수 있습니다. 필요한 설정은 정차 후 진행해 주세요.

## 이 버전의 새로운 기능

운행 기록 중심으로 화면을 개편하고 앱 이름과 아이콘을 변경했습니다. 독립 CarPlay 화면, 월별 요약과 기록 필터를 추가했으며 GPS 속도 표시, 시간 측정과 메뉴 선택 표시를 개선했습니다.

## TestFlight 테스트 안내

앱 이름이 운행노트로 변경되었습니다. iPhone에서 위치 접근을 허용한 뒤 일반 운행 기록을 시작해 거리·속도·시간, 일시정지·재개·종료, 기록 저장과 공유를 확인해 주세요. CarPlay 앱 목록에서 운행노트를 실행해 기록 시작·일시정지·종료와 iPhone 화면 잠금 상태에서의 측정을 확인해 주세요. CarPlay가 없을 때 화면을 잠그면 일시정지됩니다. 미터기 메뉴의 요금 계산과 영수증 공유도 확인해 주세요. 실제 차량에서의 CarPlay 동작은 이번 테스트에서 확인이 필요합니다.

## App Review 메모

The primary function is local vehicle trip logging. No login, purchases, or advertisements are required. The home screen starts an ordinary trip with distance and duration, without taxi fare. Saved trips can be filtered, reviewed and shared on iPhone.

The approved CarPlay Driving Task entitlement is enabled for this build. The standalone CarPlay interface uses CPInformationTemplate to show distance, duration and status, with start, pause/resume and finish controls. It does not show fares or animated driving content. Initial location permission must be granted on iPhone. GPS continues while a trip is running and CarPlay is connected; without CarPlay, entering the background pauses measurement. Native state is restored in a paused state after termination. Actual vehicle validation is pending TestFlight testing.

A secondary taxi meter is available on iPhone. Its fixed calculation is KRW 4,800 for the first 1.6 km, then KRW 100 per 131 m and KRW 100 per 30 seconds at 15 km/h or below. Time charges do not accrue within the base distance. This is not a certified taximeter or a claim of an official regional tariff.

Raw coordinates and routes are not persisted or sent to a developer server. Trip summaries and a recovery checkpoint remain on device. Sharing uses the iOS share sheet at the user's request. No review account is required.

## 정책 및 지원

- 개인정보: https://wongil12.github.io/app-policy/taxi-meter/privacy.html
- 지원: https://wongil12.github.io/app-policy/taxi-meter/support.html
- 원본 작업 폴더: `/Users/kim-wongil/Documents/wongil/app-policy/taxi-meter`
- 앱 이름 변경 후에도 기존 URL을 유지한다. 공개 반영 여부는 배포 기록에서 확인한다.
- 데이터 처리 답안은 새 빌드의 실제 동작을 기준으로 확인하며, App Review 제출은 별도 단계다.
