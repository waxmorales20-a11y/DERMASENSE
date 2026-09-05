export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#0B1120] px-6 text-[#E8EEF7]">
      <main className="flex w-full max-w-2xl flex-col items-start gap-6 py-24">
        <span className="rounded-full border border-[#22304C] px-3 py-1 text-xs uppercase tracking-widest text-[#93A4BF]">
          Laboratorio virtual · en construcción
        </span>

        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          DERMASENSE
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-[#93A4BF]">
          Simulación in silico de penetración dérmica para I+D cosmética.
          Convierte semanas de ensayo físico en minutos de cálculo, con
          visualización 3D por capas de piel.
        </p>

        <div className="flex flex-col gap-2 rounded-lg border border-[#22304C] bg-[#111C31] p-4 text-sm text-[#93A4BF]">
          <p>
            Esta es una herramienta de{" "}
            <strong className="text-[#E8EEF7]">
              soporte a la decisión en fase exploratoria de I+D
            </strong>
            , no un dispositivo médico ni una validación regulatoria.
          </p>
        </div>

        <a
          href="https://github.com/waxmorales20-a11y/DERMASENSE"
          className="rounded-md bg-[#22D3EE] px-5 py-2.5 font-medium text-[#0B1120] transition-opacity hover:opacity-90"
        >
          Ver documentación en GitHub
        </a>
      </main>
    </div>
  );
}
