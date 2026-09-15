import "./GunnerHUD.css";

// Purely visual, fixed screen-center reticle — GunnerFireControl fires along
// this same centerline regardless of where the tap lands.
export function GunnerHUD() {
  return <div className="crosshair" />;
}
