# Obsidian All In One Toolkit

> [!WARNING]
> 이 플러그인은 개인 환경에 맞춰 최적화 되어 있습니다.
> 또한, 이 플러그인은 AI 주도로 개발되었기 때문에 사용시 주의가 필요합니다.

## Features

### 1. Image To WebP

복사 & 붙여넣기, 드래그 & 드랍 등 옵시디언에 불러오는 모든 이미지를 WebP 형식으로 변환합니다.

- WebP 퀄리티를 조절 할 수 있습니다. (기본: 85)
- heic 포맷을 지원합니다.

### 2. Periodic Notes

주간, 월간, 연간 노트를 생성합니다.

- 생성 위치는 하드코딩되어 있어 수정이 불가능합니다.

<small>명령어 팔레트를 통해서만 사용 가능합니다.</small>

### 3. Flder Notes

폴더에서 바로 마크다운, 캔버스, 베이스를 볼 수 있게 합니다.

- 폴더를 Ctrl 클릭, 우클릭을 통해 폴더 노트를 생성할 수 있습니다.
- 위 행동시 생성될 노트의 타입을 설정할 수 있습니다.

### 4. Trash Manager

옵시디언 .trash 폴더를 관리할 수 있도록 간단한 UI를 제공합니다.

- 복원, 영구 삭제, 일괄 삭제 등을 제공합니다.

<small>명령어 팔레트를 통해서만 사용 가능합니다.</small>

### 5. Scroll Manager

스크롤 속도를 조절할 수 있습니다.

<small>desktop only</small>

### 6. EJS Manager

EJS를 활용한 템플릿 엔진입니다.

- 템플릿 폴더를 지정할 수 있습니다.
- regex 기반 파일 매칭 기능을 지원합니다.
- 신뢰된 템플릿만 실행될 수 있는 기능을 지원합니다.

## Todos

### 1. 이 플러그인 최적화
- 기타 성능 이슈 해결
  - heic-decode가 현시점 필요한가?
    - 필요 없다면 선택형 빌드로..

### 2. EJS 코드 하이라이팅 추가

- 어떻게 잘 해보면 되지 않을까?

## Credits

- https://github.com/xryul/obsidian-image-converter
- https://github.com/LostPaul/obsidian-folder-notes
- https://github.com/flolu/obsidian-scroll-speed
- https://github.com/silentvoid13/Templater
