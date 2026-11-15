/* 알람이 울릴 때: 잠긴 화면이면 전체 화면(큰 시각 · 알람 이름 · 다시 알림 · 중단),
   쓰는 중이면 위에 카드로. 하루 재생에서 손가락이 '중단'이나 '다시 알림'을 누른다. */
import { AlarmClock } from "lucide-react";
import { Wallpaper } from "./Phone";
import { hm, useNow } from "./ui";

export function AlarmScreen({ label, full, onStop, onSnooze }: { label: string; full: boolean; onStop: () => void; onSnooze: () => void }) {
  const now = useNow();
  if (!full)
    return (
      <div className="absolute top-[50px] left-[8px] right-[8px] z-[96] rounded-[26px] p-[16px] text-white banner blur-bar" style={{ background: "rgba(30,30,32,0.9)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center gap-[10px]">
          <span className="w-[40px] h-[40px] rounded-[10px] bg-[#FF9500] flex items-center justify-center"><AlarmClock size={24} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-white/60">알람 · {hm(now)}</div>
            <div className="text-[17px] font-semibold truncate">{label || "알람"}</div>
          </div>
        </div>
        <div className="flex gap-[8px] mt-[14px]">
          <button data-alarm="snooze" onClick={onSnooze} className="flex-1 h-[44px] rounded-full bg-[#FF9500] text-black text-[16px] font-semibold">다시 알림</button>
          <button data-alarm="stop" onClick={onStop} className="flex-1 h-[44px] rounded-full bg-white/20 text-[16px] font-semibold">중단</button>
        </div>
      </div>
    );
  return (
    <div className="absolute inset-0 z-[96] text-white fade">
      <Wallpaper blur={24} dim={0.45} />
      <div className="relative flex flex-col items-center pt-[96px]">
        <div className="flex items-center gap-[6px] text-[17px] text-white/80"><AlarmClock size={18} />알람</div>
        <div className="text-[96px] leading-[100px] font-semibold tracking-[-0.035em] tabular mt-[6px]">{hm(now)}</div>
        <div className="text-[22px] font-semibold mt-[6px] px-[30px] text-center">{label || "알람"}</div>
      </div>
      <div className="absolute left-[34px] right-[34px] bottom-[120px] flex flex-col gap-[14px]">
        <button data-alarm="snooze" onClick={onSnooze} className="h-[64px] rounded-full bg-[#FF9500] text-black text-[20px] font-semibold">다시 알림</button>
        <button data-alarm="stop" onClick={onStop} className="h-[64px] rounded-full text-[20px] font-semibold" style={{ background: "rgba(255,255,255,0.22)" }}>중단</button>
      </div>
    </div>
  );
}
