declare module "imagetracerjs" {
  interface TraceData {
    width: number;
    height: number;
    palette: { r: number; g: number; b: number; a: number }[];
    layers: unknown[][];
  }
  const tracer: {
    imagedataToTracedata(
      image: { data: Uint8ClampedArray; width: number; height: number },
      options: Record<string, unknown>,
    ): TraceData;
    getsvgstring(data: TraceData, options: Record<string, unknown>): string;
  };
  export default tracer;
}