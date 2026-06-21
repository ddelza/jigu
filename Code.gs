// ===== 설정 =====
var SHEET_ID = '1xoVrbYWU1BwfoJwN2e0CBXlDKE4zt_upD4OtqasnV3I'; // 제출 데이터를 쌓을 스프레드시트 ID
var SHEET_NAME = '제출현황';

// 분과별 정답 (여러 정답 허용: 배열로 등록, 공백/대소문자 무시 비교)
// 빈칸 개수: ①7개, ②6개, ③6개, ④6개 (최종 확정본 기준)
var SECTION_BLANKS = {
  '1': [
    ['복사에너지', '복사 에너지', '태양에너지', '태양 에너지', '태양복사에너지'],
    ['복사평형', '복사 평형'],
    ['온실효과'],
    ['이산화탄소'],
    ['온실기체', '온실가스'],
    ['이산화탄소'],
    ['지구온난화']
  ],
  '2': [
    ['포화수증기량'],
    ['단열팽창'],
    ['이슬점'],
    ['구름'],
    ['폭우', '집중호우', '폭우나집중호우'],
    ['가뭄']
  ],
  '3': [
    ['기압'],
    ['저기압'],
    ['고기압'],
    ['바람'],
    ['기압', '기온', '온도'],
    ['이상한파', '한파']
  ],
  '4': [
    ['기단'],
    ['전선'],
    ['정체전선'],
    ['북태평양'],
    ['사계절', '계절'],
    ['정체']
  ]
};

// 학생 명단 (학번: 이름) - 4자리 학번 (학년+반+번호, 예: 3101 = 3학년 1반 1번)
var STUDENT_ROSTER = {
  '3101': '강승재', '3102': '김수민', '3103': '김태연', '3104': '박도윤', '3105': '박예승',
  '3106': '박은호', '3107': '박혜나', '3108': '백서후', '3109': '성소언', '3110': '신채하',
  '3111': '안예찬', '3112': '이상호', '3113': '이소민', '3114': '이예원', '3115': '이윤성',
  '3116': '이효서', '3117': '전진하', '3118': '정수진', '3119': '정채아', '3120': '차수연',
  '3121': '최강원', '3122': '최은호', '3123': '최지혁', '3124': '최하윤', '3125': '박재련',
  '3201': '강승현', '3202': '곽누리', '3203': '김동한', '3204': '김민성', '3205': '김선재',
  '3206': '김수빈', '3207': '김우진', '3208': '박건', '3209': '박서호', '3210': '박정빈',
  '3211': '배주은', '3212': '성빛', '3213': '심다혜', '3214': '안준서', '3215': '오시현',
  '3216': '유승연', '3217': '유지호', '3218': '이문혁', '3219': '이선주', '3220': '이세은',
  '3221': '이하리', '3222': '차서정', '3223': '최서연', '3224': '허승찬',
  '3301': '강효민', '3302': '길라임', '3303': '김가은', '3304': '김벼리', '3305': '김살롬',
  '3306': '김상이', '3307': '김인구', '3308': '김주한', '3309': '김효영', '3310': '박서준',
  '3311': '박성준', '3312': '서하람', '3313': '서효준', '3314': '안학유', '3315': '안휘연',
  '3316': '윤나현', '3317': '이세영', '3318': '이예진', '3319': '이윤성', '3320': '장서윤',
  '3321': '전현석', '3322': '채수빈', '3323': '최재원', '3324': '한건희',
  '3401': '경나현', '3402': '고은별', '3403': '김다경', '3404': '김별', '3405': '김서우',
  '3406': '김시우', '3407': '김지우', '3408': '김하윤', '3409': '박시율', '3410': '배순우',
  '3411': '배태랑', '3412': '손지수', '3413': '양성원', '3414': '엄태양', '3415': '유태현',
  '3416': '이서아', '3417': '이석호', '3418': '이시유', '3419': '이하은', '3420': '장지효',
  '3421': '정다율', '3422': '정이온', '3423': '최현빈', '3424': '함병현', '3425': '황의범',
  '3501': '강다현', '3502': '김도후', '3503': '김민석', '3504': '김재혁', '3505': '김태양',
  '3506': '김태연', '3507': '류하늬', '3508': '박서이', '3509': '박준', '3510': '변아림',
  '3511': '성준혁', '3512': '심가온', '3513': '심나빈', '3514': '유태이', '3515': '이단',
  '3516': '이세아', '3517': '이우선', '3518': '이지윤', '3519': '정상빈', '3520': '정예리나',
  '3521': '정희현', '3522': '차유빈', '3523': '최서정', '3524': '한효주', '3525': '함건우'
};

