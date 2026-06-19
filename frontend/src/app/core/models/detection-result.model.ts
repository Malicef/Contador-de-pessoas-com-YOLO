export interface DetectionBox {
  /** Coordenadas no espaço da imagem original (pixels). */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export interface DetectionResult {
  peopleCount: number;
  confidence: number;
  timestamp?: string;
  boxes?: DetectionBox[];
}
