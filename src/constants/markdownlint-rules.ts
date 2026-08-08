export interface MarkdownlintSubOptionMetadata {
  key: string;
  name: string;
  desc?: string;
  type: 'select' | 'number' | 'boolean' | 'string';
  isList?: boolean;
  options?: Record<string, string>;
  default: unknown;
}

export interface MarkdownlintRuleMetadata {
  id: string;
  name: string;
  desc: string;
  docUrl: string;
  defaultEnabled: boolean;
  subOptions?: MarkdownlintSubOptionMetadata[];
}

export function getRuleDocUrl(id: string): string {
  return `https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md#${id.toLowerCase()}`;
}

export const MARKDOWNLINT_ALL_RULES: MarkdownlintRuleMetadata[] = [
  // 1 ~ 10
  {
    id: 'MD001',
    name: 'heading-increment',
    desc: '제목 단계가 순차적으로 증가하는지 검사합니다 (예: H1 다음 H3 금지).',
    docUrl: getRuleDocUrl('MD001'),
    defaultEnabled: true,
  },
  {
    id: 'MD003',
    name: 'heading-style',
    desc: '제목 스타일(ATX 스타일 # 등) 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD003'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '문서 전체에서 사용할 제목(Heading) 스타일을 지정합니다 (atx, setext 등).',
        name: 'Heading Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          atx: 'atx (# Heading)',
          atx_closed: 'atx_closed (# Heading #)',
          setext: 'setext (Underline)',
          setext_with_atx: 'setext_with_atx (H1/H2 setext, 나머지 atx)',
          setext_with_atx_closed:
            'setext_with_atx_closed (H1/H2 setext, 나머지 atx_closed)',
        },
        default: 'consistent',
      },
    ],
  },
  {
    id: 'MD004',
    name: 'ul-style',
    desc: '순서 없는 목록 기호(*, -, +) 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD004'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '순서 없는 목록 기호(*, -, +)의 표기 스타일을 지정합니다.',
        name: 'Unordered List Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          asterisk: 'asterisk (*)',
          dash: 'dash (-)',
          plus: 'plus (+)',
          sublist: 'sublist (수준별 다른 기호)',
        },
        default: 'consistent',
      },
    ],
  },
  {
    id: 'MD005',
    name: 'list-indent',
    desc: '동일한 수준의 목록 항목 인덴트 들여쓰기 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD005'),
    defaultEnabled: true,
  },
  {
    id: 'MD007',
    name: 'ul-indent',
    desc: '하위 목록 항목의 들여쓰기 공백 수를 검사합니다.',
    docUrl: getRuleDocUrl('MD007'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'indent',
        desc: '하위 순서 없는 목록의 들여쓰기 공백(Space) 수를 지정합니다 (기본값: 2).',
        name: 'Indent Spaces',
        type: 'number',
        default: 2,
      },
    ],
  },
  {
    id: 'MD009',
    name: 'no-trailing-spaces',
    desc: '줄 끝에 남아있는 불필요한 공백을 제거합니다.',
    docUrl: getRuleDocUrl('MD009'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'br_spaces',
        name: 'Line break spaces',
        desc: '강제 줄바꿈(Hard break)에 허용할 줄 끝 공백 수를 지정합니다 (기본값: 2).',
        type: 'number',
        default: 2,
      },
    ],
  },
  {
    id: 'MD010',
    name: 'no-hard-tabs',
    desc: '탭(Tab) 문자를 공백(Space)으로 교정합니다.',
    docUrl: getRuleDocUrl('MD010'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'code_blocks',
        name: 'Include code blocks',
        desc: '코드 블록 내부의 탭(Tab) 문자 검사 포함 여부를 설정합니다.',
        type: 'boolean',
        default: true,
      },
    ],
  },

  // 11 ~ 20
  {
    id: 'MD011',
    name: 'no-reversed-links',
    desc: '잘못 작성된 링크 형식 (text)[link] 을 검사합니다.',
    docUrl: getRuleDocUrl('MD011'),
    defaultEnabled: true,
  },
  {
    id: 'MD012',
    name: 'no-multiple-blanks',
    desc: '연속된 빈 줄 개수를 제한합니다.',
    docUrl: getRuleDocUrl('MD012'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'maximum',
        desc: '허용되는 최대 연속 빈 줄 개수를 지정합니다 (기본값: 1).',
        name: 'Maximum consecutive blank lines',
        type: 'number',
        default: 1,
      },
    ],
  },
  {
    id: 'MD013',
    name: 'line-length',
    desc: '줄 길이가 제한을 초과하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD013'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'line_length',
        desc: '한 줄의 최대 허용 문자 수를 지정합니다 (기본값: 80).',
        name: 'Max line length',
        type: 'number',
        default: 80,
      },
      {
        key: 'code_blocks',
        desc: '코드 블록 내부의 줄 길이 검사 포함 여부를 설정합니다.',
        name: 'Include code blocks',
        type: 'boolean',
        default: true,
      },
      {
        key: 'tables',
        desc: '마크다운 표(Table) 내부의 줄 길이 검사 포함 여부를 설정합니다.',
        name: 'Include tables',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    id: 'MD014',
    name: 'commands-show-output',
    desc: '쉘 명령어 블록의 $ 프롬프트 사용 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD014'),
    defaultEnabled: true,
  },
  {
    id: 'MD018',
    name: 'no-missing-space-atx',
    desc: '제목 기호(#) 바로 뒤에 공백이 있는지 검사합니다.',
    docUrl: getRuleDocUrl('MD018'),
    defaultEnabled: true,
  },
  {
    id: 'MD019',
    name: 'no-multiple-space-atx',
    desc: '제목 기호(#) 바로 뒤에 다중 공백이 들어갔는지 검사합니다.',
    docUrl: getRuleDocUrl('MD019'),
    defaultEnabled: true,
  },
  {
    id: 'MD020',
    name: 'no-missing-space-closed-atx',
    desc: '닫는 제목 기호(#) 안쪽에 공백이 존재하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD020'),
    defaultEnabled: true,
  },

  // 21 ~ 30
  {
    id: 'MD021',
    name: 'no-multiple-space-closed-atx',
    desc: '닫는 제목 기호(#) 안쪽에 다중 공백이 존재하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD021'),
    defaultEnabled: true,
  },
  {
    id: 'MD022',
    name: 'blanks-around-headings',
    desc: '제목(Heading) 상하단에 빈 줄을 유지하도록 교정합니다.',
    docUrl: getRuleDocUrl('MD022'),
    defaultEnabled: true,
  },
  {
    id: 'MD023',
    name: 'headings-start-left',
    desc: '제목(Heading)이 들여쓰기 없이 라인 맨 왼쪽에서 시작하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD023'),
    defaultEnabled: true,
  },
  {
    id: 'MD024',
    name: 'no-duplicate-heading',
    desc: '문서 내 중복된 제목이 존재하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD024'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'siblings_only',
        name: 'Siblings only',
        desc: '동일한 상위 제목(부모 섹션) 산하의 하위 제목 간 중복만 검사합니다.',
        type: 'boolean',
        default: true,
      },
    ],
  },
  {
    id: 'MD025',
    name: 'single-title',
    desc: '문서 내 1단계 제목(H1)이 1개만 존재하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD025'),
    defaultEnabled: false,
  },
  {
    id: 'MD026',
    name: 'no-trailing-punctuation',
    desc: '제목 끝에 마침표 등의 구두점이 들어가는지 검사합니다.',
    docUrl: getRuleDocUrl('MD026'),
    defaultEnabled: false,
  },
  {
    id: 'MD027',
    name: 'no-multiple-space-blockquote',
    desc: '인용문 기호(>) 뒤 불필요한 연속 공백을 정리합니다.',
    docUrl: getRuleDocUrl('MD027'),
    defaultEnabled: true,
  },
  {
    id: 'MD028',
    name: 'no-blanks-blockquote',
    desc: '인용문(Blockquote) 구역 사이에 빈 줄이 포함되었는지 검사합니다.',
    docUrl: getRuleDocUrl('MD028'),
    defaultEnabled: true,
  },
  {
    id: 'MD029',
    name: 'ordered-list-prefix',
    desc: '순서 있는 목록의 숫자 표기 스타일을 검사합니다.',
    docUrl: getRuleDocUrl('MD029'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'style',
        desc: '순서 있는 목록의 숫자 표기 스타일을 지정합니다 (1. 2. 3. 또는 1. 1. 1. 등).',
        name: 'Ordered List Style',
        type: 'select',
        options: {
          one_or_ordered: 'one_or_ordered (1. 1. 또는 1. 2.)',
          ordered: 'ordered (오름차순 1. 2. 3.)',
          one: 'one (모두 1. 1. 1.)',
          zero: 'zero (모두 0. 0. 0.)',
        },
        default: 'one_or_ordered',
      },
    ],
  },
  {
    id: 'MD030',
    name: 'list-marker-space',
    desc: '목록 기호(*, -, 1.) 뒤에 공백이 있는지 검사합니다.',
    docUrl: getRuleDocUrl('MD030'),
    defaultEnabled: true,
  },

  // 31 ~ 40
  {
    id: 'MD031',
    name: 'blanks-around-fences',
    desc: '코드 블록(```) 상하단에 빈 줄을 유지하도록 교정합니다.',
    docUrl: getRuleDocUrl('MD031'),
    defaultEnabled: true,
  },
  {
    id: 'MD032',
    name: 'blanks-around-lists',
    desc: '목록(List) 구역 상하단에 빈 줄을 유지하도록 교정합니다.',
    docUrl: getRuleDocUrl('MD032'),
    defaultEnabled: true,
  },
  {
    id: 'MD033',
    name: 'no-inline-html',
    desc: '인라인 HTML 태그 사용을 제한합니다.',
    docUrl: getRuleDocUrl('MD033'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'allowed_elements',
        name: 'Allowed HTML Elements',
        desc: '검사에서 제외하고 허용할 HTML 태그 목록을 지정합니다 (쉼표로 구분).',
        type: 'string',
        isList: true,
        default: 'details,summary,div,span',
      },
    ],
  },
  {
    id: 'MD034',
    name: 'no-bare-urls',
    desc: '각진 괄호<>나 마크다운 링크 꺾쇠 없는 단순 URL 노출을 검사합니다.',
    docUrl: getRuleDocUrl('MD034'),
    defaultEnabled: true,
  },
  {
    id: 'MD035',
    name: 'hr-style',
    desc: '구분선(---, *** 등) 스타일 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD035'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '구분선(Horizontal Rule) 작성 시 표기 스타일을 지정합니다 (---, *** 등).',
        name: 'Horizontal Rule Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          dashes: '--- (Dashes)',
          asterisks: '*** (Asterisks)',
        },
        default: 'consistent',
      },
    ],
  },
  {
    id: 'MD036',
    name: 'no-emphasis-as-heading',
    desc: '제목 대신 볼드/이탤릭 강조 문장 사용을 제한합니다.',
    docUrl: getRuleDocUrl('MD036'),
    defaultEnabled: false,
  },
  {
    id: 'MD037',
    name: 'no-space-in-emphasis',
    desc: '강조 기호(*, _) 내부 양끝의 불필요한 공백을 검사합니다.',
    docUrl: getRuleDocUrl('MD037'),
    defaultEnabled: true,
  },
  {
    id: 'MD038',
    name: 'no-space-in-code',
    desc: '인라인 코드(`) 기호 내부 양끝의 불필요한 공백을 검사합니다.',
    docUrl: getRuleDocUrl('MD038'),
    defaultEnabled: true,
  },
  {
    id: 'MD039',
    name: 'no-space-in-links',
    desc: '링크 텍스트 [] 내부 양끝의 불필요한 공백을 검사합니다.',
    docUrl: getRuleDocUrl('MD039'),
    defaultEnabled: true,
  },
  {
    id: 'MD040',
    name: 'fenced-code-language',
    desc: '코드 블록 언어 프로그래밍 언어 명시를 요구합니다.',
    docUrl: getRuleDocUrl('MD040'),
    defaultEnabled: false,
  },

  // 41 ~ 50
  {
    id: 'MD041',
    name: 'first-line-heading',
    desc: '문서의 첫 번째 줄이 1단계 제목(#)으로 시작하도록 요구합니다.',
    docUrl: getRuleDocUrl('MD041'),
    defaultEnabled: false,
  },
  {
    id: 'MD042',
    name: 'no-empty-links',
    desc: '주소나 앵커가 비어있는 빈 링크 []() 사용을 검사합니다.',
    docUrl: getRuleDocUrl('MD042'),
    defaultEnabled: true,
  },
  {
    id: 'MD043',
    name: 'required-headings',
    desc: '문서 내에 필수 구조 제목 목록이 포함되어 있는지 검사합니다.',
    docUrl: getRuleDocUrl('MD043'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'headings',
        name: 'Required Headings',
        desc: '문서에 반드시 포함되어야 하는 제목(Heading) 구조 목록을 지정합니다 (쉼표로 구분, * 사용 가능).',
        type: 'string',
        isList: true,
        default: '*',
      },
    ],
  },
  {
    id: 'MD044',
    name: 'proper-names',
    desc: '고유 대소문자 명칭(예: JavaScript) 대소문자 표기 오류를 검사합니다.',
    docUrl: getRuleDocUrl('MD044'),
    defaultEnabled: false,
    subOptions: [
      {
        key: 'names',
        name: 'Proper Names',
        desc: '정확한 대소문자 표기를 강제할 고유 명사 목록을 지정합니다 (쉼표로 구분).',
        type: 'string',
        isList: true,
        default: 'JavaScript,TypeScript',
      },
    ],
  },
  {
    id: 'MD045',
    name: 'no-alt-text',
    desc: '이미지 마크다운 ![alt](url) 에 alt 대체 텍스트 입력을 요구합니다.',
    docUrl: getRuleDocUrl('MD045'),
    defaultEnabled: true,
  },
  {
    id: 'MD046',
    name: 'code-block-style',
    desc: '코드 블록 표기 스타일(Fenced ``` vs Indented 4-space) 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD046'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '코드 블록 작성 스타일을 지정합니다 (fenced: ```, indented: 들여쓰기 4공백).',
        name: 'Code Block Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          fenced: 'fenced (``` 사용)',
          indented: 'indented (들여쓰기 4칸)',
        },
        default: 'fenced',
      },
    ],
  },
  {
    id: 'MD047',
    name: 'single-trailing-newline',
    desc: '문서의 맨 끝이 단 하나의 개행 문자(Newline)로 끝나도록 정돈합니다.',
    docUrl: getRuleDocUrl('MD047'),
    defaultEnabled: true,
  },
  {
    id: 'MD048',
    name: 'code-fence-style',
    desc: '코드 펜스 기호(``` vs ~~~) 스타일 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD048'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '코드 펜스(Fenced Code) 기호 스타일을 지정합니다 (backtick: ```, tilde: ~~~).',
        name: 'Code Fence Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          backtick: 'backtick (```)',
          tilde: 'tilde (~~~)',
        },
        default: 'backtick',
      },
    ],
  },
  {
    id: 'MD049',
    name: 'emphasis-style',
    desc: '이탤릭 강조 스타일(* vs _) 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD049'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '이탤릭 강조(Emphasis) 기호 스타일을 지정합니다 (asterisk: *, underscore: _).',
        name: 'Emphasis Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          asterisk: 'asterisk (*)',
          underscore: 'underscore (_)',
        },
        default: 'asterisk',
      },
    ],
  },
  {
    id: 'MD050',
    name: 'strong-style',
    desc: '볼드 강조 스타일(** vs __) 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD050'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'style',
        desc: '볼드 강조(Strong) 기호 스타일을 지정합니다 (asterisk: **, underscore: __).',
        name: 'Strong Style',
        type: 'select',
        options: {
          consistent: 'consistent (일관된 스타일)',
          asterisk: 'asterisk (**)',
          underscore: 'underscore (__)',
        },
        default: 'asterisk',
      },
    ],
  },

  // 51 ~ 60
  {
    id: 'MD051',
    name: 'link-fragments',
    desc: '내부 앵커 링크(#header)가 실제 문서 내 존재하는 헤더를 가리키는지 검사합니다.',
    docUrl: getRuleDocUrl('MD051'),
    defaultEnabled: true,
  },
  {
    id: 'MD052',
    name: 'reference-links-images',
    desc: '참조형 링크 [text][id] 의 정의가 문서 내 존재하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD052'),
    defaultEnabled: true,
  },
  {
    id: 'MD053',
    name: 'link-image-reference-definitions',
    desc: '미사용 참조형 링크 정의 [id]: url 가 존재하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD053'),
    defaultEnabled: true,
  },
  {
    id: 'MD054',
    name: 'link-image-style',
    desc: '링크 및 이미지 표기 스타일 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD054'),
    defaultEnabled: true,
  },
  {
    id: 'MD055',
    name: 'table-pipe-style',
    desc: '마크다운 표 앞뒤 양끝 파이프(|) 기호 유무 스타일 일관성을 검사합니다.',
    docUrl: getRuleDocUrl('MD055'),
    defaultEnabled: true,
  },
  {
    id: 'MD056',
    name: 'table-column-count',
    desc: '마크다운 표의 헤더와 본문 각 행의 열(Column) 개수가 일치하는지 검사합니다.',
    docUrl: getRuleDocUrl('MD056'),
    defaultEnabled: true,
  },
  {
    id: 'MD058',
    name: 'blanks-around-tables',
    desc: '마크다운 표(Table) 구역 상하단에 빈 줄을 유지하도록 교정합니다.',
    docUrl: getRuleDocUrl('MD058'),
    defaultEnabled: true,
  },
  {
    id: 'MD059',
    name: 'descriptive-link-text',
    desc: '의미 있는 링크 텍스트 사용을 요구합니다 (예: "click here" 금지).',
    docUrl: getRuleDocUrl('MD059'),
    defaultEnabled: true,
    subOptions: [
      {
        key: 'prohibited_texts',
        name: 'Prohibited Link Texts',
        desc: '비명시적(의미 없는) 텍스트로 사용을 금지할 링크 텍스트 목록을 지정합니다 (쉼표로 구분).',
        type: 'string',
        isList: true,
        default: 'click here,link,here,more,about',
      },
    ],
  },
  {
    id: 'MD060',
    name: 'table-column-style',
    desc: '마크다운 표의 각 행 파이프(|) 기호 수직 정렬을 강제합니다.',
    docUrl: getRuleDocUrl('MD060'),
    defaultEnabled: false,
  },
];

export const DEFAULT_MARKDOWNLINT_RULES: Record<
  string,
  boolean | Record<string, unknown>
> = (() => {
  const defaults: Record<string, boolean | Record<string, unknown>> = {};
  for (const rule of MARKDOWNLINT_ALL_RULES) {
    if (rule.subOptions && rule.subOptions.length > 0) {
      const subConfig: Record<string, unknown> = {};
      for (const sub of rule.subOptions) {
        subConfig[sub.key] = sub.default;
      }
      defaults[rule.id] = rule.defaultEnabled ? subConfig : false;
    } else {
      defaults[rule.id] = rule.defaultEnabled;
    }
  }
  return defaults;
})();
