import type { Msg, PhoneData } from "./store";

/*
  괄호 밖 · NPC의 폰 기본 예시: NPC (구립도서관 사서, NPC) / 상대: PC (밴드 드러머, PC)
  · 모든 내용은 예시. OOC로 채우면 전부 그 NPC의 설정으로 바뀐다.
  · 사진 · 소리 파일은 넣지 않는다.
*/

/** 기본 콘텐츠를 고치면 이 숫자를 올리세요 → 방문자 브라우저의 예전 저장본이 새 내용으로 바뀝니다 */
export const DATA_VERSION = 104;

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
    passcodeHint: "막차를 놓친 날",
    decoyCode: "",
    vault: { code: "", notes: [] },
    carrier: "KT",
    battery: 41,
    weather: { city: "서울", temp: 7, cond: "비", hi: 10, lo: 4 },
    allowSend: true,
    quickWords: ["네", "괜찮아요", "반납"],
    autoLockSec: 0,
    events: {
      incomingCall: { enabled: false, afterSec: 60, name: "", lines: [] },
      banner: { enabled: false, afterSec: 30, app: "kakao", title: "", text: "" },
      lowBattery: { enabled: false, afterSec: 150 },
      watcher: { enabled: false, afterSec: 300 },
    },
    lockNotifs: [
      { app: "kakao", title: "PC", text: "오늘 비 온대요 우산 챙겨요", when: "지금" },
      { app: "kakao", title: "열람실 근무조", text: "한서진: 오늘 마감 누구예요?", when: "8분 전" },
      { app: "messages", title: "[Web발신]", text: "도서관 희망도서 입고 안내", when: "1시간 전" },
    ],

    /* ───────── 대화방 ───────── */
    threads: [
      {
        id: "k_taeo", app: "kakao", name: "PC", unread: 1, pinned: true, last: "오전 7:12",
        messages: [
          day("11월 12일 수요일"),
          th("반납하러 갔는데 문 닫았던데요"),
          th("월요일 휴관인 거 또 까먹음"),
          me("수요일이에요 오늘"),
          me("시설 점검이라 공지 올렸는데"),
          th("아 공지를 누가 봐요 ㅋㅋㅋ"),
          th("NPC 씨한테 직접 들어야 알지"),
          me("연체 하루 추가예요"),
          th("네 기꺼이"),
          day("11월 13일 목요일"),
          th("내일 공연 맨 앞줄 비워 둘게요"),
          th("귀마개 챙겨 줄 테니까 그냥 와요"),
          me("시간 되면요"),
          th("시간 되잖아요 금요일은 6시 퇴근"),
          me("그걸 왜 알아요"),
          th("반납하러 다니다 보면 알게 돼요"),
          { id: id(), from: "them", text: "공연 포스터", kind: "photo" },
          me("포스터 예쁘네요"),
          { id: id(), from: "me", text: "", kind: "deleted" },
          th("방금 뭐 지웠어요?"),
          me("오타요"),
          day("11월 14일 금요일"),
          th("오늘 비 온대요 우산 챙겨요"),
        ],
      },
      {
        id: "k_desk", app: "kakao", name: "열람실 근무조", unread: 3, last: "오전 7:04", members: 4, notice: "11월 마감 순번: 월 NPC · 화 서진 · 수 민호 · 목 NPC · 금 서진",
        messages: [
          day("11월 13일 목요일"),
          g("한서진", "3층 제습기 또 꺼져 있었어요"),
          g("오민호", "그거 타이머 2시간으로 돼 있음"),
          me("제가 내일 아침에 바꿔 둘게요"),
          g("한서진", "NPC 씨 금요일 마감 바꿔 줄 수 있어요? 저 일이 생겨서"),
          me("금요일은 제가 약속이 있어서요"),
          g("한서진", "오 약속ㅋㅋ"),
          g("오민호", "오 약속ㅋㅋㅋ"),
          g("한서진", "드럼 치는 그분?"),
          day("11월 14일 금요일"),
          g("한서진", "오늘 마감 누구예요?"),
          g("오민호", "서진 씨잖아요"),
          g("한서진", "아 맞다"),
        ],
      },
      {
        id: "k_self", app: "kakao", name: "나와의 채팅", unread: 0, last: "어제",
        messages: [
          day("11월 13일 목요일"),
          me("악보집 연체료 총 4,200원 (받지 말 것?)"),
          me("앙코르곡 제목 찾기 - 가사 '창문 열어 둔 채로'"),
          me("귀마개는 내가 사 갈 것"),
        ],
      },
      {
        id: "m_lib", app: "messages", name: "[Web발신] 구립도서관", unread: 0, sms: true, last: "어제",
        messages: [day("11월 13일 목요일"), th("[구립도서관] 신청하신 희망도서 '드럼 입문 교본'이 입고되었습니다. 7일 내 대출 바랍니다.")],
      },
      {
        id: "m_seon", app: "messages", name: "수정 선배", unread: 0, last: "화요일",
        messages: [
          day("11월 11일 화요일"),
          th("NPC야 이번 주 토요일 북페어 같이 갈래?"),
          me("토요일은 일정 있어요 선배"),
          th("요즘 주말마다 일정이 있네?"),
          th("누구야"),
          me("그런 거 아니에요"),
          th("그런 거구나"),
        ],
      },
      {
        id: "m_parcel", app: "messages", name: "택배", unread: 0, sms: true, last: "월요일",
        messages: [day("11월 10일 월요일"), th("[Web발신] 고객님의 상품(귀마개 3쌍)이 배송 완료되었습니다. 문 앞")],
      },
      {
        id: "ig_taeo", app: "insta", name: "taeoh.drums", unread: 0, last: "1일",
        messages: [
          day("11월 13일 목요일"),
          th("스토리 봤어요?"),
          me("무슨 스토리요"),
          th("방금 본 거 다 떠요 NPC 씨 ㅋㅋ"),
        ],
      },
    ],

    calls: [
      { id: id(), name: "PC", kind: "in", label: "휴대전화", when: "어제", lines: ["NPC 씨 퇴근했어요?", "아니 그냥, 비 와서.", "우산 있어요? 없으면 앞에서 기다릴게요."] },
      { id: id(), name: "PC", kind: "missed", label: "휴대전화", count: 2, when: "화요일", lines: [] },
      { id: id(), name: "구립도서관 열람실", kind: "out", label: "직장", when: "화요일", lines: ["네, 열람실입니다.", "아 NPC 씨, 3층 열쇠 사무실에 있어요."] },
      { id: id(), name: "수정 선배", kind: "in", label: "휴대전화", when: "월요일", lines: ["너 요즘 연락이 왜 이렇게 늦어.", "밥 한번 먹자. 이번엔 진짜로."] },
      { id: id(), name: "02-***-1124", kind: "missed", label: "발신자 정보 없음", when: "일요일", lines: [] },
    ],
    contacts: [
      { id: id(), name: "PC", phone: "010-****-0314", label: "휴대전화", fav: true, note: "악보집 연체 중" },
      { id: id(), name: "한서진", phone: "010-****-2207", label: "휴대전화", note: "열람실" },
      { id: id(), name: "오민호", phone: "010-****-5512", label: "휴대전화", note: "열람실" },
      { id: id(), name: "수정 선배", phone: "010-****-8890", label: "휴대전화", fav: true },
      { id: id(), name: "구립도서관 열람실", phone: "02-***-3100", label: "직장" },
      { id: id(), name: "도서관 사무실", phone: "02-***-3101", label: "직장" },
      { id: id(), name: "단골 국밥집", phone: "02-***-1124", label: "직장" },
      { id: id(), name: "집주인", phone: "010-****-7781", label: "휴대전화" },
      { id: id(), name: "세탁소", phone: "02-***-5527", label: "직장" },
    ],
    notes: [
      { id: id(), folder: "메모", title: "연체 중", body: "연체 중\n[ ] PC - 드럼 악보집 (사흘째)\n[x] 3층 열람실 - 제습기 타이머\n[ ] 희망도서 드럼 입문 교본 - 대출하기", pinned: true, when: "어제" },
      { id: id(), folder: "메모", title: "금요일 공연", body: "금요일 공연\n6시 퇴근 → 7시 클럽\n귀마개 챙기기\n맨 앞줄은 너무 티 나니까 두 번째 줄", when: "어제" },
      { id: id(), folder: "메모", title: "앙코르곡 가사", body: "앙코르곡 가사\n창문 열어 둔 채로 / 네가 오는 소리를\n(제목 모름. 물어보면 안 됨)", when: "목요일" },
      { id: id(), folder: "메모", title: "하지 말 것", body: "하지 말 것\n- 먼저 연락하기\n- 답장 바로 하기\n- 공연 영상 세 번 이상 보기", when: "월요일" },
    ],
    calendar: [
      { id: id(), days: [5], time: "19:00", title: "공연 (클럽)", place: "", color: "#FF3B30" },
      { id: id(), days: [1], time: "", title: "휴관 · 서가 정리", color: "#8E8E93" },
      { id: id(), days: [4], time: "21:00", title: "마감 근무", color: "#007AFF" },
      { id: id(), days: [6], time: "14:00", title: "악보집 반납 예정", color: "#34C759" },
    ],
    dday: { title: "막차 놓친 날", date: "2026-03-14" },
    bank: {
      name: "입출금 통장",
      account: "기업 ***-******-**-014",
      balance: 1284300,
      txs: [
        { id: id(), when: "어제", name: "OO음향", amount: -12900, memo: "귀마개 3쌍" },
        { id: id(), when: "어제", name: "단골 국밥집", amount: -18000, memo: "2인분" },
        { id: id(), when: "11. 12.", name: "강*오", amount: 4200, memo: "연체료 입금 (받지 말라고 했는데)" },
        { id: id(), when: "11. 10.", name: "급여", amount: 2410000, memo: "구립도서관" },
        { id: id(), when: "11. 10.", name: "월세", amount: -550000, memo: "자동이체" },
        { id: id(), when: "11. 07.", name: "클럽 라운드", amount: -25000, memo: "공연 예매" },
        { id: id(), when: "11. 05.", name: "교보문고", amount: -32000, memo: "드럼 입문서" },
      ],
    },
    songs: [
      { id: id(), title: "창문", artist: "라운드어바웃", album: "라이브 세션", url: "", hue: 20 },
      { id: id(), title: "밤의 반납함", artist: "라운드어바웃", album: "EP 1", url: "", hue: 210 },
      { id: id(), title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", url: "", hue: 260 },
      { id: id(), title: "Ivy", artist: "Frank Ocean", album: "Blonde", url: "", hue: 120 },
      { id: id(), title: "Everybody Wants To Rule The World", artist: "Tears for Fears", album: "Songs from the Big Chair", url: "", hue: 40 },
    ],
    home: {
      grid: ["kakao", "insta", "photos", "calendar", "notes", "bank", "maps", "weather", "camera", "settings", "health", "youtube", "folder:유틸리티", "folder:생활"],
      dock: ["phone", "messages", "safari", "music"],
      folders: { 유틸리티: ["contacts", "clock", "calculator", "voicememos"], 생활: ["mail", "reminders", "wallet", "coupang", "baemin", "kakaot", "netflix", "x"] },
    },
    customApps: [],
    mail: [
      { id: id(), from: "구립도서관", addr: "noreply@library.example", subject: "11월 서가 정리 근무표", body: "11월 서가 정리 근무표를 첨부합니다.\n휴관일(월) 오전 9시까지 출근 바랍니다.", when: "어제", unread: false, box: "inbox" },
      { id: id(), from: "클럽 라운드", addr: "ticket@round.example", subject: "[예매 완료] 11/14(금) 라운드어바웃 단독 공연", body: "예매가 완료되었습니다.\n입장 순서: 2번\n공연 시작 19:30", when: "11. 07.", unread: false, box: "inbox" },
    ],
    reminders: [
      { id: id(), text: "제습기 타이머 바꾸기", note: "3층", due: "오늘", done: true, list: "미리 알림" },
      { id: id(), text: "귀마개 챙기기", note: "", due: "오늘 18:00", done: false, list: "미리 알림", flag: true },
      { id: id(), text: "희망도서 대출하기", note: "드럼 입문 교본", due: "이번 주", done: false, list: "미리 알림" },
    ],
    wallet: [
      { id: id(), name: "체크카드", sub: "입출금 통장 연결", number: "•••• 0314", color: "#1C3D5A" },
      { id: id(), name: "도서관 직원증", sub: "구립도서관", number: "사번 2207", color: "#5B6B3A" },
    ],
    youtube: {
      feed: [
        { id: id(), title: "라운드어바웃 - 창문 (라이브)", channel: "클럽 라운드", views: "조회수 3,412회", when: "2일 전", duration: "4:51", hue: 20, photo: "", progress: 0 },
        { id: id(), title: "드럼 소리 크기별 귀마개 비교", channel: "공연 덕후", views: "조회수 8.1만회", when: "1년 전", duration: "9:12", hue: 200, photo: "", progress: 0 },
      ],
      history: [
        { id: id(), title: "라운드어바웃 - 창문 (라이브)", channel: "클럽 라운드", views: "조회수 3,412회", when: "2일 전", duration: "4:51", hue: 20, photo: "", progress: 1 },
        { id: id(), title: "드럼 초보가 처음 배우는 8비트", channel: "드럼 교실", views: "조회수 41만회", when: "3년 전", duration: "12:30", hue: 30, photo: "", progress: 0.6 },
      ],
      searches: ["라운드어바웃 창문", "드럼 스틱 잡는 법", "공연 맨 앞줄 귀"],
    },
    netflix: { profile: "NPC", watching: [], myList: [] },
    x: { name: "책갈피", handle: "@bookmark_0314", feed: [] },
    coupang: [
      { id: id(), name: "공연용 귀마개 3쌍", option: "투명 · 1세트", price: "12,900원", when: "2026. 11. 08", status: "배송완료", photo: "" },
    ],
    baemin: [],
    kakaot: [],
    homeVer: 2,
    photos: [],
    ig: {
      me: { handle: "jaehee.shelf", name: "NPC", bio: "", posts: 3, followers: 41, following: 88, private: true },
      users: [
        { handle: "taeoh.drums", name: "PC", bio: "drums @roundabout", posts: 128, followers: 2310, following: 301 },
        { handle: "roundabout.band", name: "라운드어바웃", bio: "11.14 FRI 단독 공연", posts: 212, followers: 8120, following: 40 },
      ],
      feed: [
        { id: id(), user: "roundabout.band", caption: "오늘 밤 7시 반. 맨 앞줄은 먼저 온 사람 몫", photo: "", likes: 512, comments: 38, when: "3시간 전" },
        { id: id(), user: "taeoh.drums", caption: "스틱 새로 샀음. 오늘 부러뜨릴 예정", photo: "", likes: 301, comments: 22, when: "어제" },
      ],
      stories: ["taeoh.drums", "roundabout.band"],
      storyItems: [
        { id: id(), user: "taeoh.drums", text: "오늘 앙코르곡\n바꿀 수도", bg: "linear-gradient(160deg,#2a1d12,#0e0a06)", when: "2시간" },
        { id: id(), user: "roundabout.band", text: "11.14 FRI\n클럽 라운드", bg: "linear-gradient(170deg,#101a2c,#2a3d5a)", when: "5시간", style: "box" },
      ],
      notes: [{ user: "taeoh.drums", text: "맨 앞줄 비워 둠" }],
    },
    safari: {
      favorites: [
        { title: "Google", url: "google.com" },
        { title: "NAVER", url: "m.naver.com" },
        { title: "YouTube", url: "m.youtube.com" },
        { title: "나무위키", url: "namu.wiki" },
      ],
      history: ["라운드어바웃 창문 가사", "드럼 공연 귀 먹먹함", "연체료 면제 규정", "공연 끝나고 기다려도 되나", "앙코르곡 바꾸는 이유"],
      tabs: [
        {
          id: id(), title: "라운드어바웃 창문 가사", url: "m.search.naver.com",
          page: { type: "search", engine: "naver", query: "라운드어바웃 창문 가사", results: [
            { title: "라운드어바웃 - 창문 (Live) 가사", url: "music.example.com", desc: "창문 열어 둔 채로 네가 오는 소리를 듣고 있었어…" },
            { title: "[공연 후기] 앙코르곡이 바뀌었다", url: "blog.example.com", desc: "드러머가 갑자기 앙코르곡을 바꿨는데 이유를 아는 사람?" },
          ] },
        },
        {
          id: id(), title: "공연 끝나고 기다려도 되나요", url: "kin.example.com",
          page: { type: "qna", question: "공연 끝나고 밴드 멤버를 기다려도 되나요?", detail: "아는 사람이에요. 그냥 아는 사람. 기다리면 이상해 보일까요?", asker: "비공개", when: "어제", views: 42, answers: [{ who: "공연러", text: "아는 사이면 연락 먼저 하고 기다리세요. 기다리는 거 다 티 나요." }] },
        },
      ],
    },
    alarms: [
      { id: id(), time: "06:50", label: "출근", on: true },
      { id: id(), time: "18:00", label: "귀마개", on: true },
      { id: id(), time: "21:58", label: "답장해도 됨", on: false },
    ],
    places: [
      { id: id(), name: "구립도서관", note: "", x: 0.4, y: 0.42 },
      { id: id(), name: "클럽 라운드", note: "", x: 0.66, y: 0.3 },
      { id: id(), name: "단골 국밥집", note: "늘 먹던 걸로 2인분", x: 0.3, y: 0.68 },
    ],
    kakaoProfile: { name: "NPC", status: "반납은 기한 안에" },
    wallpaper: { style: "mesh", colors: ["#6f8296", "#2f3b4a", "#141a22"], desc: "비 오는 도서관 창문 사진" },
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
      { id: id(), title: "새로운 녹음", when: "어제", lines: ["앙코르곡 첫 소절.", "창문 열어 둔 채로…", "여기까지밖에 기억 안 남."] },
    ],
    health: { move: 320, moveGoal: 400, exercise: 18, stand: 9, km: 6.4, sleep: "5시간 40분", heart: [62, 60, 58, 61, 64, 70, 74, 72, 78, 76, 80, 118, 96, 84, 76, 70], peakAt: "오후 9:41" },
    cashwalk: { steps: 8412, cash: 1204, todayWon: 8, streak: 41, bubbles: 8, badges: [], friends: [{ name: "한서진", steps: 6120 }, { name: "오민호", steps: 3204 }], quiz: { q: "오늘의 퀴즈: 도서관 연체료는 보통 하루에 얼마일까요?", options: ["100원", "1,000원", "없음"], answer: 0 }, shop: [{ name: "아메리카노 교환권", price: 4100 }], history: [] },

    /* ───────── 하루 재생 ───────── */
    dayInfo: { title: "공연이 있는 금요일", date: "11월 14일 금요일", owner: "NPC", pc: "PC", summary: "하루 종일 아무렇지 않은 척하지만, PC의 방에서만 입력창을 몇 번씩 고친다. 답장을 늦추는 알람까지 만들어 둔 사람." },
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
      { t: "07:20", act: "open", app: "kakao", thread: "열람실 근무조", say: "근무조 단체방을 훑어본다." },
      { t: "09:40", act: "open", app: "notes", note: "연체 중", say: "메모 앱에서 연체 목록을 연다.", inner: "사흘째. 받으면 안 된다. 그래야 또 온다." },
      { t: "12:30", act: "open", app: "insta", say: "점심시간에 인스타 스토리를 넘긴다.", inner: "앙코르곡 바꿀 수도, 라니." },
      { t: "12:34", act: "open", app: "safari", tab: 0, say: "앙코르곡 가사를 검색한다." },
      { t: "15:10", act: "banner", banner: { app: "kakao", title: "PC", text: "오늘 맨 앞줄 비워 놨어요" }, say: "일하는 중에 알림이 뜬다." },
      { t: "15:11", act: "open", app: "safari", tab: 1, say: "어제 써 둔 질문에 답이 달렸는지 본다.", inner: "기다리는 거 다 티 나요. 알아요." },
      { t: "18:02", act: "open", app: "reminders", say: "'귀마개 챙기기'에 체크한다." },
      { t: "18:05", act: "call", call: { name: "PC", lines: [], talk: [{ who: "them", text: "NPC 씨 퇴근했어요?" }, { who: "me", text: "이제 나가요. 왜요?" }, { who: "them", text: "아니 그냥, 비 오니까." }, { who: "me", text: "우산 있어요." }, { who: "them", text: "그럼 앞에서 기다릴게요. 같이 써요." }, { who: "me", text: "…5분만요." }] }, say: "퇴근길에 PC에게서 전화가 온다." },
      { t: "21:58", act: "open", app: "clock", say: "'답장해도 됨' 알람을 켜 둔다.", inner: "공연 끝나고 바로 연락하면 이상하니까." },
      {
        t: "22:30", act: "open", app: "kakao", thread: "PC", say: "공연이 끝나고 다시 PC의 방을 연다.",
        inner: "앙코르곡, 나 들으라고 바꾼 거 맞죠. 그걸 묻고 싶다.",
        scene: [
          { kind: "msg", from: "them", text: "오늘 와 줘서 고마워요", sec: 1.2 },
          { kind: "wait", sec: 1 },
          { kind: "type", text: "앙코르곡 저 들으라고 바꾼 거죠" },
          { kind: "wait", sec: 1.6 },
          { kind: "type", text: "드럼 소리가 커서 귀가 아직 멍해요" },
          { kind: "send" },
          { kind: "msg", from: "them", text: "다음엔 귀마개 제가 챙길게요", sec: 1.4 },
          { kind: "photo", from: "them", text: "무대에서 찍은 두 번째 줄", sec: 1.2 },
          { kind: "react", tap: "heart", from: "me", sec: 1 },
        ],
      },
      {
        t: "23:05", act: "open", app: "messages", thread: "수정 선배", say: "선배에게서 문자가 와 있다.",
        inner: "선배는 늘 모르는 척 다 안다.",
        scene: [
          { kind: "typing", sec: 2.2 },
          { kind: "msg", from: "them", text: "공연 어땠어?", sec: 1 },
          { kind: "typing", sec: 1.6 },
          { kind: "msg", from: "them", text: "누구랑 갔는지는 안 물을게", sec: 1.2 },
          { kind: "type", text: "혼자 갔어요" },
          { kind: "wait", sec: 1.2 },
          { kind: "type", text: "좋았어요" },
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
