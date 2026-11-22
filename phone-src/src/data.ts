import type { Msg, PhoneData } from "./store";

/*
  괄호 밖 · NPC의 폰 기본 예시: NPC (회사원, 마케팅팀) / 상대: PC (입사 동기, 개발팀)
  · 모든 내용은 예시. OOC로 채우면 전부 그 NPC의 설정으로 바뀐다.
  · 사진 · 소리 파일은 넣지 않는다.
*/

/** 기본 콘텐츠를 고치면 이 숫자를 올리세요 → 방문자 브라우저의 예전 저장본이 새 내용으로 바뀝니다 */
export const DATA_VERSION = 105;

let n = 0;
const id = () => `d${(n++).toString(36)}`;
const me = (text: string, x: Partial<Msg> = {}): Msg => ({ id: id(), from: "me", text, ...x });
const th = (text: string, x: Partial<Msg> = {}): Msg => ({ id: id(), from: "them", text, ...x });
const g = (who: string, text: string): Msg => ({ id: id(), from: "them", who, text });
const day = (text: string): Msg => ({ id: id(), from: "system", kind: "date", text });

export const EX_OWNER = "NPC";
export function defaultData(): PhoneData {
  n = 0;
  return {
    owner: "NPC",
    deviceName: "NPC의 iPhone",
    passcode: "0314",
    passcodeHint: "입사한 날",
    decoyCode: "",
    vault: { code: "", notes: [] },
    carrier: "KT",
    battery: 41,
    weather: { city: "서울", temp: 7, cond: "비", hi: 10, lo: 4 },
    allowSend: true,
    quickWords: ["네", "괜찮아요", "확인했어요"],
    autoLockSec: 0,
    events: {
      incomingCall: { enabled: false, afterSec: 60, name: "", lines: [] },
      banner: { enabled: false, afterSec: 30, app: "kakao", title: "", text: "" },
      lowBattery: { enabled: false, afterSec: 150 },
      watcher: { enabled: false, afterSec: 300 },
    },
    lockNotifs: [
      { app: "kakao", title: "PC", text: "오늘 비 온대요 우산 챙겨요", when: "지금" },
      { app: "kakao", title: "마케팅팀", text: "김 대리: 오늘 회의 몇 시예요?", when: "8분 전" },
      { app: "messages", title: "[Web발신]", text: "주문하신 상품이 배송 완료되었습니다", when: "1시간 전" },
    ],

    /* ───────── 대화방 ───────── */
    threads: [
      {
        id: "k_pc", app: "kakao", name: "PC", unread: 1, pinned: true, last: "오전 7:12",
        messages: [
          day("11월 12일 수요일"),
          th("점심 뭐 먹었어요?"),
          th("저 오늘 또 편의점"),
          me("김치찌개요"),
          me("회사 앞에 새로 생긴 데"),
          th("거기 맛있어요?"),
          th("같이 가요 다음에"),
          me("다음 주에 가요"),
          th("네 좋아요"),
          day("11월 13일 목요일"),
          th("내일 저녁 7시 맞죠?"),
          th("제가 예약해 둘게요"),
          me("시간 되면요"),
          th("시간 되잖아요 금요일은 칼퇴"),
          me("그걸 왜 알아요"),
          th("옆 팀이라 다 보여요"),
          { id: id(), from: "them", text: "식당 메뉴판", kind: "photo" },
          me("여기 비싸 보이는데"),
          { id: id(), from: "me", text: "", kind: "deleted" },
          th("방금 뭐 지웠어요?"),
          me("오타요"),
          day("11월 14일 금요일"),
          th("오늘 비 온대요 우산 챙겨요"),
        ],
      },
      {
        id: "k_team", app: "kakao", name: "마케팅팀", unread: 3, last: "오전 7:04", members: 4, notice: "이번 주 주간 회의: 금요일 오전 10시 3층 회의실",
        messages: [
          day("11월 13일 목요일"),
          g("김 대리", "내일 회의 자료 누가 정리해요?"),
          g("이 주임", "NPC 씨가 하기로 했어요"),
          me("오늘 저녁까지 올려 둘게요"),
          g("김 대리", "NPC 씨 금요일 저녁 회식 올 수 있어요?"),
          me("금요일은 제가 약속이 있어서요"),
          g("김 대리", "오 약속ㅋㅋ"),
          g("이 주임", "오 약속ㅋㅋㅋ"),
          g("김 대리", "개발팀 그분?"),
          day("11월 14일 금요일"),
          g("김 대리", "오늘 회의 몇 시예요?"),
          g("이 주임", "10시요 공지 보세요"),
          g("김 대리", "아 맞다"),
        ],
      },
      {
        id: "k_self", app: "kakao", name: "나와의 채팅", unread: 0, last: "어제",
        messages: [
          day("11월 13일 목요일"),
          me("금요일 저녁 7시 회사 앞"),
          me("회의 자료 오늘 안에 올리기"),
          me("우산 챙길 것"),
        ],
      },
      {
        id: "m_bank", app: "messages", name: "[Web발신] 카드", unread: 0, sms: true, last: "어제",
        messages: [day("11월 13일 목요일"), th("[Web발신] 체크카드 승인 12,000원 회사 앞 김치찌개")],
      },
      {
        id: "m_friend", app: "messages", name: "대학 친구", unread: 0, last: "화요일",
        messages: [
          day("11월 11일 화요일"),
          th("이번 주 토요일 영화 볼래?"),
          me("토요일은 일정 있어"),
          th("요즘 주말마다 일정이 있네?"),
          th("누구야"),
          me("그런 거 아니야"),
          th("그런 거구나"),
        ],
      },
      {
        id: "m_parcel", app: "messages", name: "택배", unread: 0, sms: true, last: "월요일",
        messages: [day("11월 10일 월요일"), th("[Web발신] 고객님의 상품(장우산)이 배송 완료되었습니다. 문 앞")],
      },
      {
        id: "ig_pc", app: "insta", name: "pc.daily", unread: 0, last: "1일",
        messages: [
          day("11월 13일 목요일"),
          th("스토리 봤어요?"),
          me("무슨 스토리요"),
          th("방금 본 거 다 떠요 NPC 씨 ㅋㅋ"),
        ],
      },
    ],

    calls: [
      { id: id(), name: "PC", kind: "in", label: "휴대전화", when: "어제", lines: ["NPC 씨 퇴근했어요?", "아니 그냥, 비 와서.", "우산 있어요? 없으면 1층에서 기다릴게요."] },
      { id: id(), name: "PC", kind: "missed", label: "휴대전화", count: 2, when: "화요일", lines: [] },
      { id: id(), name: "회사 대표번호", kind: "out", label: "직장", when: "화요일", lines: ["네, 총무팀입니다.", "아 NPC 씨, 회의실 예약은 메일로 보내 주세요."] },
      { id: id(), name: "대학 친구", kind: "in", label: "휴대전화", when: "월요일", lines: ["너 요즘 연락이 왜 이렇게 늦어.", "밥 한번 먹자. 이번엔 진짜로."] },
      { id: id(), name: "02-***-1124", kind: "missed", label: "발신자 정보 없음", when: "일요일", lines: [] },
    ],
    contacts: [
      { id: id(), name: "PC", phone: "010-****-0314", label: "휴대전화", fav: true, note: "개발팀 · 입사 동기" },
      { id: id(), name: "김 대리", phone: "010-****-2207", label: "휴대전화", note: "마케팅팀" },
      { id: id(), name: "이 주임", phone: "010-****-5512", label: "휴대전화", note: "마케팅팀" },
      { id: id(), name: "대학 친구", phone: "010-****-8890", label: "휴대전화", fav: true },
      { id: id(), name: "회사 대표번호", phone: "02-***-3100", label: "직장" },
      { id: id(), name: "엄마", phone: "010-****-1004", label: "휴대전화", fav: true },
      { id: id(), name: "집주인", phone: "010-****-7781", label: "휴대전화" },
      { id: id(), name: "세탁소", phone: "02-***-5527", label: "직장" },
    ],
    notes: [
      { id: id(), folder: "메모", title: "할 일", body: "할 일\n[ ] 주간 회의 자료 정리\n[x] 회의실 예약\n[ ] 금요일 6시 퇴근", pinned: true, when: "어제" },
      { id: id(), folder: "메모", title: "금요일 저녁", body: "금요일 저녁\n6시 퇴근 → 7시 회사 앞\n우산 챙기기\n너무 차려입으면 티 나니까 평소처럼", when: "어제" },
      { id: id(), folder: "메모", title: "선물 후보", body: "선물 후보\n- 텀블러 (회사에서 맨날 종이컵 씀)\n- 목도리\n(생일 12월 3일)", when: "목요일" },
      { id: id(), folder: "메모", title: "하지 말 것", body: "하지 말 것\n- 먼저 연락하기\n- 답장 바로 하기\n- 개발팀 층 괜히 지나가기", when: "월요일" },
    ],
    calendar: [
      { id: id(), days: [5], time: "19:00", title: "저녁 약속", place: "", color: "#FF3B30" },
      { id: id(), days: [5], time: "10:00", title: "주간 회의", color: "#007AFF" },
      { id: id(), days: [3], time: "", title: "보고서 마감", color: "#8E8E93" },
      { id: id(), days: [6], time: "14:00", title: "영화", color: "#34C759" },
    ],
    dday: { title: "입사한 날", date: "2026-03-14" },
    bank: {
      name: "입출금 통장",
      account: "기업 ***-******-**-014",
      balance: 1284300,
      txs: [
        { id: id(), when: "어제", name: "회사 앞 김치찌개", amount: -12000, memo: "점심" },
        { id: id(), when: "어제", name: "편의점", amount: -3200, memo: "커피" },
        { id: id(), when: "11. 12.", name: "PC", amount: 4500, memo: "커피값" },
        { id: id(), when: "11. 10.", name: "급여", amount: 2410000, memo: "회사" },
        { id: id(), when: "11. 10.", name: "월세", amount: -550000, memo: "자동이체" },
        { id: id(), when: "11. 07.", name: "온라인 쇼핑", amount: -25000, memo: "장우산" },
        { id: id(), when: "11. 05.", name: "서점", amount: -18000, memo: "책" },
      ],
    },
    songs: [
      { id: id(), title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", url: "", hue: 260 },
      { id: id(), title: "Ivy", artist: "Frank Ocean", album: "Blonde", url: "", hue: 120 },
      { id: id(), title: "Everybody Wants To Rule The World", artist: "Tears for Fears", album: "Songs from the Big Chair", url: "", hue: 40 },
      { id: id(), title: "Dreams", artist: "Fleetwood Mac", album: "Rumours", url: "", hue: 20 },
      { id: id(), title: "Electric Feel", artist: "MGMT", album: "Oracular Spectacular", url: "", hue: 210 },
    ],
    home: {
      grid: ["kakao", "insta", "photos", "calendar", "notes", "bank", "maps", "weather", "camera", "settings", "health", "youtube", "folder:유틸리티", "folder:생활"],
      dock: ["phone", "messages", "safari", "music"],
      folders: { 유틸리티: ["contacts", "clock", "calculator", "voicememos"], 생활: ["mail", "reminders", "wallet", "coupang", "baemin", "kakaot", "netflix", "x"] },
    },
    customApps: [],
    mail: [
      { id: id(), from: "총무팀", addr: "noreply@company.example", subject: "11월 회의실 예약 안내", body: "11월 회의실 예약 현황을 첨부합니다.\n변경은 하루 전까지 메일로 요청 바랍니다.", when: "어제", unread: false, box: "inbox" },
      { id: id(), from: "식당 예약", addr: "booking@table.example", subject: "[예약 완료] 11/14(금) 19:00 2인", body: "예약이 완료되었습니다.\n예약자: PC\n인원: 2명", when: "11. 13.", unread: false, box: "inbox" },
    ],
    reminders: [
      { id: id(), text: "회의실 예약하기", note: "3층", due: "오늘", done: true, list: "미리 알림" },
      { id: id(), text: "우산 챙기기", note: "", due: "오늘 18:00", done: false, list: "미리 알림", flag: true },
      { id: id(), text: "회의 자료 올리기", note: "주간 회의", due: "이번 주", done: false, list: "미리 알림" },
    ],
    wallet: [
      { id: id(), name: "체크카드", sub: "입출금 통장 연결", number: "•••• 0314", color: "#1C3D5A" },
      { id: id(), name: "사원증", sub: "마케팅팀", number: "사번 2207", color: "#5B6B3A" },
    ],
    youtube: {
      feed: [
        { id: id(), title: "퇴근 후 10분 스트레칭", channel: "홈트 채널", views: "조회수 12만회", when: "2일 전", duration: "10:12", hue: 20, photo: "", progress: 0 },
        { id: id(), title: "회사 근처 맛집 브이로그", channel: "직장인 일상", views: "조회수 8.1만회", when: "1년 전", duration: "9:12", hue: 200, photo: "", progress: 0 },
      ],
      history: [
        { id: id(), title: "첫 데이트 옷 고르는 법", channel: "스타일 노트", views: "조회수 41만회", when: "3년 전", duration: "12:30", hue: 30, photo: "", progress: 0.6 },
        { id: id(), title: "퇴근 후 10분 스트레칭", channel: "홈트 채널", views: "조회수 12만회", when: "2일 전", duration: "10:12", hue: 20, photo: "", progress: 1 },
      ],
      searches: ["회사 근처 맛집", "남자 목도리 선물", "비 오는 날 데이트"],
    },
    netflix: { profile: "NPC", watching: [], myList: [] },
    x: { name: "퇴근하고싶다", handle: "@npc_0314", feed: [] },
    coupang: [
      { id: id(), name: "자동 장우산", option: "검정 · 1개", price: "25,000원", when: "2026. 11. 08", status: "배송완료", photo: "" },
    ],
    baemin: [],
    kakaot: [],
    homeVer: 2,
    photos: [],
    ig: {
      me: { handle: "npc.daily", name: "NPC", bio: "", posts: 3, followers: 41, following: 88, private: true },
      users: [
        { handle: "pc.daily", name: "PC", bio: "", posts: 64, followers: 310, following: 201 },
      ],
      feed: [
        { id: id(), user: "pc.daily", caption: "금요일만 기다림", photo: "", likes: 31, comments: 4, when: "어제" },
      ],
      stories: ["pc.daily"],
      storyItems: [
        { id: id(), user: "pc.daily", text: "내일 저녁\n예약 완료", bg: "linear-gradient(160deg,#2a1d12,#0e0a06)", when: "2시간" },
      ],
      notes: [{ user: "pc.daily", text: "금요일 7시" }],
    },
    safari: {
      favorites: [
        { title: "Google", url: "google.com" },
        { title: "NAVER", url: "m.naver.com" },
        { title: "YouTube", url: "m.youtube.com" },
        { title: "나무위키", url: "namu.wiki" },
      ],
      history: ["회사 근처 파스타 맛집", "비 오는 날 데이트 옷", "남자 목도리 선물", "동기랑 사귀면", "첫 저녁 약속 대화 주제"],
      tabs: [
        {
          id: id(), title: "회사 근처 파스타 맛집", url: "m.search.naver.com",
          page: { type: "search", engine: "naver", query: "회사 근처 파스타 맛집", results: [
            { title: "분위기 좋은 파스타집 추천", url: "blog.example.com", desc: "창가 자리가 예쁘고 예약하면 조용한 자리로 줘요." },
            { title: "[후기] 금요일 저녁에 갔어요", url: "blog.example.com", desc: "두 명이면 3만 원대. 비 오는 날 가기 좋아요." },
          ] },
        },
        {
          id: id(), title: "동기랑 사귀면 어때요", url: "kin.example.com",
          page: { type: "qna", question: "회사 동기랑 사귀면 어떤가요?", detail: "옆 팀 동기예요. 그냥 친한 동기. 밥 먹자고 한 게 무슨 뜻일까요?", asker: "비공개", when: "어제", views: 42, answers: [{ who: "직장인", text: "그냥 친한 동기는 이런 질문 안 해요." }] },
        },
      ],
    },
    alarms: [
      { id: id(), time: "06:50", label: "출근", on: true },
      { id: id(), time: "18:00", label: "퇴근", on: true },
      { id: id(), time: "21:58", label: "답장해도 됨", on: false },
    ],
    places: [
      { id: id(), name: "회사", note: "", x: 0.4, y: 0.42 },
      { id: id(), name: "파스타집", note: "7시 예약", x: 0.66, y: 0.3 },
      { id: id(), name: "회사 앞 김치찌개", note: "", x: 0.3, y: 0.68 },
    ],
    kakaoProfile: { name: "NPC", status: "금요일만 기다림" },
    wallpaper: { style: "mesh", colors: ["#6f8296", "#2f3b4a", "#141a22"], desc: "비 오는 날 사무실 창문 사진" },
    sounds: { muted: true },
    triggers: [],
    later: [],
    jobs: [],
    screenTime: {
      total: "3시간 12분",
      hours: [6, 2, 0, 0, 0, 0, 4, 12, 9, 3, 2, 6, 14, 5, 3, 2, 4, 8, 10, 6, 9, 18, 26, 31],
      apps: [["카카오톡", "1시간 4분"], ["YouTube", "42분"], ["Instagram", "33분"], ["메모", "18분"], ["Safari", "15분"]],
      pickups: 96,
      firstPickup: "오전 6:51",
    },
    voiceMemos: [
      { id: id(), title: "회의 메모", when: "어제", lines: ["주간 회의 안건 세 개.", "신제품 홍보 일정, 예산, 다음 달 행사.", "자료는 금요일 아침까지."] },
    ],
    health: { move: 320, moveGoal: 400, exercise: 18, stand: 9, km: 6.4, sleep: "5시간 40분", heart: [62, 60, 58, 61, 64, 70, 74, 72, 78, 76, 80, 118, 96, 84, 76, 70], peakAt: "오후 7:02" },
    cashwalk: { steps: 8412, cash: 1204, todayWon: 8, streak: 41, bubbles: 8, badges: [], friends: [{ name: "김 대리", steps: 6120 }, { name: "이 주임", steps: 3204 }], quiz: { q: "오늘의 퀴즈: 하루 만 보를 걸으면 대략 몇 kcal를 쓸까요?", options: ["300kcal", "1,000kcal", "50kcal"], answer: 0 }, shop: [{ name: "아메리카노 교환권", price: 4100 }], history: [] },

    /* ───────── 하루 재생 ───────── */
    dayInfo: { title: "저녁 약속이 있는 금요일", date: "11월 14일 금요일", owner: "NPC", pc: "PC", summary: "하루 종일 아무렇지 않은 척하지만, PC의 방에서만 입력창을 몇 번씩 고친다. 답장을 늦추는 알람까지 만들어 둔 사람." },
    day: [
      { t: "06:50", act: "lock", say: "알람을 끄고 잠금화면부터 확인한다.", inner: "PC 씨 카톡은 일부러 안 누른다." },
      { t: "06:51", act: "unlock", say: "잠금을 푼다." },
      { t: "06:52", act: "open", app: "weather", say: "날씨를 본다. 오늘 비 소식이 있다.", inner: "우산 챙기라는 말, 진짜였네." },
      {
        t: "07:12", act: "open", app: "kakao", thread: "PC", say: "PC의 카톡에 답장을 쓴다.",
        inner: "고맙다고 하면 너무 기다린 것 같다.",
        scene: [
          { kind: "wait", sec: 0.8 },
          { kind: "type", text: "고마워요 챙길게요" },
          { kind: "send" },
          { kind: "wait", sec: 1.6 },
          { kind: "unsend" },
          { kind: "wait", sec: 0.8 },
          { kind: "type", text: "네" },
          { kind: "send" },
          { kind: "msg", from: "them", text: "방금 뭐 지웠어요?", sec: 1.4 },
          { kind: "msg", from: "them", text: "네 하나에 3분 걸리네", sec: 1.2 },
        ],
      },
      { t: "07:20", act: "open", app: "kakao", thread: "마케팅팀", say: "팀 단체방을 훑어본다." },
      { t: "09:40", act: "open", app: "notes", note: "할 일", say: "메모 앱에서 할 일을 확인한다.", inner: "오늘은 6시에 나가야 한다." },
      { t: "12:30", act: "open", app: "insta", say: "점심시간에 인스타 스토리를 넘긴다.", inner: "예약 완료라니. 진짜 했네." },
      { t: "12:34", act: "open", app: "safari", tab: 0, say: "예약한 식당을 검색해 본다." },
      { t: "15:10", act: "banner", banner: { app: "kakao", title: "PC", text: "저 6시 10분에 1층 내려갈게요" }, say: "일하는 중에 알림이 뜬다." },
      { t: "15:11", act: "open", app: "safari", tab: 1, say: "어제 써 둔 질문에 답이 달렸는지 본다.", inner: "그냥 친한 동기는 이런 질문 안 한다. 알아요." },
      { t: "18:02", act: "open", app: "reminders", say: "'우산 챙기기'에 체크한다." },
      { t: "18:05", act: "call", call: { name: "PC", lines: [], talk: [{ who: "them", text: "NPC 씨 퇴근했어요?" }, { who: "me", text: "이제 나가요. 왜요?" }, { who: "them", text: "아니 그냥, 비 오니까." }, { who: "me", text: "우산 있어요." }, { who: "them", text: "그럼 1층에서 기다릴게요. 같이 써요." }, { who: "me", text: "…5분만요." }] }, say: "퇴근길에 PC에게서 전화가 온다." },
      { t: "21:58", act: "open", app: "clock", say: "'답장해도 됨' 알람을 켜 둔다.", inner: "헤어지고 바로 연락하면 이상하니까." },
      {
        t: "22:30", act: "open", app: "kakao", thread: "PC", say: "집에 와서 다시 PC의 방을 연다.",
        inner: "오늘 계산은 왜 몰래 했는지 묻고 싶다.",
        scene: [
          { kind: "msg", from: "them", text: "오늘 와 줘서 고마워요", sec: 1.2 },
          { kind: "wait", sec: 1 },
          { kind: "type", text: "계산 왜 몰래 했어요?" },
          { kind: "wait", sec: 1.6 },
          { kind: "type", text: "잘 들어갔어요? 오늘 맛있었어요" },
          { kind: "send" },
          { kind: "msg", from: "them", text: "다음엔 NPC 씨가 사요", sec: 1.4 },
          { kind: "photo", from: "them", text: "창가 자리에서 찍은 파스타", sec: 1.2 },
          { kind: "react", tap: "heart", from: "me", sec: 1 },
        ],
      },
      {
        t: "23:05", act: "open", app: "messages", thread: "대학 친구", say: "친구에게서 문자가 와 있다.",
        inner: "얘는 늘 모르는 척 다 안다.",
        scene: [
          { kind: "typing", sec: 2.2 },
          { kind: "msg", from: "them", text: "오늘 저녁 어땠어?", sec: 1 },
          { kind: "typing", sec: 1.6 },
          { kind: "msg", from: "them", text: "누구랑 먹었는지는 안 물을게", sec: 1.2 },
          { kind: "type", text: "회사 사람이랑" },
          { kind: "wait", sec: 1.2 },
          { kind: "type", text: "좋았어" },
          { kind: "send" },
          { kind: "react", tap: "haha", from: "them", sec: 1.2 },
        ],
      },
      { t: "23:40", act: "end", say: "화면을 끄고 폰을 가슴 위에 엎어 둔다.", inner: "답장 알람은 결국 필요 없었다." },
    ],
  };
}

/** 빈 폰 (OOC로 채우기 전): 기능 · 모양은 그대로, 내용만 비움 */
export function blankData(): PhoneData {
  const d = defaultData();
  d.owner = "";
  d.deviceName = "iPhone";
  d.passcode = "0000";
  d.passcodeHint = "";
  d.lockNotifs = [];
  d.threads = [];
  d.calls = [];
  d.contacts = [];
  d.notes = [];
  d.calendar = [];
  d.dday = { title: "", date: "" };
  d.bank = { ...d.bank, balance: 0, txs: [] };
  d.songs = [];
  d.photos = [];
  d.safari = { tabs: [], history: [], favorites: d.safari.favorites };
  d.alarms = [];
  d.places = [];
  d.kakaoProfile = { status: "" };
  d.voiceMemos = [];
  d.mail = [];
  d.reminders = [];
  d.wallet = [];
  d.youtube = { feed: [], history: [], searches: [] };
  d.netflix = { profile: "", watching: [], myList: [] };
  d.x = { name: "", handle: "", feed: [] };
  d.coupang = [];
  d.baemin = [];
  d.kakaot = [];
  d.ig = { me: { handle: "", name: "", bio: "", posts: 0, followers: 0, following: 0, private: true }, users: [], feed: [], stories: [], storyItems: [], notes: [] };
  d.screenTime = { total: "0분", hours: Array(24).fill(0), apps: [], pickups: 0, firstPickup: "" };
  d.cashwalk = { ...d.cashwalk, friends: [], history: [] };
  delete d.day;
  delete d.dayInfo;
  return d;
}
