// ===== 설정 =====
var SHEET_ID = '1xoVrbYWU1BwfoJwN2e0CBXlDKE4zt_upD4OtqasnV3I'; // 제출 데이터를 쌓을 스프레드시트 ID
var SHEET_NAME = '제출현황';
var LEARNING_SHEET_NAME = '제출현황2'; // learning.html(친구 발표 듣기) 제출 기록
var VALUE_SHEET_NAME = '인과 제출 및 가치관점'; // student_value.html 제출 기록
var DRAFT_SHEET_NAME = '임시저장'; // student_value.html 임시저장(이어쓰기) 기록
var PADLET_SHEET_NAME = 'padlet'; // padlet.html(관점별 게시판) 게시물 기록
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
  } else if (action === 'verifyStudentOnly') {
    result = { valid: verifyStudent_(e.parameter.studentId, e.parameter.studentName) };
  } else if (action === 'getPadletPosts') {
    result = getPadletPosts(e.parameter.studentId);
  } else if (action === 'checkReflectionSubmitted') {
    result = checkReflectionSubmitted(e.parameter.studentId, e.parameter.studentName);
  } else if (action === 'getTeacherRoster') {
    result = getTeacherRoster(e.parameter.password);
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
  } else if (body.action === 'submitPadletPost') {
    result = submitPadletPost(body.payload);
  } else if (body.action === 'editPadletPost') {
    result = editPadletPost(body.payload);
  } else if (body.action === 'togglePadletReaction') {
    result = togglePadletReaction(body.payload);
  } else if (body.action === 'addPadletComment') {
    result = addPadletComment(body.payload);
  } else if (body.action === 'deletePadletComment') {
    result = deletePadletComment(body.payload);
  } else if (body.action === 'submitReflection') {
    result = submitReflection(body.payload);
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

// teacher.html에서 호출: 마스터 비밀번호 확인 후 전체 명단(학번/이름) 반환
function getTeacherRoster(password) {
  if (String(password || '').trim() !== MASTER_PASSWORD) {
    return { valid: false, message: '비밀번호가 일치하지 않습니다.' };
  }
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) return { valid: false, message: '명단 시트를 찾을 수 없습니다.' };

  var data = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues(); // A열: 학번, B열: 이름
  var roster = [];
  for (var i = 0; i < data.length; i++) {
    var id = String(data[i][0] || '').trim();
    var name = String(data[i][1] || '').trim();
    if (id && name) roster.push({ studentId: id, studentName: name });
  }
  return { valid: true, roster: roster };
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
var MASTER_PASSWORD = 'byung0703!'; // 선생님용 마스터 비밀번호 (모든 학생 조회 가능)

function verifyPassword_(studentId, password) {
  if (String(password || '').trim() === MASTER_PASSWORD) return true;

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

  return { valid: true, own: own, learning: learning, valueScore: getValuePerspectiveScore_(studentId) };
}

// "학생별" 탭의 S~AL열(인과사슬/가치/관점/이유 + 점수, 3차시 패들렛 제출 + 점수, 마지막 차시 성찰일지 + 점수)을 읽어서 반환
function getValuePerspectiveScore_(studentId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) return null;

  var data = sheet.getRange(1, 1, sheet.getLastRow(), 38).getValues(); // A~AL열
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(studentId).trim()) {
      var row = data[i];
      return {
        causalChain: row[18] || '',   // S열
        value: row[19] || '',         // T열
        perspective: row[20] || '',   // U열
        reason: row[21] || '',        // V열
        scoreCausal: row[22],         // W열
        scoreReasonImportance: row[23], // X열
        scoreReasonConnection: row[24],  // Y열
        causalAnalysis: row[26] || '',      // AA열: 문제의 인과적 분석
        policyProposal: row[27] || '',      // AB열: 나의 관점에서 정책 제안하기
        questionComments: row[28] || '',    // AC열: 질문형 댓글 (" | "로 textjoin 되어 있음)
        causalAnalysisScore: row[29],        // AD열
        policyProposalScore: row[30],        // AE열
        commentScore: row[31],               // AF열
        reflectionKnowledge: row[32] || '',          // AG열: 알게 된 것
        reflectionPerspectiveChange: row[33] || '',  // AH열: 관점의 변화
        reflectionCommitment: row[34] || '',         // AI열: 실천 다짐
        reflectionKnowledgeScore: row[35],            // AJ열
        reflectionPerspectiveChangeScore: row[36],    // AK열
        reflectionCommitmentScore: row[37]            // AL열
      };
    }
  }
  return null;
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
    // 이미 제출을 완료했어도 내용을 불러와 수정할 수 있게 함 (submitted 플래그로 프론트에서 "수정" 안내만 표시)
    return {
      valid: true,
      submitted: isValueRowComplete_(row),
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
  // 이미 제출했어도 막지 않고 같은 행을 덮어써서 수정할 수 있게 함 (findValueRow_가 기존 행을 찾아 overwrite)

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

// ===================== padlet.html (관점별 게시판) =====================
var PADLET_PERSPECTIVES = ['경제적 관점', '기술적 관점', '윤리적 관점'];

function getPadletSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(PADLET_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PADLET_SHEET_NAME);
    sheet.appendRow(['게시ID', '제출시각', '학번', '이름', '관점', '인과관계설명', '정책', '좋아요수', '궁금해요수', '반응기록JSON', '댓글JSON']);
  }
  return sheet;
}

