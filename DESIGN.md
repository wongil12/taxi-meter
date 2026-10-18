---
name: 운행노트 — 흰색·차콜과 파란 포인트
description: 사용자 승인 색상 방향과 src/theme.ts 공통 테마
colors:
  light-background: "#F5F5F3"
  light-text: "#2A3035"
  light-muted: "#626B72"
  light-line: "#DEE2E3"
  light-accent: "#416A8D"
  light-on-accent: "#FFFFFF"
  dark-background: "#1B1E21"
  dark-text: "#E4E7E9"
  dark-muted: "#ABB3BA"
  dark-line: "#373D43"
  dark-accent: "#9AB8D0"
  dark-on-accent: "#202A33"
typography:
  fare:
    fontSize: "56px"
    fontWeight: 700
  title:
    fontSize: "28px"
    fontWeight: 700
  currency:
    fontSize: "24px"
    fontWeight: 500
  reading:
    fontSize: "23px"
    fontWeight: 600
  button:
    fontSize: "18px"
    fontWeight: 600
  rule-title:
    fontSize: "17px"
    fontWeight: 600
  state:
    fontSize: "16px"
  body:
    fontSize: "15px"
    lineHeight: "23px"
  label:
    fontSize: "15px"
rounded:
  button: "14px"
spacing:
  compact: "8px"
  related: "12px"
  button-padding: "16px"
  reading-gap: "18px"
  readings-padding: "20px"
  page-padding: "24px"
  section-gap: "28px"
components:
  button-primary-light:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-on-accent}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
    typography: "{typography.button}"
  button-primary-dark:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-on-accent}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
    typography: "{typography.button}"
  button-secondary-light:
    backgroundColor: "transparent"
    textColor: "{colors.light-text}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
    typography: "{typography.button}"
  button-secondary-dark:
    backgroundColor: "transparent"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
    typography: "{typography.button}"
---

# Design System: 택시 미터

## Overview

이 문서는 2026-10-07 현재 `App.tsx`에 구현된 임시 기본 화면을 기록한다. 사용자의 시각 디자인 방향, 브랜드, 색상 및 서체 선택은 아직 확정되지 않았다. 창의적 콘셉트를 승인받았거나 시각 검증을 완료했다는 의미가 아니다.

준비 화면은 자동차와 시작 안내, 요금표를 표시한다. 시작 성공 후 주행 화면은 요금을 크게 표시하고 거리·시간·속도와 조작 버튼을 세로로 배치한다. 측정 시간은 GPS 과금 시간과 별개로 매초 갱신한다. 기기 테마에 따라 라이트와 다크 색상이 바뀐다. 아래 값은 현재 구현의 기록이며 최종 디자인 결정이 아니다.

## Colors

강조색은 주 동작 버튼과 로딩 표시, 중립색은 배경·본문·보조문구·구분선에 쓰인다. 라이트 모드의 어두운 녹색 강조와 다크 모드의 밝은 황록색 강조는 각각 해당 테마의 `on-accent` 글자색과 짝지어 사용한다. 개별 색상 값은 frontmatter를 따른다.

## Typography

현재 별도 폰트 파일이나 `fontFamily` 지정 없이 React Native의 시스템 기본 서체를 사용한다. 요금과 측정 수치는 `tabular-nums`로 지정되어 있다. 금액을 가장 크게, 화면 제목과 측정 수치를 그다음으로 표시한다. 본문과 레이블은 크기가 같지만 본문에만 명시적 행간이 있다.

frontmatter의 `px` 표기는 문서 형식에 맞춘 것이며, 원본 React Native 스타일에서는 기기 독립 숫자 단위를 사용한다. 큰 글자 설정과 긴 금액에서 실제 기기 시각 검증은 아직 필요하다.

## Layout

안전 영역 안에 세로 스크롤 화면을 사용한다. 콘텐츠는 가로 전체 너비에서 최대 640, 가운데 정렬이며 페이지 여백과 섹션 간격은 frontmatter에 기록했다. 머리글과 측정 행은 줄바꿈을 허용한다. 별도 화면 너비 분기나 그리드 전환은 없다. GPS 상태 영역과 위치 설정 동작은 최소 높이 48, 주요 버튼은 최소 높이 56이다.

## Elevation & Depth

