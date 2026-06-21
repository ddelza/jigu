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

var SECTION_META = {
  '1': { title: '🌍 복사 평형 분과' },
  '2': { title: '🌧️ 수증기·강수 분과' },
  '3': { title: '🌬️ 기압·바람 분과' },
  '4': { title: '☁️ 기단·전선 분과' }
};

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('1차시 기후위기 긴급회의 핵심 개념일지')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function normalize_(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

// 클라이언트에서 호출: 분과 선택 시 학번/이름 기준 이미 제출했는지 확인
function checkAlreadySubmitted(studentId) {
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) {
      return { submitted: true, section: data[i][3] };
    }
  }
  return { submitted: false };
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

  var already = checkAlreadySubmitted(payload.studentId);
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
