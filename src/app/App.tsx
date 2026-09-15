import { useRole } from "./useRole";
import { RoleSelect } from "./RoleSelect";
import { PilotApp } from "../pilot/PilotApp";
import { GunnerApp } from "../gunner/GunnerApp";

function App() {
  const { role, setRole } = useRole();

  if (!role) return <RoleSelect onSelect={setRole} />;
  return role === "pilot" ? <PilotApp /> : <GunnerApp />;
}

export default App;
