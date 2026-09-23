import { MapPinned, Sparkles } from "lucide-react";

interface TopBarProps {
  selectedCount: number;
}

export function TopBar({ selectedCount }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="Аким на 5 часов">
        <div className="brand-mark" aria-hidden="true">
          A5
        </div>
        <div>
          <p className="brand-title">Аким на 5 часов</p>
          <p className="brand-subtitle">городская симуляция · Астана</p>
        </div>
      </div>

      <div className="mission-progress" aria-label="Прогресс сценария">
        <span className="mission-progress__label">Сценарий 01</span>
        <div className="mission-progress__steps" aria-hidden="true">
          <span className="is-complete" />
          <span className={selectedCount === 5 ? "is-complete" : "is-active"} />
          <span className={selectedCount === 5 ? "is-active" : ""} />
        </div>
        <span className="mission-progress__copy">
          {selectedCount === 5 ? "План собран" : "Соберите план"}
        </span>
      </div>

      <div className="topbar-actions">
        <div className="team-chip">
          <MapPinned size={16} aria-hidden="true" />
          <span>Астана</span>
        </div>
        <Sparkles className="topbar-sparkle" size={18} aria-hidden="true" />
      </div>
    </header>
  );
}
