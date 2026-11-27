'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface DocenteSelectorOption {
  docenteId: string;
  nombreParaResolucion: string;
  nivelPrioridad: 1 | 2 | 3;
  escuelaProfesional: { id: number; nombre: string };
  departamentoAcademico: { id: number; nombre: string };
}

interface SelectorDocenteProps {
  value: string;
  onChange: (docenteId: string) => void;
  docentes: DocenteSelectorOption[];
  excluirIds?: Array<string | null | undefined>;
  nombreEscuela?: string;
  className?: string;
}

export function SelectorDocente({
  value,
  onChange,
  docentes,
  excluirIds = [],
  nombreEscuela,
  className = 'w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white',
}: SelectorDocenteProps) {
  const [mostrarOtros, setMostrarOtros] = useState(false);

  const filtrados = docentes.filter((d) => !excluirIds.includes(d.docenteId));
  const deLaEscuela = filtrados.filter((d) => d.nivelPrioridad === 1);
  const otrosDocentes = filtrados.filter((d) => d.nivelPrioridad !== 1);

  const seleccionadoEsDeOtros = otrosDocentes.some(
    (d) => d.docenteId === value,
  );
  const incluirOtros =
    mostrarOtros || deLaEscuela.length === 0 || seleccionadoEsDeOtros;

  const nombreCortoEscuela = (nombreEscuela || 'la escuela').replace(
    /^Escuela Profesional de\s+/i,
    '',
  );

  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        {!incluirOtros ? (
          deLaEscuela.map((d) => (
            <option key={d.docenteId} value={d.docenteId}>
              {d.nombreParaResolucion}
            </option>
          ))
        ) : (
          <>
            {deLaEscuela.length > 0 && (
              <optgroup label={`Docentes de ${nombreCortoEscuela}`}>
                {deLaEscuela.map((d) => (
                  <option key={d.docenteId} value={d.docenteId}>
                    {d.nombreParaResolucion}
                  </option>
                ))}
              </optgroup>
            )}
            {otrosDocentes.length > 0 && (
              <optgroup label="Otros docentes de la Facultad">
                {otrosDocentes.map((d) => {
                  const escuelaCorta = d.escuelaProfesional.nombre.replace(
                    /^Escuela Profesional de\s+/i,
                    '',
                  );
                  return (
                    <option key={d.docenteId} value={d.docenteId}>
                      {d.nombreParaResolucion} ({escuelaCorta})
                    </option>
                  );
                })}
              </optgroup>
            )}
          </>
        )}
      </select>

      {otrosDocentes.length > 0 && deLaEscuela.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {!incluirOtros ? (
            <button
              type="button"
              onClick={() => setMostrarOtros(true)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-[#1E73BE] hover:bg-blue-50 hover:border-blue-200 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
              <span>Otros ({otrosDocentes.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMostrarOtros(false);
                if (seleccionadoEsDeOtros && deLaEscuela[0]) {
                  onChange(deLaEscuela[0].docenteId);
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#1E73BE] hover:bg-blue-100 transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
              <span>Mostrar solo docentes de {nombreCortoEscuela}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
