import { program } from "../program/program";

export function Footer() {
  return (
    <footer>
      {program.meta.name} · plan v{program.meta.version}
      <br />
      {program.meta.disclaimer}
    </footer>
  );
}
