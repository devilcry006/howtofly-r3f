import "./RoleSelect.css";
import type { Role } from "./useRole";

export function RoleSelect({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="role-select">
      <h1>HowToFly</h1>
      <p>เลือกบทบาทของคุณ</p>
      <div className="role-buttons">
        <button onClick={() => onSelect("pilot")}>🚁 นักบิน (PC)</button>
        <button onClick={() => onSelect("gunner")}>🎯 พลปืน (มือถือ)</button>
      </div>
    </div>
  );
}