현재 그림자와 입체 효과는 없다. 측정 정보의 위아래 얇은 선, 버튼 채움, 여백으로 영역을 구분한다. 시작 성공 시 준비 화면에서 주행 화면으로 280ms 전환한다. 자동차는 700ms 동안 진입하고 도로 점선은 900ms 주기로 흐른다. 일시정지·종료 시 멈추고 동작 줄이기 설정에서는 정적인 자동차를 표시한다. 자동차는 실제 GPS 속도를 표현하지 않는다.

## Shapes

주요 버튼과 보조 버튼은 같은 둥근 모서리를 사용한다. 보조 버튼에는 테마 구분선 색상의 1 단위 테두리가 있다. 별도 카드나 장식용 컨테이너는 없다.

## Components

- 주요 버튼: 테마 강조색 채움, 대조 글자색, 가운데 정렬. 대기·일시정지·실행·완료 상태에 따라 주행 시작, 다시 시작, 일시정지, 새 주행 준비를 표시한다.
- 보조 버튼: 투명 배경과 테두리. 실행 중 또는 일시정지 중 주행 종료를 제공한다.
- 버튼 상태: 누름 시 불투명도 0.7, 작업 중 비활성 상태는 0.5. 현재 별도 호버 및 포커스 시각 효과는 정의되지 않았다.
- 요금 표시: 큰 금액 옆에 작은 원 단위를 배치하고 적용 요금 기준을 함께 표시한다.
- 측정 행: 거리·시간·속도의 레이블과 수치를 양끝에 배치하며 공간이 부족하면 줄바꿈한다.
- 위치 설정 링크: 밑줄 텍스트와 최소 터치 높이를 사용한다.

## Do's and Don'ts

- Do: 현재 구현을 확장할 때 각 테마의 글자색과 배경색 조합을 함께 사용한다.
- Do: 사용자 지정 안내 문구인 안전 운전 하세요를 유지한다.
- Don't: 이 임시 토큰을 사용자 승인된 브랜드 지침으로 취급하지 않는다.
- Don't: 현재 기록만으로 접근성, 큰 글자, 실기기 시각 검증이 완료되었다고 주장하지 않는다.

## 주행 기록과 영수증

