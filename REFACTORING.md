# 리팩토링 계획서

> 작성일: 2026-07-21  
> 대상: `src/` 전체 코드베이스

---

## 목차

1. [중복 코드 제거](#1-중복-코드-제거)
2. [코드 구조 및 설계 개선](#2-코드-구조-및-설계-개선)
3. [성능 최적화](#3-성능-최적화)
4. [타입 안전성 강화](#4-타입-안전성-강화)
5. [기타 코드 품질 개선](#5-기타-코드-품질-개선)
6. [우선순위 요약](#6-우선순위-요약)

---

## 1. 중복 코드 제거

### 1-1. localStorage 접근 패턴 중복 (높음)

**위치:** `ejs-manager.ts`

`handleFileCreate` (L92–98)와 `updateStatusArea` (L326–334), `renderSettings` (L531–534)에서 동일한 타입 캐스팅 패턴이 3회 반복됩니다.

```typescript
// 현재 — 3곳에서 반복
const storage = this.plugin.app as unknown as {
  loadLocalStorage: (key: string) => string | null;
  saveLocalStorage: (key: string, value: string) => void;
};
const allowedHashesRaw = storage.loadLocalStorage('ejs-allowed-hashes');
const allowedHashes = allowedHashesRaw
  ? (JSON.parse(allowedHashesRaw) as Record<string, string>)
  : {};
```

**개선안:** 전용 헬퍼 메서드로 추출

```typescript
// 개선 — EjsManager 내부 private 메서드로 추출
private getStorage() {
  return this.plugin.app as unknown as {
    loadLocalStorage: (key: string) => string | null;
    saveLocalStorage: (key: string, value: string) => void;
  };
}

private loadAllowedHashes(): Record<string, string> {
  const raw = this.getStorage().loadLocalStorage('ejs-allowed-hashes');
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

private saveAllowedHashes(hashes: Record<string, string>): void {
  this.getStorage().saveLocalStorage('ejs-allowed-hashes', JSON.stringify(hashes));
}
```

---

### 1-2. 폴더 경로 정규화 로직 중복 (중간)

**위치:** `ejs-manager.ts`, `folder-suggest.ts`

템플릿 폴더 경로에서 접두사를 제거하는 로직이 여러 곳에 분산되어 있습니다.

- `ejs-manager.ts` `getFullTemplatePath()` (L29–30): 경로 양 끝 슬래시 정규화
- `ejs-manager.ts` `renderRules()` `updateTemplatePath()` (L276–283): 폴더 접두사 제거
- `utils/file.ts` `stripFolderPrefix()`: 동일 목적의 유틸

`ejs-manager.ts`의 `updateTemplatePath` 내 인라인 접두사 제거 로직을 이미 존재하는 `stripFolderPrefix()` 유틸로 대체할 수 있습니다.

```typescript
// 현재
const normalizedFolder = templatesFolder.replace(/\/+$/, '');
if (
  normalizedFolder &&
  saveVal.toLowerCase().startsWith(normalizedFolder.toLowerCase() + '/')
) {
  saveVal = saveVal.slice(normalizedFolder.length + 1);
}

// 개선
import { stripFolderPrefix } from '../utils/file';
saveVal = stripFolderPrefix(saveVal, templatesFolder);
```

---

### 1-3. settings 토글 UI 패턴 중복 (낮음)

**위치:** 모든 Manager의 `renderSettings()`

5개 매니저 (`periodic-notes.ts`, `folder-notes.ts`, `image-converter.ts`, `scroll-manager.ts`, `ejs-manager.ts`)에서 아래 패턴이 완전히 동일하게 반복됩니다.

```typescript
// 현재 — 5곳에서 반복
new Setting(containerEl)
  .setName('기능명')
  .setHeading()
  .addToggle((toggle) => {
    toggle
      .setValue(this.plugin.settings.someEnabled)
      .onChange(async (value) => {
        this.plugin.settings.someEnabled = value;
        await this.plugin.saveSettings();
        detailEl.style.display = value ? '' : 'none';
      });
  });

const detailEl = containerEl.createDiv();
detailEl.style.display = this.plugin.settings.someEnabled ? '' : 'none';
```

**개선안:** `BaseManager`에 헬퍼 메서드 추가

```typescript
// BaseManager에 추가
protected createToggleSection(
  containerEl: HTMLElement,
  name: string,
  getEnabled: () => boolean,
  setEnabled: (value: boolean) => Promise<void>,
): HTMLElement {
  const detailEl = containerEl.createDiv();

  new Setting(containerEl)
    .setName(name)
    .setHeading()
    .addToggle((toggle) => {
      toggle.setValue(getEnabled()).onChange(async (value) => {
        await setEnabled(value);
        detailEl.style.display = value ? '' : 'none';
      });
    });

  detailEl.style.display = getEnabled() ? '' : 'none';
  return detailEl;
}
```

> **참고:** 토글 반영 후 `detailEl`이 Setting 엘리먼트 **이후**에 위치해야 하므로, 헬퍼 내에서 순서를 명시해야 합니다.

---

### 1-4. 에러 표시 입력 패턴 중복 (낮음)

**위치:** `periodic-notes.ts` (L121–143), `image-converter.ts` (L311–370), `scroll-manager.ts` (L232–276), `ejs-manager.ts` (L481–505)

`setting-item-error is-hidden` 클래스를 사용하는 에러 표시 + `addClass/removeClass('is-hidden')` 패턴이 4곳에서 반복됩니다.

**개선안:** `utils/` 혹은 `BaseManager`에 공통 헬퍼 추출

```typescript
// 예시
function showError(errorEl: HTMLElement, message: string) {
  errorEl.textContent = message;
  errorEl.removeClass('is-hidden');
}
function clearError(errorEl: HTMLElement) {
  errorEl.addClass('is-hidden');
  errorEl.textContent = '';
}
```

---

## 2. 코드 구조 및 설계 개선

### 2-1. `onload()`에서 `isEnabled()` 중복 체크 (중간)

**위치:** `folder-notes.ts` L28, `image-converter.ts` L35, `image-converter.ts` L63

`BaseManager.enable()`이 이미 `isEnabled()`를 확인하고 `onload()`를 호출하므로, `onload()` 내부에서 다시 `if (!this.isEnabled()) return;`을 하는 것은 불필요한 방어 코드입니다.

단, **이벤트 핸들러 내부**에서의 체크(`vault.on('create')` 콜백 등)는 설정이 런타임에 변경될 수 있으므로 유지가 맞습니다. 반면 `onload()` 최상단 체크는 제거 가능합니다.

```typescript
// folder-notes.ts — 제거 가능
onload() {
  this.plugin.app.workspace.onLayoutReady(() => {
    if (!this.isEnabled()) return; // ← 불필요, BaseManager가 이미 보장
    ...
  });
}
```

---

### 2-2. `getOrCreatePeriodicNote()`의 분기 단순화 (낮음)

**위치:** `periodic-notes.ts` L68–76

현재 `if/else if/else` 분기를 `PATH_PATTERNS` 객체가 이미 존재하므로 직접 색인으로 단순화할 수 있습니다.

```typescript
// 현재
let fullPath: string;
if (noteType === 'weekly') {
  const week = now.format('WW');
  fullPath = PATH_PATTERNS.weekly(folder, year, week);
} else if (noteType === 'monthly') { ... }
else { ... }

// 개선 — 타입을 활용한 단순화
type NoteType = 'weekly' | 'monthly' | 'yearly';
const params: Record<NoteType, () => string> = {
  weekly:  () => PATH_PATTERNS.weekly(folder, year, now.format('WW')),
  monthly: () => PATH_PATTERNS.monthly(folder, year, now.format('MM')),
  yearly:  () => PATH_PATTERNS.yearly(folder, year),
};
const fullPath = params[noteType]();
```

---

### 2-3. `EjsManager.renderRules()`의 비동기 이벤트 핸들러 패턴 (중간)

**위치:** `ejs-manager.ts` L246–253, L274–289, L358–369, L392–399, L410–418, L427–432, L446–454

`void (async () => { ... })()` 패턴이 7회 반복됩니다. 이는 가독성을 해치며 에러 핸들링도 불일치합니다.

**개선안:** `addEventListener` 래퍼 유틸리티 추출 또는 직접 async arrow 사용

```typescript
// 현재
el.addEventListener('click', () => {
  void (async () => { ... })();
});

// 개선
el.addEventListener('click', async () => { ... });
// void 처리는 eslint no-misused-promises 설정에 맞게 조정
```

---

### 2-4. `TrashManager.getTrashFiles()`의 재귀 함수 스코프 (낮음)

**위치:** `trash-manager.ts` L40–57

`recurse` 함수가 외부 `files` 배열을 직접 mutate하는 클로저 방식입니다. 반환값 방식으로 리팩토링하면 테스트 용이성이 향상됩니다.

```typescript
// 개선
private async collectTrashFiles(dir: string): Promise<TrashFile[]> {
  const adapter = this.plugin.app.vault.adapter;
  const list = await adapter.list(dir);
  const files: TrashFile[] = [];

  for (const file of list.files) {
    const stat = await adapter.stat(file);
    files.push({ ... });
  }
  for (const folder of list.folders) {
    files.push(...await this.collectTrashFiles(folder));
  }
  return files;
}
```

---

### 2-5. `FolderNoteManager.onload()`의 이중 `onLayoutReady` 등록 (중간)

**위치:** `folder-notes.ts` L27, `main.ts` L31

`BaseManager.enable()`은 이미 `app.workspace.onLayoutReady()` 내에서 호출됩니다 (`main.ts` L31). 그런데 `FolderNoteManager.onload()` 내부에서 또 다시 `this.plugin.app.workspace.onLayoutReady()`를 호출합니다. 레이아웃이 준비된 이후 `enable()`이 호출된다면 내부의 `onLayoutReady` 콜백은 즉시 실행되므로 문제는 없지만, 설계 의도가 불명확합니다.

`bindObservers()`와 `layout-change` 이벤트 등록을 `onload()` 최상위로 올리고, `onLayoutReady`에 의존하는 이유를 주석으로 명시하거나 구조를 단순화할 것을 권장합니다.

---

## 3. 성능 최적화

### 3-1. `EjsManager` — 파일 생성 시마다 RegExp 객체 재생성 (높음)

**위치:** `ejs-manager.ts` L64

매 파일 생성 이벤트마다 `rules` 배열을 순회하며 `new RegExp(rule.pattern)`을 생성합니다. 규칙 수가 많거나 파일 생성이 빈번할 경우 불필요한 객체 생성이 발생합니다.

**개선안:** 설정 변경 시 미리 컴파일하여 캐시

```typescript
// EjsManager에 추가
private compiledRules: Array<{ regex: RegExp; templatePath: string } | null> = [];

private recompileRules() {
  this.compiledRules = this.plugin.settings.ejsRules.map((rule) => {
    if (!rule.pattern || !rule.templatePath) return null;
    try {
      return { regex: new RegExp(rule.pattern), templatePath: rule.templatePath };
    } catch {
      console.error(`패턴 정규식 오류 "${rule.pattern}"`);
      return null;
    }
  });
}

// onload() 및 onSettingsUpdate() 후 호출
// handleFileCreate에서는 compiledRules를 사용
```

---

### 3-2. `FolderNoteManager` — `getFolderNoteFile()`의 빈번한 vault 조회 (중간)

**위치:** `folder-notes.ts` L342–358, `refreshFolderStyles()` L315

`refreshFolderStyles()`에서 각 폴더 엘리먼트마다 `getFolderNoteFile()`을 호출하고, 그 내부에서 매번 `vault.getAbstractFileByPath()`를 호출합니다. 파일 탐색기에 폴더가 많을 경우 다수의 동기 vault 조회가 발생합니다.

**개선안:** `refreshFolderStyles()` 호출 시 폴더 노트 경로 셋을 한 번에 빌드하여 재사용

```typescript
private buildFolderNotePathSet(): Set<string> {
  const set = new Set<string>();
  // vault.getFiles()로 한 번만 순회하며 폴더 노트 경로 수집
  for (const file of this.plugin.app.vault.getFiles()) {
    if (this.isFolderNotePath(file.path)) {
      set.add(file.path);
    }
  }
  return set;
}
```

---

### 3-3. `ScrollManager` — `requestAnimationFrame` 누수 가능성 (중간)

**위치:** `scroll-manager.ts` L162

`updateScrollAnimation()`이 `window.requestAnimationFrame(this.updateScrollAnimation.bind(this))`로 자신을 재귀 호출하는데, `onunload()` 시 이 애니메이션 루프를 강제 종료하는 코드가 없습니다. 플러그인 비활성화 후에도 rAF 루프가 계속 실행될 수 있습니다.

**개선안:** rAF ID를 저장하고 `onunload()`에서 취소

```typescript
private rafId: number | null = null;

private updateScrollAnimation() {
  // ...
  this.rafId = window.requestAnimationFrame(this.updateScrollAnimation.bind(this));
}

onunload() {
  super.onunload();
  if (this.rafId !== null) {
    window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
  // ...기존 코드
}
```

---

### 3-4. `TrashManager.getTrashFiles()` — 파일별 순차 `stat()` 호출 (중간)

**위치:** `trash-manager.ts` L43

각 파일에 대해 `await adapter.stat(file)`을 순차적으로 호출합니다. 휴지통 파일이 많을 경우 성능 병목이 발생할 수 있습니다.

**개선안:** `Promise.all`로 병렬 처리

```typescript
// files 목록 수집 후
const stats = await Promise.all(list.files.map((f) => adapter.stat(f)));
list.files.forEach((file, i) => {
  const stat = stats[i];
  // ...
});
```

---

### 3-5. `ImageConverterManager` — `handleMarkdownMenuEvent()` 순차 변환 (낮음)

**위치:** `image-converter.ts` L273–280

노트 내 이미지를 순차 `await`로 변환합니다. 이미지가 많으면 변환 시간이 직렬로 누적됩니다.

**개선안:** `Promise.allSettled`로 병렬 처리

```typescript
const results = await Promise.allSettled(
  linkedImageFiles.map((imageFile) =>
    this.handleFileMenuEvent(imageFile, noteFile.basename),
  ),
);
const successCount = results.filter((r) => r.status === 'fulfilled').length;
results
  .filter((r) => r.status === 'rejected')
  .forEach((r, i) => {
    new Notice(
      `${linkedImageFiles[i]?.name} 변환 실패: ${(r as PromiseRejectedResult).reason}`,
    );
  });
```

---

## 4. 타입 안전성 강화

### 4-1. `as unknown as { ... }` 타입 단언 캡슐화 (중간)

**위치:** `ejs-manager.ts` L92–95, L326–329, L531–533

Obsidian의 비공개 API인 `loadLocalStorage`/`saveLocalStorage`를 `as unknown as { ... }`로 직접 캐스팅합니다. 타입 단언이 분산되어 있어 API 변경 시 모든 위치를 수정해야 합니다.

**개선안:** 중앙화된 타입 및 접근자 정의

```typescript
// types/obsidian-internal.ts 또는 ejs-manager.ts 상단
interface AppWithLocalStorage {
  loadLocalStorage(key: string): string | null;
  saveLocalStorage(key: string, value: string): void;
}
```

---

### 4-2. `settings-migrator.ts`의 반복적인 타입 가드 패턴 (낮음)

**위치:** `settings-migrator.ts` L10–76

`typeof d.field === 'type' ? d.field : DEFAULT` 패턴이 14회 반복됩니다.

**개선안:** 타입 안전한 제네릭 헬퍼

```typescript
function getString(
  d: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof d[key] === 'string' ? (d[key] as string) : fallback;
}
function getBoolean(
  d: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  return typeof d[key] === 'boolean' ? (d[key] as boolean) : fallback;
}
function getNumber(
  d: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  return typeof d[key] === 'number' ? (d[key] as number) : fallback;
}
```

---

### 4-3. `EjsManager.buildRenderContext()` 반환 타입 구체화 (낮음)

**위치:** `ejs-manager.ts` L147

반환 타입이 `Promise<Record<string, unknown>>`으로 너무 느슨합니다. `prompt`, `select` 등의 함수 시그니처가 EJS 템플릿 작성자에게 노출되지 않아 문서화가 어렵습니다.

**개선안:** 전용 인터페이스 정의

```typescript
interface EjsRenderContext {
  app: App;
  file: TFile;
  title: string;
  moment: typeof moment;
  prompt: (message: string, defaultValue?: string) => Promise<string>;
  select: (
    message: string,
    items: string[],
    values?: string[],
  ) => Promise<string>;
}
```

---

## 5. 기타 코드 품질 개선

### 5-1. `EjsManager.renderRules()` 함수 분리 (중간)

**위치:** `ejs-manager.ts` L198–456

`renderRules()`가 260줄에 달하는 단일 메서드입니다. 다음 책임이 혼재되어 있습니다:

- 규칙 목록 렌더링 (루프)
- 각 규칙 아이템 렌더링
- 상태 영역(status badge) 로직
- 컨트롤 버튼(이동/삭제) 렌더링
- 규칙 추가 버튼 렌더링

**개선안:** 책임별 메서드 분리

```
renderRules(rulesContainer)
  └─ renderRuleItem(listEl, rule, idx, rulesContainer)
       ├─ createPatternInput(ruleEl, rule)
       ├─ createTemplatePathInput(ruleEl, rule, updateStatusArea)
       ├─ updateStatusArea(statusAreaEl, rule) → async
       └─ createControlButtons(controlsEl, idx, rulesContainer)
```

---

### 5-2. 매직 스트링 상수화 (낮음)

**위치:** 여러 파일

| 위치                                         | 매직 스트링              | 개선안                                                |
| -------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `ejs-manager.ts` L96, L118, L331, L360, L534 | `'ejs-allowed-hashes'`   | `const EJS_ALLOWED_HASHES_KEY = 'ejs-allowed-hashes'` |
| `trash-manager.ts` L45, L59–61, L91–93       | `'.trash'`, `'.trash/'`  | `const TRASH_DIR = '.trash'`                          |
| `folder-notes.ts` L87, L115                  | `'.nav-files-container'` | `const NAV_FILES_CONTAINER = '.nav-files-container'`  |

---

### 5-3. `ScrollManager`의 `windowOpenRef` 미등록 문제 (중간)

**위치:** `scroll-manager.ts` L34–37

`this.plugin.app.workspace.on('window-open', ...)`의 반환값을 `this.windowOpenRef`에 저장하지만, `this.plugin.registerEvent()`로 등록하지 않아 플러그인 언로드 시 자동 정리가 되지 않습니다. 현재는 `onunload()`에서 수동으로 `offref()`를 호출하고 있어 기능적으로는 동작하지만, Obsidian 플러그인 패턴의 일관성을 위해 `registerEvent()`를 사용하는 것이 권장됩니다.

> **주의:** `registerEvent()`로 변경하면 `this.windowOpenRef` 필드 및 `onunload()`의 수동 해제 코드를 제거할 수 있어 코드가 단순해집니다.

---

### 5-4. `FolderSuggest` — 불필요한 `private inputEl` 필드 (낮음)

**위치:** `folder-suggest.ts` L6–11

`AbstractInputSuggest`의 생성자에 `textInputEl`을 전달하면 부모 클래스에서 이미 관리합니다. `FolderSuggest`의 `private inputEl` 필드는 `selectSuggestion()`에서만 사용되는데, 최소한 주석으로 이유를 명시하거나 Obsidian 내부 API 확인을 권장합니다.

---

### 5-5. `ensureDirectoryExists()` — vault API 중복 호출 (낮음)

**위치:** `utils/file.ts` L20–27

`app.vault.getAbstractFileByPath(currentPath)`로 존재 여부를 확인 후 없으면 `createFolder()`를 호출하는데, 이 사이에 TOCTOU(Time-of-check to time-of-use) 경쟁 조건이 이론적으로 존재합니다. 현재 코드는 이미 `catch`로 "폴더 존재" 에러를 무시하고 있어 실용적으로는 문제없지만, `getAbstractFileByPath()` 체크를 제거하고 항상 `createFolder()`를 시도한 뒤 에러를 무시하는 방식이 더 단순합니다.

---

## 6. 우선순위 요약

| 우선순위 | 항목                                 | 예상 효과                        |
| -------- | ------------------------------------ | -------------------------------- |
| 🔴 높음  | 3-1. RegExp 캐시 (EjsManager)        | 파일 생성 이벤트 성능 개선       |
| 🔴 높음  | 1-1. localStorage 헬퍼 추출          | 코드 중복 제거, 유지보수성 향상  |
| 🟠 중간  | 3-3. rAF 누수 방지 (ScrollManager)   | 플러그인 비활성화 시 안정성 향상 |
| 🟠 중간  | 3-4. stat() 병렬화 (TrashManager)    | 휴지통 로딩 속도 개선            |
| 🟠 중간  | 5-1. renderRules() 분리 (EjsManager) | 가독성 및 유지보수성 향상        |
| 🟠 중간  | 2-3. async 이벤트 핸들러 정리        | 가독성 향상                      |
| 🟠 중간  | 3-2. getFolderNoteFile() 캐시        | 파일 탐색기 렌더 성능 개선       |
| 🟡 낮음  | 1-2. stripFolderPrefix 재사용        | 중복 제거                        |
| 🟡 낮음  | 1-3. toggle 섹션 헬퍼화              | 보일러플레이트 감소              |
| 🟡 낮음  | 4-2. 마이그레이터 헬퍼               | 타입 안전성, 가독성 향상         |
| 🟡 낮음  | 5-2. 매직 스트링 상수화              | 오타 방지, 리팩토링 용이         |
| 🟡 낮음  | 2-4. recurse → 반환값 방식           | 테스트 용이성 향상               |
