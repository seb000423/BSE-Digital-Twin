/**
 * 태그 뜻 (한국어): 신호 표의 "뜻" 칸. 태그 이름의 마지막 조각(접두어 뒤)으로 찾는다.
 * 규약(기준서 4.4절)대로 이름이 곧 뜻이므로 표가 짧다. 모르는 조각이면 '' 를 돌려준다.
 */
const DESC: Record<string, string> = {
  RUN: '운전',
  DIR: '역방향',
  SPEED: '속도 지정 (mm/s)',
  FWD: '전진',
  BWD: '후진',
  FWD_LS: '전진 끝',
  BWD_LS: '후진 끝',
  UP: '올리기',
  DOWN: '내리기',
  UP_LS: '올라감',
  DOWN_LS: '내려감',
  CW: '정회전',
  CCW: '역회전',
  CW_LS: '정회전 끝',
  CCW_LS: '역회전 끝',
  CLAMP: '클램프',
  UNCLAMP: '언클램프',
  CLAMP_LS: '클램프됨',
  UNCLAMP_LS: '풀림',
  OPEN: '열기',
  CLOSE: '닫기',
  OPEN_LS: '열림',
  CLOSE_LS: '닫힘',
  VAC_ON: '흡착',
  VAC_OK: '흡착 확인',
  POS_CMD: '목표 위치',
  POS_FB: '현재 위치',
  INPOS: '위치 도달',
  HOME: '원점 복귀',
  SVON: '서보 켜기',
  ALARM: '이상',
  ON: '검출',
  SAFE: '안전 (검출 없음)',
  START: '시작',
  TRIG: '트리거',
  BUSY: '동작 중',
  DONE: '완료',
  OK: '양품',
  NG: '불량',
  READY: '준비됨',
  RUNNING: '동작 중',
  COUNT: '개수',
  EMPTY: '비어 있음',
  FULL: '가득 참',
  LOW: '부족',
  PRESENT: '있음',
  WORK_PRESENT: '워크 있음',
  PART_READY: '부품 준비',
  PGM_NO: '프로그램 번호',
  ID: '식별 번호',
  RESULT: '판정 결과',
  LOCK: '잠금',
  LOCKED: '잠김',
  DOOR_CLOSED: '문 닫힘',
  DOOR_OPEN: '문 열기',
  DOOR_OPEN_LS: '문 열림',
  DOOR_CLOSE_LS: '문 닫힘',
  PUSH: '밀기',
  PUSH_LS: '밀림 끝',
  BACK_LS: '복귀 끝',
  CHUCK: '척 잠금',
  TORQUE_FB: '토크',
  R: '빨간 등',
  Y: '노란 등',
  G: '초록 등',
  BUZZ: '부저',
  FAULT: '이상',
};

/** 'CV1_RUN' → '운전'. 접두어 뒤의 가장 긴 조각부터 맞춰 본다 (DOOR_OPEN_LS 처럼 밑줄이 든 뜻도 찾는다) */
export function describeTag(tag: string): string {
  const parts = tag.split('_');
  for (let i = 1; i < parts.length; i++) {
    const key = parts.slice(i).join('_');
    const d = DESC[key];
    if (d) return d;
  }
  return '';
}