function safeParseJson_(str, fallback) {
  try {
    if (!str) return fallback;
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

// 게시ID로 행 번호를 찾을 때 ID열(A열)만 읽음 — 댓글/내용이 쌓여 행이 커져도 조회 속도가 느려지지 않게 함
function findPadletRow_(sheet, postId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(postId)) return i + 2; // 1-based, 헤더행(1) 보정
  }
  return -1;
}

// 학번의 2번째 숫자(반)가 '0'이면 운영자(교사) 계정으로 간주 — 모든 반에서 보이고 상단 고정 + 핑크색 표시
function isPadletOperatorId_(id) {
  id = String(id || '');
  return id.length >= 2 && id.charAt(1) === '0';
}
var PADLET_PROFILES_CACHE_KEY = 'padlet_profiles_v1';
var PADLET_PROFILES_CACHE_TTL = 30; // 학생들의 가치/관점은 수업 중 자주 안 바뀌므로 30초 캐시
var PADLET_POSTS_CACHE_KEY = 'padlet_posts_v1';
var PADLET_POSTS_CACHE_TTL = 4; // 폴링 주기(4초)와 맞춰, 같은 순간 여러 학생이 동시에 폴링해도 시트를 한 번만 읽게 함

// "학생별" 탭 T열(선택한 가치)/U열(선택한 관점)을 학번 기준 맵으로 읽어옴 (캐시 적용: 동시 접속자가 많아도 매번 전체 명단을 다시 읽지 않음)
function getStudentProfiles_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(PADLET_PROFILES_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var map = {};
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ROSTER_SHEET_NAME);
  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= 1) {
      var data = sheet.getRange(1, 1, lastRow, 21).getValues(); // A~U열
      for (var i = 0; i < data.length; i++) {
        var id = String(data[i][0]).trim();
        if (!id) continue;
        map[id] = { value: data[i][19] || '', perspective: data[i][20] || '' }; // T열, U열
      }
    }
  }
  try { cache.put(PADLET_PROFILES_CACHE_KEY, JSON.stringify(map), PADLET_PROFILES_CACHE_TTL); } catch (e) {}
  return map;
}

function decoratePadletAuthor_(obj, profiles) {
  var isTeacher = isPadletOperatorId_(obj.studentId);
  var profile = profiles[String(obj.studentId)] || {};
  obj.isTeacher = isTeacher;
  obj.authorValue = isTeacher ? '' : (profile.value || '');
  obj.authorPerspective = isTeacher ? '' : (profile.perspective || '');
  return obj;
}

// 게시물을 새로 쓰거나/반응·댓글이 바뀔 때 호출 — 캐시된 게시물 목록을 무효화해서 다음 조회 때 바로 최신 내용이 보이게 함
function clearPadletPostsCache_() {
  try { CacheService.getScriptCache().remove(PADLET_POSTS_CACHE_KEY); } catch (e) {}
}

