import { PressureConverter, VapourPressure } from './pressure-converter';

describe('Pressure Converter', () => {
  it('315700 pascals converts to 3.157 bar', () => {
    const result = PressureConverter.pascalToBar(315700);
    expect(result).toBeCloseTo(3.157, 3);
  });

  it('3.157 converts to 315700 pascals', () => {
    const result = PressureConverter.barToPascal(3.157);
    expect(result).toBeCloseTo(315700);
  });

  describe('Partial pressure', () => {
    it('At 1 bar 0.79 volume fraction converts to ', () => {
      const result = PressureConverter.partialPressure(1, 0.79);
      expect(result).toBe(0.79);
    });

    it('At 3 bar 0.79 volume fraction converts to ', () => {
      const result = PressureConverter.partialPressure(6.667, 0.21);
      expect(result).toBeCloseTo(1.40, 3);
    });
  
    it('At 0 bars any fraction results in 0 partial pressure', () => {
      const result = PressureConverter.partialPressure(0, 0.79);
      expect(result).toBe(0);
    });

    it('At any bars 0 fraction results in 0 partial pressure', () => {
      const result = PressureConverter.partialPressure(3, 0);
      expect(result).toBe(0);
    });
  });
});

fdescribe('Vapour pressure', () => {
  it('0°C results in out of range', () => {
    expect(() => VapourPressure.waterVapourPressureInBars(0)).toThrow();
  });

  it('1°C corresponds to 0.00651 bar', () => {
    const result = VapourPressure.waterVapourPressureInBars(1);
    expect(result).toBeCloseTo(0.00651, 5);
  });
 
  it('32,5°C corresponds to 0.04878 bar', () => {
    const result = VapourPressure.waterVapourPressureInBars(32.5);
    expect(result).toBeCloseTo(0.04878, 5);
  });
  
  it('99°C corresponds to 0.97758 bar', () => {
    const result = VapourPressure.waterVapourPressureInBars(99);
    expect(result).toBeCloseTo(0.97758, 5);
  });

  it('100°C corresponds to 1.01334 bar', () => {
    const result = VapourPressure.waterVapourPressureInBars(100);
    expect(result).toBeCloseTo(1.013365, 5);
  });

  it('374°C corresponds to 217.3 bar', () => {
    const result = VapourPressure.waterVapourPressureInBars(374);
    expect(result).toBeCloseTo(217.30381, 5);
  });

  it('376°C corresponds to out of range', () => {
    expect(() => VapourPressure.waterVapourPressureInBars(376)).toThrow();
  });
});