// ===== 설정 =====
var SHEET_ID = '1xoVrbYWU1BwfoJwN2e0CBXlDKE4zt_upD4OtqasnV3I'; // 제출 데이터를 쌓을 스프레드시트 ID
var SHEET_NAME = '제출현황';
var LEARNING_SHEET_NAME = '제출현황2'; // learning.html(친구 발표 듣기) 제출 기록
var VALUE_SHEET_NAME = '인과 제출 및 가치관점'; // student_value.html 제출 기록
var DRAFT_SHEET_NAME = '임시저장'; // student_value.html 임시저장(이어쓰기) 기록
var PASSWORD_SHEET_ID = '1JcgoufQUypJR6ItEBGWR7xVE-e1vBqXqfYddkEgXlJg'; // student.html 접속 시 본인 확인용 비밀번호가 있는 스프레드시트 (학번/비밀번호 탭)

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

var ROSTER_SHEET_NAME = '학생별'; // 학번(A열)/이름(B열)이 들어있는 명단 탭

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
  } else if (action === 'checkLearningStatus') {
    result = checkLearningStatus(e.parameter.studentId, e.parameter.studentName);
  } else if (action === 'getMySubmissions') {
    result = getMySubmissions(e.parameter.studentId, e.parameter.studentName, e.parameter.password);
  } else if (action === 'checkValueSubmitted') {
    result = checkValueAlreadySubmitted(e.parameter.studentId, e.parameter.studentName);
  } else if (action === 'getDraft') {
    result = getDraft(e.parameter.studentId, e.parameter.studentName);
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
  } else if (body.action === 'submitLearning') {
    result = submitLearningWorksheet(body.payload);
  } else if (body.action === 'submitValue') {
    result = submitValuePerspective(body.payload);
  } else if (body.action === 'saveDraft') {
    result = saveDraft(body.payload);
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
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) return false;

  var data = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues(); // A열: 학번, B열: 이름
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(studentId).trim()) {
      return normalize_(data[i][1]) === normalize_(studentName);
    }
  }
  return false;
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

function getLearningSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(LEARNING_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LEARNING_SHEET_NAME);
    sheet.appendRow(['제출시각', '학번', '이름', '청취분과', '빈칸답안']);
  }
  return sheet;
}

function getSectionIdByTitle_(title) {
  for (var id in SECTION_META) {
    if (SECTION_META[id].title === title) return id;
  }
  return null;
}

// 학생이 1차(index.html)에서 제출한 본인 분과 ID를 찾음
function getOwnSectionId_(studentId) {
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) {
      return getSectionIdByTitle_(data[i][3]);
    }
  }
  return null;
}

// learning.html에서 이 학생이 이미 청취 제출을 완료한 분과 ID 목록
function getLearningDoneSectionIds_(studentId) {
  var sheet = getLearningSheet_();
  var data = sheet.getDataRange().getValues();
  var done = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) {
      var id = getSectionIdByTitle_(data[i][3]);
      if (id && done.indexOf(id) === -1) done.push(id);
    }
  }
  return done;
}

// 클라이언트(learning.html)에서 호출: 본인 확인 + 본인 분과 + 이미 청취 완료한 분과 목록 반환
function checkLearningStatus(studentId, studentName) {
  if (!verifyStudent_(studentId, studentName)) {
    return { valid: false, message: '학번 또는 이름이 명단과 일치하지 않습니다. 다시 확인해주세요.' };
  }

  var ownSectionId = getOwnSectionId_(studentId);
  if (!ownSectionId) {
    return { valid: false, message: '먼저 본인의 핵심 개념일지(1차 제출)를 완료해야 친구 발표를 들을 수 있습니다.' };
  }

  return {
    valid: true,
    ownSectionId: ownSectionId,
    doneSectionIds: getLearningDoneSectionIds_(studentId)
  };
}

