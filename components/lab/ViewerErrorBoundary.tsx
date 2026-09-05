'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Aísla el visor 3D del resto del laboratorio. Si WebGL no está disponible o
 * Babylon falla al construir la escena, el panel derecho, el timeline y las
 * métricas siguen funcionando: la simulación no depende del render.
 */
export class ViewerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('El visor 3D no pudo inicializarse:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-bg p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-warn" />
          <p className="text-sm font-semibold text-text">
            El visor 3D no pudo inicializarse en este equipo.
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-text-muted">
            Suele deberse a que el navegador no tiene WebGL o aceleración por hardware
            activa. La simulación numérica, el timeline y el narrador siguen operativos.
          </p>
          <code className="max-w-sm truncate font-mono text-[10px] text-text-muted">
            {this.state.message}
          </code>
        </div>
      );
    }

    return this.props.children;
  }
}
