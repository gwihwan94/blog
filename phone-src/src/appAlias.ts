/* AI가 앱 이름을 조금 다르게 적어도(instaFeed · 인스타 · 문자 · 메모 …) 실제 앱으로 맞춘다. 붙여넣기와 하루 재생이 같이 쓴다. */
import { APPS } from "./apps";
import type { DayStep } from "./store";

export const APP_ALIAS: [RegExp, string][] = [[/insta|인스타|피드|스토리|dm/i, "insta"], [/kakao|카톡|카카오톡/i, "kakao"], [/message|sms|문자|imessage|메시지/i, "messages"], [/note|메모/i, "notes"], [/safari|browser|chrome|naver|google|인터넷|검색|브라우저/i, "safari"], [/photo|gallery|album|사진|앨범|갤러리/i, "photos"], [/camera|카메라/i, "camera"], [/wallet|지갑|pay|페이/i, "wallet"], [/youtube|유튜브/i, "youtube"], [/netflix|넷플/i, "netflix"], [/twitter|^x$|트위터/i, "x"], [/call|phone|전화/i, "phone"], [/music|melon|spotify|음악/i, "music"], [/map|지도/i, "maps"], [/bank|은행|뱅킹|토스/i, "bank"], [/calendar|캘린더|일정/i, "calendar"], [/remind|미리 알림|할 일/i, "reminders"], [/clock|alarm|알람|시계/i, "clock"], [/mail|메일/i, "mail"], [/coupang|쿠팡/i, "coupang"], [/baemin|배민|배달/i, "baemin"], [/kakaot|택시/i, "kakaot"], [/health|건강/i, "health"], [/setting|설정/i, "settings"]];
export function appId(raw?: string): string {
  const a = (raw || "").trim();
  if (!a) return "";
  if (APPS[a]) return a;
  const hit = APP_ALIAS.find(([re]) => re.test(a)); if (hit && APPS[hit[1]]) return hit[1];
  return Object.keys(APPS).find((k) => APPS[k].label === a) || "";
}
export function appOf(s: DayStep): string {
  const a = (s.app || "").trim();
  if (a && APPS[a]) return a;
  if (a) { const hit = APP_ALIAS.find(([re]) => re.test(a)); if (hit && APPS[hit[1]]) return hit[1]; const byLabel = Object.keys(APPS).find((k) => APPS[k].label === a); if (byLabel) return byLabel; }
  if (s.thread) return "kakao";
  if (s.photo) return "camera";
  if (s.note) return "notes";
  return a ? "home" : "home";
}
