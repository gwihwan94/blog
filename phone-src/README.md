# NPC의 폰 (2인분)

2인분 사이트의 "NPC의 폰" 툴 소스예요. 빌드 결과는 `../phone`에 들어가요.

- 기본 화면: 하루 재생 (`#/`)
- OOC로 채우기: `#/ooc`
- 직접 둘러보기: `#/phone`
- 세부 편집: `#/editor`

빌드:

```
npm ci
npx vite build --outDir ../phone --emptyOutDir
```

알림음과 벨소리는 없고, 사진과 소리 파일도 넣지 않아요. 기본 예시는 윤재희(NPC) × 강태오(PC)예요.