// 시트에서 게시물 전체를 읽어 가공 (반응 원본 정보(reactions)는 studentId별 myReaction을 계산하기 위해 잠시 남겨둠)
function buildPadletPostsRaw_() {
  var sheet = getPadletSheet_();
  var data = sheet.getDataRange().getValues();
  var profiles = getStudentProfiles_();
  var posts = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var comments = safeParseJson_(row[10], []).map(function (c) {
      return decoratePadletAuthor_(c, profiles);
    });
    posts.push(decoratePadletAuthor_({
      id: row[0],
      timestamp: Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
      studentId: row[2],
      studentName: row[3],
      perspective: row[4],
      causal: row[5],
      policy: row[6],
      likeCount: Number(row[7]) || 0,
      curiousCount: Number(row[8]) || 0,
      reactions: safeParseJson_(row[9], {}),
      comments: comments
    }, profiles));
  }
  posts.sort(function (a, b) {
    if (a.isTeacher !== b.isTeacher) return a.isTeacher ? -1 : 1; // 교사 게시물 상단 고정
    return a.id < b.id ? 1 : -1; // 그 외엔 최신 게시물이 위로
  });
  return posts;
}

// 위 결과를 짧게 캐시 — 같은 4초 폴링 구간에 여러 학생이 동시에 요청해도 시트는 한 번만 읽음
// (게시물·댓글이 아무리 쌓여도, 동시 접속 인원이 늘어도 매 요청마다 전체를 다시 읽는 비용이 커지지 않도록 하는 핵심 최적화)
function getPadletPostsRaw_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(PADLET_POSTS_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  var posts = buildPadletPostsRaw_();
  try {
    cache.put(PADLET_POSTS_CACHE_KEY, JSON.stringify(posts), PADLET_POSTS_CACHE_TTL);
  } catch (e) {
    // 게시물/댓글이 매우 많아져 캐시 용량(100KB)을 넘으면 캐시 없이 매번 새로 읽음 (정확성에는 영향 없음)
  }
  return posts;
}

// 클라이언트(padlet.html)에서 호출: 전체 게시물 + (있다면) 내 반응 상태 포함해 반환
function getPadletPosts(studentId) {
  var raw = getPadletPostsRaw_();
  var posts = raw.map(function (p) {
    var copy = {};
    for (var k in p) { if (k !== 'reactions') copy[k] = p[k]; }
    copy.myReaction = (studentId && p.reactions && p.reactions[studentId]) ? p.reactions[studentId] : null;
    return copy;
  });
  return { valid: true, posts: posts };
}

// 게시물 등록
function submitPadletPost(payload) {
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }
  if (PADLET_PERSPECTIVES.indexOf(payload.perspective) === -1) {
    return { success: false, message: '관점을 올바르게 선택해주세요.' };
  }
  if (!payload.causal || payload.causal.trim().length < 10) {
    return { success: false, message: '인과관계 설명을 좀 더 구체적으로 작성해주세요. (10자 이상)' };
  }
  if (!payload.policy || payload.policy.trim().length < 10) {
    return { success: false, message: '정책 제안을 좀 더 구체적으로 작성해주세요. (10자 이상)' };
  }

  var sheet = getPadletSheet_();
  var id = 'P' + new Date().getTime() + Math.floor(Math.random() * 1000);
  sheet.appendRow([
    id, new Date(), payload.studentId, payload.studentName,
    payload.perspective, payload.causal.trim(), payload.policy.trim(),
    0, 0, '{}', '[]'
  ]);
  clearPadletPostsCache_();
  return { success: true, id: id };
}

// 게시물 수정 — 본인이 작성한 게시물만 가능 (관점/열은 그대로 두고 내용만 수정)
function editPadletPost(payload) {
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }
  if (!payload.causal || payload.causal.trim().length < 10) {
    return { success: false, message: '인과관계 설명을 좀 더 구체적으로 작성해주세요. (10자 이상)' };
  }
  if (!payload.policy || payload.policy.trim().length < 10) {
    return { success: false, message: '정책 제안을 좀 더 구체적으로 작성해주세요. (10자 이상)' };
  }

  var sheet = getPadletSheet_();
  var rowNum = findPadletRow_(sheet, payload.postId);
  if (rowNum === -1) return { success: false, message: '게시물을 찾을 수 없습니다.' };

  var ownerId = sheet.getRange(rowNum, 3).getValue();
  if (String(ownerId) !== String(payload.studentId)) {
    return { success: false, message: '본인이 작성한 게시물만 수정할 수 있습니다.' };
  }

  sheet.getRange(rowNum, 6, 1, 2).setValues([[payload.causal.trim(), payload.policy.trim()]]);
  clearPadletPostsCache_();
  return { success: true };
}