// learning.html 전체 제출 (빈칸만, AI검증/인과서술 없음, 여러 번 제출 가능 - 본인 분과 제외 나머지 3개)
function submitLearningWorksheet(payload) {
  // payload: { studentId, studentName, sectionId, blanks: [...] }
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }

  var ownSectionId = getOwnSectionId_(payload.studentId);
  if (!ownSectionId) {
    return { success: false, message: '먼저 본인의 핵심 개념일지(1차 제출)를 완료해야 합니다.' };
  }
  if (String(payload.sectionId) === String(ownSectionId)) {
    return { success: false, message: '본인이 발표한(제출한) 분과는 청취 분과로 선택할 수 없습니다.' };
  }

  var doneIds = getLearningDoneSectionIds_(payload.studentId);
  if (doneIds.indexOf(String(payload.sectionId)) !== -1) {
    return { success: false, message: '이미 이 분과는 제출을 완료했습니다.' };
  }

  var keys = SECTION_BLANKS[payload.sectionId];
  for (var i = 0; i < keys.length; i++) {
    var ok = keys[i].some(function (k) { return normalize_(k) === normalize_(payload.blanks[i]); });
    if (!ok) {
      return { success: false, message: (i + 1) + '번째 빈칸이 정답이 아닙니다. 다시 확인해주세요.' };
    }
  }

  var sheet = getLearningSheet_();
  sheet.appendRow([
    new Date(),
    payload.studentId,
    payload.studentName,
    SECTION_META[payload.sectionId].title,
    payload.blanks.join(' / ')
  ]);

  return { success: true, doneSectionIds: doneIds.concat([String(payload.sectionId)]) };
}

// 비밀번호 스프레드시트에서 학번/비밀번호 열을 찾아 일치 여부 확인
function verifyPassword_(studentId, password) {
  var ss = SpreadsheetApp.openById(PASSWORD_SHEET_ID);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return false;

  var header = data[0];
  var idCol = -1, pwCol = -1;
  for (var c = 0; c < header.length; c++) {
    var h = normalize_(header[c]);
    if (h.indexOf('학번') !== -1 && idCol === -1) idCol = c;
    if (h.indexOf('비밀번호') !== -1 && pwCol === -1) pwCol = c;
  }
  if (idCol === -1 || pwCol === -1) return false;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(studentId).trim()) {
      return String(data[i][pwCol]).trim() === String(password || '').trim();
    }
  }
  return false;
}

// 클라이언트(student.html)에서 호출: 본인이 제출한 1차/2차 답안을 모두 조회 (읽기 전용, 비밀번호 확인 필요)
function getMySubmissions(studentId, studentName, password) {
  if (!verifyStudent_(studentId, studentName)) {
    return { valid: false, message: '학번 또는 이름이 명단과 일치하지 않습니다. 다시 확인해주세요.' };
  }
  if (!verifyPassword_(studentId, password)) {
    return { valid: false, message: '비밀번호가 일치하지 않습니다. 다시 확인해주세요.' };
  }

  var own = null;
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) {
      own = {
        timestamp: Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
        section: data[i][3],
        blanks: data[i][4],
        aiCheck: data[i][5],
        lifeAnswer: data[i][6]
      };
      break;
    }
  }

  var learning = [];
  var learningSheet = getLearningSheet_();
  var learningData = learningSheet.getDataRange().getValues();
  for (var j = 1; j < learningData.length; j++) {
    if (String(learningData[j][1]) === String(studentId)) {
      learning.push({
        timestamp: Utilities.formatDate(new Date(learningData[j][0]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
        section: learningData[j][3],
        blanks: learningData[j][4]
      });
    }
  }

  return { valid: true, own: own, learning: learning };
}

function getValueSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(VALUE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(VALUE_SHEET_NAME);
    sheet.appendRow(['제출시각', '학번', '이름', '가장 긴 인과 사슬', '평소 중요하게 생각하는 가치', '선택한 관점', '관점을 선택한 이유']);
  }
  return sheet;
}

// 제출 시트의 한 행이 4개 답안(인과사슬/가치/관점/이유)을 모두 채우고 있는지 확인
function isValueRowComplete_(row) {
  return String(row[3] || '').trim() !== '' &&
    String(row[4] || '').trim() !== '' &&
    String(row[5] || '').trim() !== '' &&
    String(row[6] || '').trim() !== '';
}

// 학번으로 제출 시트에서 행 번호(1-based)를 찾음. 없으면 -1
function findValueRow_(sheet, studentId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) return i + 1;
  }
  return -1;
}