var SECTION_META = {
  '1': { title: '🌍 복사 평형 분과' },
  '2': { title: '🌧️ 수증기·강수 분과' },
  '3': { title: '🌬️ 기압·바람 분과' },
  '4': { title: '☁️ 기단·전선 분과' }
};

// GitHub Pages(외부 도메인)에서 fetch로 호출하는 JSON API
// 예: GET ?action=checkStudent&studentId=3101&studentName=강승재
//     GET ?action=checkBlank&sectionId=1&blankIndex=0&answer=복사에너지
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (!action) {
    // 액션 파라미터가 없으면 (Apps Script에서 직접 미리보기할 때 등) 기존 HTML도 서빙
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('1차시 기후위기 긴급회의 핵심 개념일지')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  var result;
  if (action === 'checkStudent') {
    result = checkAlreadySubmitted(e.parameter.studentId, e.parameter.studentName);
  } else if (action === 'checkBlank') {
    result = { ok: checkBlank(e.parameter.sectionId, Number(e.parameter.blankIndex), e.parameter.answer) };
  } else {
    result = { error: 'unknown action' };
  }
  return jsonOutput_(result);
}

// GitHub Pages에서 제출은 POST로 (CORS 프리플라이트를 피하려 text/plain 본문에 JSON 문자열을 담아 보냄)
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var result;
  if (body.action === 'submit') {
    result = submitWorksheet(body.payload);
  } else {
    result = { error: 'unknown action' };
  }
  return jsonOutput_(result);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function normalize_(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

// 학번/이름이 명단과 일치하는지 확인
function verifyStudent_(studentId, studentName) {
  var registered = STUDENT_ROSTER[String(studentId).trim()];
  if (!registered) return false;
  return normalize_(registered) === normalize_(studentName);
}

// 클라이언트에서 호출: 학번/이름이 명단에 있는지 + 이미 제출했는지 확인
function checkAlreadySubmitted(studentId, studentName) {
  if (!verifyStudent_(studentId, studentName)) {
    return { valid: false, submitted: false, message: '학번 또는 이름이 명단과 일치하지 않습니다. 다시 확인해주세요.' };
  }

  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) {
      return { valid: true, submitted: true, section: data[i][3] };
    }
  }
  return { valid: true, submitted: false };
}

// 빈칸 1개 검증 (실시간 체크용)
function checkBlank(sectionId, blankIndex, answer) {
  var key = SECTION_BLANKS[sectionId][blankIndex];
  var ok = key.some(function (k) { return normalize_(k) === normalize_(answer); });
  return ok;
}

// 전체 제출
function submitWorksheet(payload) {
  // payload: { studentId, studentName, sectionId, blanks: [...], aiCheck, lifeAnswer }
  var sheet = getSheet_();

  var already = checkAlreadySubmitted(payload.studentId, payload.studentName);
  if (!already.valid) {
    return { success: false, message: already.message };
  }
  if (already.submitted) {
    return { success: false, message: '이미 제출한 기록이 있습니다. (분과: ' + already.section + ') 한 명당 한 분과만 제출 가능합니다.' };
  }

  var keys = SECTION_BLANKS[payload.sectionId];
  for (var i = 0; i < keys.length; i++) {
    var ok = keys[i].some(function (k) { return normalize_(k) === normalize_(payload.blanks[i]); });
    if (!ok) {
      return { success: false, message: (i + 1) + '번째 빈칸이 정답이 아닙니다. 다시 확인해주세요.' };
    }
  }

  if (!payload.aiCheck || payload.aiCheck.trim().length < 5) {
    return { success: false, message: 'AI 교차 검증 기록을 입력해주세요.' };
  }
  if (!payload.lifeAnswer || payload.lifeAnswer.trim().length < 5) {
    return { success: false, message: '인과 단계 서술을 입력해주세요.' };
  }

  sheet.appendRow([
    new Date(),
    payload.studentId,
    payload.studentName,
    SECTION_META[payload.sectionId].title,
    payload.blanks.join(' / '),
    payload.aiCheck,
    payload.lifeAnswer
  ]);

  return { success: true };
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['제출시각', '학번', '이름', '선택분과', '빈칸답안', 'AI교차검증기록', '인과단계서술']);
  }
  return sheet;
}
