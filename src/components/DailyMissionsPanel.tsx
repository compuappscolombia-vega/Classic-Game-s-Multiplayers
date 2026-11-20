import { CheckCircle2, Gift, Sparkles } from 'lucide-react';
import type { DailyMissionSlot, Language } from '../shared/types.ts';

interface DailyMissionsPanelProps {
  missions: DailyMissionSlot[];
  language: Language;
  isSignedIn: boolean;
  claimingIndex: number | null;
  onClaim: (slotIndex: number) => void;
  onOpenAuth: () => void;
}

export function DailyMissionsPanel({
  missions,
  language,
  isSignedIn,
  claimingIndex,
  onClaim,
  onOpenAuth,
}: DailyMissionsPanelProps) {
  const completedCount = missions.filter((m) => m.progress >= m.def.target).length;
  const claimedCount = missions.filter((m) => m.claimed).length;

  return (
    <section className="surface-3d-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-lg font-display font-bold text-[#f4f1ea]">
              {language === 'es' ? 'Misiones Diarias de ELO' : 'Daily ELO Missions'}
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {language === 'es'
              ? 'Completa retos del salón cada día para reclamar bonificaciones directas de ELO'
              : 'Complete daily salon tasks to claim direct competitive ELO bonuses'}
          </p>
        </div>

        <div className="text-xs text-stone-300 font-mono-num">
          {completedCount}/{missions.length} {language === 'es' ? 'completadas' : 'completed'} ·{' '}
          {claimedCount}/{missions.length} {language === 'es' ? 'reclamadas' : 'claimed'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {missions.map((slot, idx) => {
          const isComplete = slot.progress >= slot.def.target;
          const pct = Math.min(100, Math.round((slot.progress / slot.def.target) * 100));
          const title = language === 'es' ? slot.def.titleEs : slot.def.titleEn;

          return (
            <div
              key={slot.def.id}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                slot.claimed
                  ? 'bg-[#0e1412]/70 border-emerald-500/20'
                  : isComplete
                  ? 'bg-[#101c17] border-amber-400/40'
                  : 'bg-[#0e1412] border-white/10'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-[#f4f1ea] leading-snug">
                    {title}
                  </span>
                  <span className="text-xs font-mono-num font-bold text-amber-300 whitespace-nowrap shrink-0">
                    +{slot.def.rewardElo} ELO
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-black/50 overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-300 ${
                        slot.claimed
                          ? 'bg-emerald-500'
                          : isComplete
                          ? 'bg-amber-400'
                          : 'bg-emerald-500/85'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono-num">
                    <span>
                      {slot.progress}/{slot.def.target}
                    </span>
                    <span>{pct}%</span>
                  </div>
                </div>
              </div>

              {slot.claimed ? (
                <div className="min-h-[44px] px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'es' ? 'Bono Reclamado' : 'Bonus Claimed'}</span>
                </div>
              ) : isComplete ? (
                isSignedIn ? (
                  <button
                    type="button"
                    disabled={claimingIndex === idx}
                    onClick={() => onClaim(idx)}
                    className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-[#120d06] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Gift className="w-4 h-4" />
                    <span>
                      {claimingIndex === idx
                        ? language === 'es'
                          ? 'Reclamando...'
                          : 'Claiming...'
                        : language === 'es'
                        ? `Reclamar +${slot.def.rewardElo} ELO`
                        : `Claim +${slot.def.rewardElo} ELO`}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Gift className="w-4 h-4" />
                    <span>
                      {language === 'es' ? 'Inicia sesión para reclamar' : 'Sign In to Claim'}
                    </span>
                  </button>
                )
              ) : (
                <div className="min-h-[44px] px-3 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-stone-400 flex items-center justify-center">
                  {language === 'es' ? 'En progreso' : 'In Progress'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
