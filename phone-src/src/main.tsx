import { StrictMode, useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Phone from "./Phone";

/* 괄호 밖: 게시 데이터(phone-data.json) 불러오기는 쓰지 않음 */

const Editor = lazy(() => import("./Editor"));
const IconSheet = lazy(() => import("./IconSheet"));
const Day = lazy(() => import("./Day"));
const Ooc = lazy(() => import("./Ooc"));

/* /editor 경로 또는 #/editor 해시로 제작자 편집 화면 */
const isEditor = () => location.hash.startsWith("#/editor") || /\/editor\/?$/.test(location.pathname);

function Root() {
  const [ed, setEd] = useState(isEditor());
  const [, setTick] = useState(0); // 해시가 바뀌면 화면 다시 고르기
  useEffect(() => {
    const f = () => { setEd(isEditor()); setTick((x) => x + 1); };
    window.addEventListener("hashchange", f);
    window.addEventListener("popstate", f);
    return () => {
      window.removeEventListener("hashchange", f);
      window.removeEventListener("popstate", f);
    };
  }, []);
  if (location.hash.startsWith("#/icons"))
    return (
      <Suspense fallback={null}>
        <IconSheet />
      </Suspense>
    );
  /* 괄호 밖: 기본은 하루 재생 · #/ooc 채우기 · #/phone 직접 둘러보기 · #/editor 세부 편집 */
  const h = location.hash;
  if (ed)
    return (
      <Suspense fallback={null}>
        <Editor />
      </Suspense>
    );
  if (h.startsWith("#/phone")) return <Phone />;
  return (
    <Suspense fallback={null}>
      {h.startsWith("#/ooc") ? <Ooc /> : <Day />}
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