// 반응(좋아요/궁금해요) 토글 — 학생 1명당 게시물 1개에 반응 1개만 가능, 같은 반응 다시 누르면 취소
function togglePadletReaction(payload) {
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }
  if (['like', 'curious'].indexOf(payload.type) === -1) {
    return { success: false, message: '잘못된 반응 종류입니다.' };
  }

  var sheet = getPadletSheet_();
  var rowNum = findPadletRow_(sheet, payload.postId);
  if (rowNum === -1) return { success: false, message: '게시물을 찾을 수 없습니다.' };

  var row = sheet.getRange(rowNum, 8, 1, 3).getValues()[0]; // 좋아요수/궁금해요수/반응기록만 읽음 (댓글·본문 텍스트는 안 읽어서 가벼움)
  var likeCount = Number(row[0]) || 0;
  var curiousCount = Number(row[1]) || 0;
  var reactions = safeParseJson_(row[2], {});

  var prev = reactions[payload.studentId];
  if (prev === payload.type) {
    delete reactions[payload.studentId];
    if (payload.type === 'like') likeCount--; else curiousCount--;
  } else {
    if (prev === 'like') likeCount--;
    if (prev === 'curious') curiousCount--;
    reactions[payload.studentId] = payload.type;
    if (payload.type === 'like') likeCount++; else curiousCount++;
  }
  likeCount = Math.max(0, likeCount);
  curiousCount = Math.max(0, curiousCount);

  sheet.getRange(rowNum, 8, 1, 3).setValues([[likeCount, curiousCount, JSON.stringify(reactions)]]);
  clearPadletPostsCache_();

  return {
    success: true,
    likeCount: likeCount,
    curiousCount: curiousCount,
    myReaction: reactions[payload.studentId] || null
  };
}

// padlet 댓글 집계 탭: 학생별로 댓글을 모아서 선생님이 점수 매기기 쉽게 만든 탭
var PADLET_COMMENT_SHEET_NAME = 'padlet 댓글';

function getPadletCommentSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(PADLET_COMMENT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PADLET_COMMENT_SHEET_NAME);
    sheet.appendRow(['작성시각', '학번', '이름', '게시ID', '댓글ID', '부모댓글ID', '구분', '댓글내용']);
  }
  return sheet;
}

function appendPadletCommentRow_(postId, comment) {
  var sheet = getPadletCommentSheet_();
  sheet.appendRow([
    comment.time, comment.studentId, comment.studentName, postId,
    comment.id, comment.parentId || '', comment.parentId ? '대댓글' : '댓글', comment.text
  ]);
}

// commentId(및 그 답글들)에 해당하는 행을 'padlet 댓글' 탭에서 삭제
function removePadletCommentRows_(commentIds) {
  var sheet = getPadletCommentSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (commentIds.indexOf(String(data[i][4])) !== -1) sheet.deleteRow(i + 1);
  }
}

// 댓글/대댓글 추가 (질문형 댓글 — 의미있는 댓글 2개 이상 작성 시 선생님이 점수 부여, 댓글마다 학번이 저장되어 'padlet 댓글' 탭에서 집계 가능)
function addPadletComment(payload) {
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }
  if (!payload.text || payload.text.trim().length < 2) {
    return { success: false, message: '댓글 내용을 입력해주세요.' };
  }

  var sheet = getPadletSheet_();
  var rowNum = findPadletRow_(sheet, payload.postId);
  if (rowNum === -1) return { success: false, message: '게시물을 찾을 수 없습니다.' };

  var comments = safeParseJson_(sheet.getRange(rowNum, 11).getValue(), []);
  var comment = {
    id: 'C' + new Date().getTime() + Math.floor(Math.random() * 1000),
    parentId: payload.parentId || null,
    studentId: payload.studentId,
    studentName: payload.studentName,
    text: payload.text.trim(),
    time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  };
  comments.push(comment);
  sheet.getRange(rowNum, 11).setValue(JSON.stringify(comments));
  appendPadletCommentRow_(payload.postId, comment);
  clearPadletPostsCache_();

  return { success: true, comments: comments };
}