// 클라이언트(student_value.html)에서 호출: 학번/이름 확인 + 이미 (완전히) 제출했는지 확인
// 선생님이 제출 시트에서 특정 칸만 지운 경우, 그 칸만 비운 채로 이어서 작성할 수 있도록 draft를 함께 반환
function checkValueAlreadySubmitted(studentId, studentName) {
  if (!verifyStudent_(studentId, studentName)) {
    return { valid: false, submitted: false, message: '학번 또는 이름이 명단과 일치하지 않습니다. 다시 확인해주세요.' };
  }

  var sheet = getValueSheet_();
  var rowNum = findValueRow_(sheet, studentId);

  if (rowNum !== -1) {
    var row = sheet.getRange(rowNum, 1, 1, 7).getValues()[0];
    if (isValueRowComplete_(row)) {
      return { valid: true, submitted: true };
    }
    // 일부 칸이 비어있음 -> 제출 시트의 남은 내용을 불러와 이어서 작성하게 함
    return {
      valid: true,
      submitted: false,
      draft: {
        causalChain: row[3] || '',
        value: row[4] || '',
        perspective: row[5] || '',
        reason: row[6] || ''
      }
    };
  }

  return { valid: true, submitted: false, draft: getDraft(studentId, studentName).draft };
}

function getDraftSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DRAFT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DRAFT_SHEET_NAME);
    sheet.appendRow(['수정시각', '학번', '이름', '인과사슬(임시)', '가치(임시)', '관점(임시)', '이유(임시)']);
  }
  return sheet;
}

function findDraftRow_(sheet, studentId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) return i + 1; // 1-based row number
  }
  return -1;
}

// 클라이언트(student_value.html)에서 호출: 임시저장된 답안 불러오기
function getDraft(studentId, studentName) {
  if (!verifyStudent_(studentId, studentName)) {
    return { valid: false, message: '학번 또는 이름이 명단과 일치하지 않습니다. 다시 확인해주세요.' };
  }

  var sheet = getDraftSheet_();
  var rowNum = findDraftRow_(sheet, studentId);
  if (rowNum === -1) return { valid: true, draft: null };

  var row = sheet.getRange(rowNum, 1, 1, 7).getValues()[0];
  return {
    valid: true,
    draft: {
      causalChain: row[3] || '',
      value: row[4] || '',
      perspective: row[5] || '',
      reason: row[6] || ''
    }
  };
}

// student_value.html 임시저장 (전체 항목을 다 채우지 않아도 저장 가능, 학번당 1행을 덮어씀)
function saveDraft(payload) {
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }

  var sheet = getDraftSheet_();
  var rowNum = findDraftRow_(sheet, payload.studentId);
  var rowValues = [
    new Date(),
    payload.studentId,
    payload.studentName,
    payload.causalChain || '',
    payload.value || '',
    payload.perspective || '',
    payload.reason || ''
  ];

  if (rowNum === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowNum, 1, 1, 7).setValues([rowValues]);
  }

  return { success: true };
}

// student_value.html 전체 제출
function submitValuePerspective(payload) {
  // payload: { studentId, studentName, causalChain, value, perspective, reason }
  var already = checkValueAlreadySubmitted(payload.studentId, payload.studentName);
  if (!already.valid) {
    return { success: false, message: already.message };
  }
  if (already.submitted) {
    return { success: false, message: '이미 제출한 기록이 있습니다. 한 명당 한 번만 제출 가능합니다.' };
  }

  if (!payload.causalChain || payload.causalChain.trim().length < 5) {
    return { success: false, message: '가장 긴 인과 사슬을 화살표로 옮겨 적어주세요.' };
  }
  if (!payload.value || payload.value.trim().length < 2) {
    return { success: false, message: '평소에 중요하게 생각하는 가치를 입력해주세요.' };
  }
  if (!payload.perspective) {
    return { success: false, message: '선택한 관점을 골라주세요.' };
  }
  if (!payload.reason || payload.reason.trim().length < 5) {
    return { success: false, message: '관점을 선택한 이유를 구체적으로 작성해주세요.' };
  }

  var sheet = getValueSheet_();
  var rowValues = [
    new Date(),
    payload.studentId,
    payload.studentName,
    payload.causalChain,
    payload.value,
    payload.perspective,
    payload.reason
  ];

  var existingRow = findValueRow_(sheet, payload.studentId);
  if (existingRow !== -1) {
    // 선생님이 일부 칸을 지워서 다시 채우는 경우 -> 기존 행을 덮어씀 (새 행 추가 안 함)
    sheet.getRange(existingRow, 1, 1, 7).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  // 최종 제출이 완료되면 임시저장 행은 더 이상 필요 없으므로 삭제
  var draftSheet = getDraftSheet_();
  var draftRow = findDraftRow_(draftSheet, payload.studentId);
  if (draftRow !== -1) draftSheet.deleteRow(draftRow);

  return { success: true };
}
