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

## Todos

### 1. ejs를 활용한 템플릿 플러그인 개발.

Templater의 핵심 기능을 가볍게 대체할 수 있는 ejs-manager?를 개발합니다.

- regex를 기반으로 한 템플릿 우선순위 관리
- 템플릿 해시를 저장 -> localStorage에도 저장 하여 템플릿 위변조 차단 (allow list된 템플릿만 이용 가능하도록)

### 2. 이 플러그인 최적화

- 코드 가독성 향상
  - 일단 한 파일에 다 밀어 넣긴 했는데... 읽기 드럽기 때문에 리팩토링 필요
- 기타 성능 이슈 해결
  - heic-decode가 현시점 필요한가?
    - 필요 없다면 선택형 빌드로..

## Credits

- https://github.com/xryul/obsidian-image-converter
- https://github.com/LostPaul/obsidian-folder-notes
- https://github.com/flolu/obsidian-scroll-speed