// 본인이 작성한 댓글/대댓글 삭제 (대댓글이 달린 댓글을 지우면 대댓글도 함께 삭제)
function deletePadletComment(payload) {
  if (!verifyStudent_(payload.studentId, payload.studentName)) {
    return { success: false, message: '학번 또는 이름이 명단과 일치하지 않습니다.' };
  }

  var sheet = getPadletSheet_();
  var rowNum = findPadletRow_(sheet, payload.postId);
  if (rowNum === -1) return { success: false, message: '게시물을 찾을 수 없습니다.' };

  var comments = safeParseJson_(sheet.getRange(rowNum, 11).getValue(), []);
  var target = null;
  for (var i = 0; i < comments.length; i++) {
    if (comments[i].id === payload.commentId) { target = comments[i]; break; }
  }
  if (!target) return { success: false, message: '댓글을 찾을 수 없습니다.' };
  if (String(target.studentId) !== String(payload.studentId)) {
    return { success: false, message: '본인이 작성한 댓글만 삭제할 수 있습니다.' };
  }

  var removedIds = [payload.commentId];
  comments = comments.filter(function (c) {
    if (c.id === payload.commentId) return false;
    if (c.parentId === payload.commentId) { removedIds.push(c.id); return false; }
    return true;
  });

  sheet.getRange(rowNum, 11).setValue(JSON.stringify(comments));
  removePadletCommentRows_(removedIds);
  clearPadletPostsCache_();

  return { success: true, comments: comments };
}

// ===================== last.html (마지막 차시 성찰일지) =====================
var REFLECTION_SHEET_NAME = '성찰일지';

function getReflectionSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REFLECTION_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REFLECTION_SHEET_NAME);
    sheet.appendRow(['제출시각', '학번', '이름', '알게 된 것', '관점의 변화', '실천 다짐']);
  }
  return sheet;
}

function findReflectionRow_(sheet, studentId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId)) return i + 1; // 1-based
  }
  return -1;
}

// 클라이언트(last.html)에서 호출: 본인 확인 + 이미 제출했어도 내용을 불러와 수정할 수 있게 draft로 함께 반환
function checkReflectionSubmitted(studentId, studentName) {
  if (!verifyStudent_(studentId, studentName)) {
    return { valid: false, message: '학번 또는 이름이 명단과 일치하지 않습니다. 다시 확인해주세요.' };
  }

  var sheet = getReflectionSheet_();
  var rowNum = findReflectionRow_(sheet, studentId);
  if (rowNum === -1) return { valid: true, submitted: false };

  var row = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];
  var complete = String(row[3] || '').trim() !== '' && String(row[4] || '').trim() !== '' && String(row[5] || '').trim() !== '';
  return {
    valid: true,
    submitted: complete,
    draft: {
      knowledge: row[3] || '',
      perspectiveChange: row[4] || '',
      commitment: row[5] || ''
    }
  };
}

// last.html 전체 제출 (이미 제출했어도 같은 행을 덮어써서 수정 가능)
function submitReflection(payload) {
  var already = checkReflectionSubmitted(payload.studentId, payload.studentName);
  if (!already.valid) {
    return { success: false, message: already.message };
  }

  if (!payload.knowledge || payload.knowledge.trim().length < 5) {
    return { success: false, message: '1) 프로젝트를 통해 알게 된 것을 작성해주세요.' };
  }
  if (!payload.perspectiveChange || payload.perspectiveChange.trim().length < 5) {
    return { success: false, message: '2) 관점의 변화(또는 유지)에 대한 성찰을 작성해주세요.' };
  }
  if (!payload.commitment || payload.commitment.trim().length < 5) {
    return { success: false, message: '3) 기후 시민으로서의 실천 다짐을 작성해주세요.' };
  }

  var sheet = getReflectionSheet_();
  var rowValues = [
    new Date(), payload.studentId, payload.studentName,
    payload.knowledge.trim(), payload.perspectiveChange.trim(), payload.commitment.trim()
  ];

  var existingRow = findReflectionRow_(sheet, payload.studentId);
  if (existingRow !== -1) {
    sheet.getRange(existingRow, 1, 1, 6).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { success: true };
}