미터기에서 주행 히스토리로 진입하고, 각 기록에서 영수증으로 이동한다. 시스템 뒤로가기를 지원하며 빈 기록/불러오는 중/저장 실패/재시도 상태를 표시한다. 영수증은 공유 이미지에서도 일관되게 읽히도록 밝은 종이색(#FFFEF8), 진한 본문(#2A3035), 점선 구분을 사용한다. 이미지/텍스트 공유 버튼은 영수증 캡처 영역 밖에 둔다. CarPlay 소형 배너는 상태와 요금만 표시하며 시스템 글꼴과 레이아웃을 사용한다.

## 고정 주행 조작

주행/일시정지 화면의 일시정지·재개와 주행 종료 버튼은 스크롤 영역 밖, SafeAreaView 안의 하단 행에 고정한다. 화면 내용을 가리지 않으며 각 버튼은 가로 공간을 절반씩 사용하고 최소 높이 56을 유지한다. iPhone 17 Pro / iOS 26.5 시뮬레이터에서 스크롤 없이 두 버튼이 보임을 확인했다. 영수증 화면과 히스토리도 같은 기기에서 확인했다.

## 화면 이동

미터기/주행 기록 두 하단 탭을 고정하고 아이콘·레이블·선택 상태를 함께 표시한다. 영수증은 상세 화면으로, 상단에 출처인 주행 기록 또는 주행 완료로 돌아가는 버튼을 둔다. 제목과 뒤로가기는 스크롤 밖에 고정하며 기록 목록의 스크롤 위치를 보존한다. 주행 조작 행은 탭 바 위에 별도로 놓아 기록을 보면서도 일시정지/종료할 수 있다. 공유 중에는 화면 이동을 막아 캡처와 공유 대상을 유지한다.

## 2026-10-09 운행 기록 중심 개편

Operate 화면으로 기존 녹색 테마·시스템 서체·버튼 크기를 유지한다. 첫 화면은 이번 달 저장된 운행 요약, 운행 기록 시작, 최근 기록을 순서대로 배치한다. 요금은 주행 전체의 대표 수치가 아니라 미터기 기능 안에서만 표시한다. 일반 운행 상세/공유에는 운수 이름과 요금이 없다. 네 개 탭의 순서는 운행·기록·미터기·설정이며 측정 중 조작은 계속 화면 하단에 고정한다.

## 2026-10-10 영역 분리와 시인성

화면 바탕(light #EDF1E9 / dark #101510), 콘텐츠 표면(#FFFFFF / #202A20), 요약·안내 표면(#DFE8D7 / #293829)을 구분한다. 상단 제목과 하단 메뉴는 콘텐츠 표면으로 본문과 분리한다. 월 요약은 안내 표면, 개별 기록과 측정 수치는 테두리가 있는 콘텐츠 표면으로 묶는다. 경계선은 light #BBC8B3 / dark #495C49를 사용하며 그림자는 추가하지 않는다. 설정 입력과 미리보기에도 같은 표면 구분을 적용한다. 시뮬레이터에서 밝은 홈과 어두운 기록 화면을 확인했다.

## 2026-10-18 승인된 톤 변경

사용자는 흰색·차콜 바탕에 파란 포인트를 선택했다. 위 초기 구현 설명과 녹색 계열의 역사적 기록보다 이 절과 `src/theme.ts`가 우선한다. 홈·기록·미터기·설정·탭·자동차의 공통 테마에 적용하고, 공유 영수증은 흰 종이와 차콜 글자로 맞춘다. 시스템 다크 모드는 차콜 표면과 밝은 파란 강조를 사용한다. 앱 아이콘은 기존 자산을 유지한다.

화면 구조, 시스템 서체, 고정 조작 버튼, 선택 탭의 채움 강조를 유지한다. 요금은 휴대폰 미터기 및 영수증에만 표시한다. Live Activity와 CarPlay 소형 배너는 상태·거리·경과 시간(분 단위)을 표시한다. 실행 중과 일시정지를 구분하고 종료 시 제거한다.

상태 표시줄과 제목, 하단 메뉴와 홈 인디케이터 안전 영역은 같은 surface 색상으로 연결한다. 본문 ScrollView에만 background를 사용한다. 제목의 위/아래 여백은 12/16이다. iPhone 17 Release에서 상하단 연결을 확인했다.

## 2026-10-18 차분한 화면 정리 (현재 기준)

사용자의 눈 피로·복잡도 개선 요청으로 기존 파란 포인트를 저채도 스틸 블루로 조정했다. 이 절과 src/theme.ts가 앞선 역사적 설명보다 우선한다. Operate 화면의 시스템 서체와 기능·정보를 유지한다.

- 밝은 화면은 부드러운 회백색 바탕과 흰 표면, 어두운 화면은 검정 대신 차콜을 쓴다. 넓은 파란 패널과 반복 테두리를 제거한다.
- 하단 탭은 채움 없이 아이콘·텍스트 색과 굵기로 선택 상태를 표시한다. 제목은 22/600, 주요 수치는 21–23/600, 요금은 48/600이다.
- 월 요약은 중립색 표면, 최근 기록은 얇은 구분선으로 정리한다. 조작 버튼은 최소 56, 탭은 최소 56 높이를 유지한다.
- 미터기 준비 화면의 중복 제목과 정상 상태의 반복 안내만 줄인다. GPS 오류·권한 안내는 계속 표시한다. 자동차와 도로는 작게, 주행 애니메이션은 더 느리게 표시한다.
- 앱 아이콘은 스틸 블루 바탕의 흰 노트 안에 도로를 넣은 벡터다. assets/drive-log-icon.svg가 원본이고 동일 이름 PNG는 iOS/Expo용 1024 정사각형 자산이다.

검증: TypeScript 및 도메인 테스트 70개 통과. CarPlay 활성화 Release 시뮬레이터에서 홈(다크), 미터기 측정·일시정지·종료(다크), 기록·설정(라이트), 탭 선택 상태와 고정 조작 버튼을 확인했다. 주요 조합의 글자 대비는 최소 4.69:1이다. 실제 차량 및 큰 글자 설정은 이번 검증에 포함하지 않았다. 이번 디자인은 TestFlight 빌드 7 업로드 이후 변경분이다.
