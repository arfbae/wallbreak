declare module "jsfeat" {
  const jsfeat: {
    U8C1_t: number;
    matrix_t: new (
      width: number,
      height: number,
      type: number,
    ) => {
      data: Uint8Array;
      cols: number;
      rows: number;
    };
    imgproc: {
      grayscale: (
        source: Uint8ClampedArray,
        width: number,
        height: number,
        target: unknown,
      ) => void;
      gaussian_blur: (source: unknown, target: unknown, kernel: number, sigma: number) => void;
      canny: (source: unknown, target: unknown, low: number, high: number) => void;
    };
  };
  export default jsfeat;
}
