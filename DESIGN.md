---
name: 택시 놀이 — 임시 기본 화면
description: App.tsx에서 추출한 미확정 React Native 화면 토큰
colors:
  light-background: "#F8F9F2"
  light-text: "#192119"
  light-muted: "#52604F"
  light-line: "#CDD4C7"
  light-accent: "#344E25"
  light-on-accent: "#FFFFFF"
  dark-background: "#121612"
  dark-text: "#F5F5E9"
  dark-muted: "#B7C0B6"
  dark-line: "#384238"
  dark-accent: "#E4F28B"
  dark-on-accent: "#19210D"
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

# Design System: 택시 놀이

## Overview

이 문서는 2026-10-07 현재 `App.tsx`에 구현된 임시 기본 화면을 기록한다. 사용자의 시각 디자인 방향, 브랜드, 색상 및 서체 선택은 아직 확정되지 않았다. 창의적 콘셉트를 승인받았거나 시각 검증을 완료했다는 의미가 아니다.

현재 화면은 가상 요금을 크게 표시하고 거리·시간·속도와 조작 버튼을 세로로 배치한다. 기기 테마에 따라 라이트와 다크 색상이 바뀐다. 아래 값은 현재 구현의 기록이며 최종 디자인 결정이 아니다.

## Colors

강조색은 주 동작 버튼과 로딩 표시, 중립색은 배경·본문·보조문구·구분선에 쓰인다. 라이트 모드의 어두운 녹색 강조와 다크 모드의 밝은 황록색 강조는 각각 해당 테마의 `on-accent` 글자색과 짝지어 사용한다. 개별 색상 값은 frontmatter를 따른다.

## Typography

현재 별도 폰트 파일이나 `fontFamily` 지정 없이 React Native의 시스템 기본 서체를 사용한다. 요금과 측정 수치는 `tabular-nums`로 지정되어 있다. 금액을 가장 크게, 화면 제목과 측정 수치를 그다음으로 표시한다. 본문과 레이블은 크기가 같지만 본문에만 명시적 행간이 있다.

frontmatter의 `px` 표기는 문서 형식에 맞춘 것이며, 원본 React Native 스타일에서는 기기 독립 숫자 단위를 사용한다. 큰 글자 설정과 긴 금액에서 실제 기기 시각 검증은 아직 필요하다.

## Layout

안전 영역 안에 세로 스크롤 화면을 사용한다. 콘텐츠는 가로 전체 너비에서 최대 640, 가운데 정렬이며 페이지 여백과 섹션 간격은 frontmatter에 기록했다. 머리글과 측정 행은 줄바꿈을 허용한다. 별도 화면 너비 분기나 그리드 전환은 없다. GPS 상태 영역과 위치 설정 동작은 최소 높이 48, 주요 버튼은 최소 높이 56이다.

## Elevation & Depth

현재 그림자와 입체 효과는 없다. 측정 정보의 위아래 얇은 선, 버튼 채움, 여백으로 영역을 구분한다. 전환 애니메이션은 구현되어 있지 않다.

## Shapes

주요 버튼과 보조 버튼은 같은 둥근 모서리를 사용한다. 보조 버튼에는 테마 구분선 색상의 1 단위 테두리가 있다. 별도 카드나 장식용 컨테이너는 없다.

## Components

- 주요 버튼: 테마 강조색 채움, 대조 글자색, 가운데 정렬. 대기·일시정지·실행·완료 상태에 따라 주행 시작, 다시 시작, 일시정지, 새 주행 준비를 표시한다.
- 보조 버튼: 투명 배경과 테두리. 실행 중 또는 일시정지 중 주행 종료를 제공한다.
- 버튼 상태: 누름 시 불투명도 0.7, 작업 중 비활성 상태는 0.5. 현재 별도 호버 및 포커스 시각 효과는 정의되지 않았다.
- 요금 표시: 큰 금액 옆에 작은 원 단위를 배치하고 오락용 안내를 함께 표시한다.
- 측정 행: 거리·시간·속도의 레이블과 수치를 양끝에 배치하며 공간이 부족하면 줄바꿈한다.
- 위치 설정 링크: 밑줄 텍스트와 최소 터치 높이를 사용한다.

## Do's and Don'ts

- Do: 현재 구현을 확장할 때 각 테마의 글자색과 배경색 조합을 함께 사용한다.
- Do: 가상 요금과 실제 택시 요금이 다르다는 안내를 읽을 수 있게 유지한다.
- Don't: 이 임시 토큰을 사용자 승인된 브랜드 지침으로 취급하지 않는다.
- Don't: 현재 기록만으로 접근성, 큰 글자, 실기기 시각 검증이 완료되었다고 주장하지 않는다.
