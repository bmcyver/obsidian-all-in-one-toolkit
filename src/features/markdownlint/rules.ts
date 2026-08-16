export interface MarkdownlintSubOptionMetadata {
  key: string;
  name: string;
  desc?: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  default: unknown;
  options?: Record<string, string>;
  isList?: boolean;
}

export interface MarkdownlintRuleMetadata {
  id: string;
  name: string;
  desc: string;
  defaultEnabled: boolean;
  subOptions?: MarkdownlintSubOptionMetadata[];
}

export const MARKDOWNLINT_ALL_RULES: MarkdownlintRuleMetadata[] = [
  {
    id: 'MD001',
    name: 'heading-increment',
    desc: '제목(Heading) 레벨은 한 번에 1단계씩만 증가해야 합니다.',
    defaultEnabled: true,
  },
  {
    id: 'MD003',
    name: 'heading-style',
    desc: '제목 스타일 일관성 (atx: # 형태 권장)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '제목 스타일',
        desc: '사용할 제목 문법 스타일을 선택합니다.',
        type: 'select',
        default: 'atx',
        options: {
          consistent: '일관성 유지 (consistent)',
          atx: 'ATX 스타일 (#)',
          atx_closed: '닫힌 ATX 스타일 (# ... #)',
          setext: 'Setext 스타일 (밑줄)',
          setext_with_atx: 'Setext 및 ATX 혼용',
          setext_with_atx_closed: 'Setext 및 닫힌 ATX 혼용',
        },
      },
    ],
  },
  {
    id: 'MD004',
    name: 'ul-style',
    desc: '비순서형 목록(Unordered list) 기호 스타일',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '목록 기호 스타일',
        type: 'select',
        default: 'dash',
        options: {
          consistent: '일관성 유지 (consistent)',
          dash: '대시 (-)',
          plus: '플러스 (+)',
          asterisk: '별표 (*)',
          sublist: '하위 목록별 구분',
        },
      },
    ],
  },
  {
    id: 'MD005',
    name: 'list-indent',
    desc: '동일 목록 레벨에서 들여쓰기 일관성 유지',
    defaultEnabled: true,
  },
  {
    id: 'MD007',
    name: 'ul-indent',
    desc: '비순서형 하위 목록 들여쓰기 공백 수',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'indent',
        name: '들여쓰기 공백 수',
        desc: '기본 2칸 또는 4칸 들여쓰기를 권장합니다.',
        type: 'number',
        default: 2,
      },
      {
        key: 'start_indented',
        name: '첫 목록 항목 들여쓰기 허용',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD009',
    name: 'no-trailing-spaces',
    desc: '줄 끝 불필요한 공백 제거',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'br_spaces',
        name: '줄바꿈용 공백 수',
        desc: '강제 줄바꿈(br)을 위해 허용할 줄 끝 공백 수 (기본 2칸 또는 0)',
        type: 'number',
        default: 2,
      },
      {
        key: 'list_item_empty_lines',
        name: '목록 빈 줄 공백 허용',
        type: 'boolean',
        default: false,
      },
      {
        key: 'strict',
        name: '엄격 모드 (br 공백도 불허)',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD010',
    name: 'no-hard-tabs',
    desc: '하드 탭(\\t) 문자 사용 금지 (공백 사용)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'code_blocks',
        name: '코드 블록 내 탭 허용 여부',
        type: 'boolean',
        default: true,
      },
      {
        key: 'spaces_per_tab',
        name: '탭당 공백 수',
        type: 'number',
        default: 2,
      },
    ],
  },
  {
    id: 'MD011',
    name: 'no-reversed-links',
    desc: '반대로 작성된 마크다운 링크 문법 교정 ( (text)[url] -> [text](url) )',
    defaultEnabled: true,
  },
  {
    id: 'MD012',
    name: 'no-multiple-blanks',
    desc: '연속된 다중 빈 줄 제한',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'maximum',
        name: '최대 허용 연속 빈 줄 수',
        type: 'number',
        default: 1,
      },
    ],
  },
  {
    id: 'MD013',
    name: 'line-length',
    desc: '줄 길이 제한 (옵시디언 노트 작성 환경 특성상 기본 비활성화 권장)',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'line_length',
        name: '최대 줄 길이',
        type: 'number',
        default: 80,
      },
      {
        key: 'heading_line_length',
        name: '제목 최대 줄 길이',
        type: 'number',
        default: 80,
      },
      {
        key: 'code_block_line_length',
        name: '코드 블록 최대 줄 길이',
        type: 'number',
        default: 80,
      },
      {
        key: 'code_blocks',
        name: '코드 블록 줄 길이 검사 포함',
        type: 'boolean',
        default: true,
      },
      {
        key: 'tables',
        name: '표(Table) 줄 길이 검사 포함',
        type: 'boolean',
        default: false,
      },
      {
        key: 'headings',
        name: '제목 줄 길이 검사 포함',
        type: 'boolean',
        default: true,
      },
      {
        key: 'strict',
        name: '엄격 모드',
        type: 'boolean',
        default: false,
      },
      {
        key: 'stern',
        name: '단어 분할 엄격 모드',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD014',
    name: 'commands-show-output',
    desc: '코드 블록 내 터미널 명령어 앞 달러 기호($) 단독 사용 제한',
    defaultEnabled: false,
  },
  {
    id: 'MD018',
    name: 'no-missing-space-atx',
    desc: 'ATX 제목 기호(#) 뒤에 공백 누락 금지 (#제목 -> # 제목)',
    defaultEnabled: true,
  },
  {
    id: 'MD019',
    name: 'no-multiple-space-atx',
    desc: 'ATX 제목 기호(#) 뒤에 다중 공백 사용 금지 (#  제목 -> # 제목)',
    defaultEnabled: true,
  },
  {
    id: 'MD020',
    name: 'no-missing-space-closed-atx',
    desc: '닫힌 ATX 제목 내부 공백 누락 금지',
    defaultEnabled: true,
  },
  {
    id: 'MD021',
    name: 'no-multiple-space-closed-atx',
    desc: '닫힌 ATX 제목 내부 다중 공백 사용 금지',
    defaultEnabled: true,
  },
  {
    id: 'MD022',
    name: 'blanks-around-headings',
    desc: '제목 위아래 빈 줄 유지',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'lines_above',
        name: '제목 위 빈 줄 수',
        type: 'number',
        default: 1,
      },
      {
        key: 'lines_below',
        name: '제목 아래 빈 줄 수',
        type: 'number',
        default: 1,
      },
    ],
  },
  {
    id: 'MD023',
    name: 'heading-start-left',
    desc: '제목은 들여쓰기 없이 줄 맨 앞에서 시작해야 합니다.',
    defaultEnabled: true,
  },
  {
    id: 'MD024',
    name: 'no-duplicate-heading',
    desc: '문서 내 중복된 제목 텍스트 제한',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'siblings_only',
        name: '동일 부모 하위 형제 제목 간에만 중복 제한',
        type: 'boolean',
        default: true,
      },
    ],
  },
  {
    id: 'MD025',
    name: 'single-title',
    desc: '문서 내 최상위 제목(H1 / Title)은 1개만 존재해야 합니다.',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'level',
        name: '최상위 제목 레벨',
        type: 'number',
        default: 1,
      },
      {
        key: 'front_matter_title',
        name: 'Frontmatter title 속성 정규식 패턴',
        type: 'string',
        default: '^\\s*title\\s*[:=]',
      },
    ],
  },
  {
    id: 'MD026',
    name: 'no-trailing-punctuation',
    desc: '제목 끝 마침표, 물음표 등 특수 구두점 제거',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'punctuation',
        name: '제한할 구두점 목록',
        type: 'string',
        default: '.,;:!。，；：！',
      },
    ],
  },
  {
    id: 'MD027',
    name: 'no-multiple-space-blockquote',
    desc: '인용문(>) 뒤에 불필요한 다중 공백 사용 금지',
    defaultEnabled: true,
  },
  {
    id: 'MD028',
    name: 'no-blanks-blockquote',
    desc: '인용문 블록 사이 빈 줄 분리 금지',
    defaultEnabled: true,
  },
  {
    id: 'MD029',
    name: 'ol-prefix',
    desc: '순서형 목록(Ordered list) 번호 스타일 (1/2/3 순차 또는 1/1/1)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '순서형 목록 번호 방식',
        type: 'select',
        default: 'one_or_ordered',
        options: {
          one: '모두 1. 방식 (1. / 1. / 1.)',
          ordered: '순차적 증가 (1. / 2. / 3.)',
          one_or_ordered: '1 또는 순차 방식 허용 (권장)',
          zero: '모두 0. 방식',
        },
      },
    ],
  },
  {
    id: 'MD030',
    name: 'list-marker-space',
    desc: '목록 기호 뒤 공백 수 일관성 유지',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'ul_single',
        name: '단일 줄 비순서형 목록 공백 수',
        type: 'number',
        default: 1,
      },
      {
        key: 'ol_single',
        name: '단일 줄 순서형 목록 공백 수',
        type: 'number',
        default: 1,
      },
      {
        key: 'ul_multi',
        name: '여러 줄 비순서형 목록 공백 수',
        type: 'number',
        default: 1,
      },
      {
        key: 'ol_multi',
        name: '여러 줄 순서형 목록 공백 수',
        type: 'number',
        default: 1,
      },
    ],
  },
  {
    id: 'MD031',
    name: 'blanks-around-fences',
    desc: '코드 블록(```) 위아래 빈 줄 유지',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'list_items',
        name: '목록 내부 코드 블록 검사 포함 여부',
        type: 'boolean',
        default: true,
      },
    ],
  },
  {
    id: 'MD032',
    name: 'blanks-around-lists',
    desc: '목록(List) 위아래 빈 줄 유지',
    defaultEnabled: true,
  },
  {
    id: 'MD033',
    name: 'no-inline-html',
    desc: '인라인 HTML 태그 사용 제한 (옵시디언 커스텀 서식 호환을 위해 기본 비활성화)',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'allowed_elements',
        name: '허용할 HTML 태그 (쉼표 구분)',
        type: 'string',
        default: 'br, span, kbd, sub, sup, details, summary, font',
        isList: true,
      },
    ],
  },
  {
    id: 'MD034',
    name: 'no-bare-urls',
    desc: '마크다운 링크나 꺾쇠괄호 없이 원시 URL 노출 금지',
    defaultEnabled: true,
  },
  {
    id: 'MD035',
    name: 'hr-style',
    desc: '구분선(Horizontal Rule) 스타일 일관성',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '구분선 스타일',
        type: 'string',
        default: '---',
      },
    ],
  },
  {
    id: 'MD036',
    name: 'no-emphasis-as-heading',
    desc: '제목(#) 대신 강조(**굵게**)를 제목처럼 사용하는 행위 제한',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'punctuation',
        name: '강조 문장 끝 허용 구두점',
        type: 'string',
        default: '.,;:!?。，；：！？',
      },
    ],
  },
  {
    id: 'MD037',
    name: 'no-space-in-emphasis',
    desc: '강조 기호 안쪽 공백 사용 금지 (** 텍스트 ** -> **텍스트**)',
    defaultEnabled: true,
  },
  {
    id: 'MD038',
    name: 'no-space-in-code',
    desc: '인라인 코드 안쪽 공백 사용 금지 (` code ` -> `code`)',
    defaultEnabled: true,
  },
  {
    id: 'MD039',
    name: 'no-space-in-links',
    desc: '링크 텍스트 안쪽 공백 사용 금지 ([ link ] -> [link])',
    defaultEnabled: true,
  },
  {
    id: 'MD040',
    name: 'fenced-code-language',
    desc: '코드 블록(```)에 언어(Language) 명시 강제',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'allowed_languages',
        name: '허용할 언어 목록 (쉼표 구분, 빈 값 시 모든 언어 허용)',
        type: 'string',
        default: '',
        isList: true,
      },
      {
        key: 'language_only',
        name: '언어 이름만 허용 (추가 매개변수 금지)',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD041',
    name: 'first-line-heading',
    desc: '문서의 첫 번째 줄은 반드시 최상위 제목이어야 합니다.',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'level',
        name: '첫 제목 레벨',
        type: 'number',
        default: 1,
      },
      {
        key: 'front_matter_title',
        name: 'Frontmatter title 속성 정규식 패턴',
        type: 'string',
        default: '^\\s*title\\s*[:=]',
      },
    ],
  },
  {
    id: 'MD042',
    name: 'no-empty-links',
    desc: 'URL 대상이 비어 있는 링크 금지 ([text]())',
    defaultEnabled: true,
  },
  {
    id: 'MD043',
    name: 'required-headings',
    desc: '문서에 포함되어야 하는 필수 제목 구조 강제',
    defaultEnabled: false,
  },
  {
    id: 'MD044',
    name: 'proper-names',
    desc: '고유 명사 대소문자 일관성 강제',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'names',
        name: '검사할 고유 명사 목록 (쉼표 구분)',
        type: 'string',
        default: 'JavaScript, TypeScript, Markdown, Obsidian',
        isList: true,
      },
      {
        key: 'code_blocks',
        name: '코드 블록 내 검사 포함 여부',
        type: 'boolean',
        default: false,
      },
      {
        key: 'html_elements',
        name: 'HTML 엘리먼트 내 검사 포함 여부',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD045',
    name: 'no-alt-text',
    desc: '이미지에 대체 텍스트(Alt text) 필수 지정 (![alt](url))',
    defaultEnabled: false,
  },
  {
    id: 'MD046',
    name: 'code-block-style',
    desc: '코드 블록 스타일 일관성 (fenced: ``` 권장)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '코드 블록 스타일',
        type: 'select',
        default: 'fenced',
        options: {
          consistent: '일관성 유지 (consistent)',
          fenced: '펜스형 (```)',
          indented: '들여쓰기형 (4칸)',
        },
      },
    ],
  },
  {
    id: 'MD047',
    name: 'single-trailing-newline',
    desc: '파일 끝에 단일 개행 문자(\\n) 유지',
    defaultEnabled: true,
  },
  {
    id: 'MD048',
    name: 'code-fence-style',
    desc: '코드 블록 펜스 기호 일관성 (백틱 ` 또는 물결 ~)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '코드 블록 기호',
        type: 'select',
        default: 'backtick',
        options: {
          consistent: '일관성 유지 (consistent)',
          backtick: '백틱 (`)',
          tilde: '물결표 (~)',
        },
      },
    ],
  },
  {
    id: 'MD049',
    name: 'emphasis-style',
    desc: '기울임꼴(Emphasis) 서식 기호 일관성 (* 또는 _)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '기울임 서식 기호',
        type: 'select',
        default: 'asterisk',
        options: {
          consistent: '일관성 유지 (consistent)',
          asterisk: '별표 (*)',
          underscore: '언더스코어 (_)',
        },
      },
    ],
  },
  {
    id: 'MD050',
    name: 'strong-style',
    desc: '굵게(Strong) 서식 기호 일관성 (** 또는 __)',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '굵게 서식 기호',
        type: 'select',
        default: 'asterisk',
        options: {
          consistent: '일관성 유지 (consistent)',
          asterisk: '별표 (**)',
          underscore: '언더스코어 (__)',
        },
      },
    ],
  },
  {
    id: 'MD051',
    name: 'link-fragments',
    desc: '문서 내 앵커/헤딩 링크(#id) 유효성 검사',
    defaultEnabled: true,
  },
  {
    id: 'MD052',
    name: 'reference-links-images',
    desc: '참조형 링크 및 이미지 정의 유효성 검사',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'shortcut_syntax',
        name: '단축 참조 문법 허용 ([shortcut])',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD053',
    name: 'link-image-reference-definitions',
    desc: '미사용 링크/이미지 참조 정의 제거',
    defaultEnabled: true,
  },
  {
    id: 'MD054',
    name: 'link-image-style',
    desc: '링크 및 이미지 문법 스타일 일관성 (인라인 vs 참조형 vs 자동링크)',
    defaultEnabled: false,
    subOptions: [
      {
        key: 'autolink',
        name: '자동 링크 허용',
        type: 'boolean',
        default: true,
      },
      {
        key: 'inline',
        name: '인라인 링크 허용',
        type: 'boolean',
        default: true,
      },
      {
        key: 'full',
        name: '전체 참조 링크 허용',
        type: 'boolean',
        default: true,
      },
      {
        key: 'collapsed',
        name: '축약 참조 링크 허용',
        type: 'boolean',
        default: true,
      },
      {
        key: 'shortcut',
        name: '단축 참조 링크 허용',
        type: 'boolean',
        default: true,
      },
      {
        key: 'url_inline',
        name: '원시 URL 인라인 허용',
        type: 'boolean',
        default: true,
      },
    ],
  },
  {
    id: 'MD055',
    name: 'table-pipe-style',
    desc: '표(Table) 파이프(|) 테두리 스타일 일관성',
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        name: '테두리 파이프 스타일',
        type: 'select',
        default: 'consistent',
        options: {
          consistent: '일관성 유지 (consistent)',
          leading_and_trailing: '양쪽 파이프 필수 (| col |)',
          no_leading_or_trailing: '양쪽 파이프 생략 (col)',
          leading_only: '시작 파이프만 (| col)',
          trailing_only: '끝 파이프만 (col |)',
        },
      },
    ],
  },
  {
    id: 'MD056',
    name: 'table-column-count',
    desc: '표(Table) 행마다 열(Column) 개수 일치 강제',
    defaultEnabled: true,
  },
];

export function getRuleDocUrl(ruleId: string): string {
  return `https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md#${ruleId.toLowerCase()}`;
}

export function getDefaultMarkdownlintRules(): Record<
  string,
  boolean | Record<string, unknown>
> {
  const defaults: Record<string, boolean | Record<string, unknown>> = {};
  for (const rule of MARKDOWNLINT_ALL_RULES) {
    if (!rule.defaultEnabled) {
      defaults[rule.id] = false;
      continue;
    }

    if (rule.subOptions && rule.subOptions.length > 0) {
      const subConfig: Record<string, unknown> = {};
      for (const sub of rule.subOptions) {
        subConfig[sub.key] = sub.default;
      }
      defaults[rule.id] = subConfig;
    } else {
      defaults[rule.id] = true;
    }
  }
  return defaults;
}

export const DEFAULT_MARKDOWNLINT_RULES = getDefaultMarkdownlintRules();

export const MARKDOWNLINT_RULES_MAP = new Map<string, MarkdownlintRuleMetadata>(
  MARKDOWNLINT_ALL_RULES.map((rule) => [rule.id, rule]),
);
