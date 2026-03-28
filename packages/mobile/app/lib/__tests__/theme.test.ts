import {
  getColor,
  getCurrentColorScheme,
  getTheme,
  setColorScheme,
} from '../theme';

// Reset to light after each test to avoid state bleed
afterEach(() => {
  setColorScheme('light');
});

describe('setColorScheme / getCurrentColorScheme', () => {
  it('defaults to light', () => {
    expect(getCurrentColorScheme()).toBe('light');
  });

  it('switches to dark', () => {
    setColorScheme('dark');
    expect(getCurrentColorScheme()).toBe('dark');
  });

  it('switches back to light', () => {
    setColorScheme('dark');
    setColorScheme('light');
    expect(getCurrentColorScheme()).toBe('light');
  });
});

describe('getTheme', () => {
  it('returns an object with primary color', () => {
    const theme = getTheme();
    expect(typeof theme.primary).toBe('string');
    expect(theme.primary).toMatch(/^#/);
  });

  it('returns different themes for light vs dark', () => {
    setColorScheme('light');
    const light = getTheme();
    setColorScheme('dark');
    const dark = getTheme();
    // Background colors should differ between modes
    expect(light.background.primary).not.toBe(dark.background.primary);
  });
});

describe('getColor', () => {
  beforeEach(() => setColorScheme('light'));

  it('returns top-level color by key', () => {
    const primary = getColor('primary');
    expect(typeof primary).toBe('string');
    expect(primary).toMatch(/^#/);
  });

  it('returns nested color via dot path', () => {
    const bg = getColor('background.primary');
    expect(typeof bg).toBe('string');
    expect(bg).toMatch(/^#/);
  });

  it('returns deeply nested color', () => {
    const textPrimary = getColor('text.primary');
    expect(typeof textPrimary).toBe('string');
  });

  it('returns #000000 for invalid path', () => {
    expect(getColor('nonexistent.path')).toBe('#000000');
  });

  it('returns #000000 for partial invalid path', () => {
    expect(getColor('background.doesNotExist')).toBe('#000000');
  });

  it('returns same value as getTheme() direct access', () => {
    const viaGetColor = getColor('background.primary');
    const viaTheme = getTheme().background.primary;
    expect(viaGetColor).toBe(viaTheme);
  });

  it('reflects scheme change', () => {
    setColorScheme('light');
    const lightBg = getColor('background.primary');
    setColorScheme('dark');
    const darkBg = getColor('background.primary');
    expect(lightBg).not.toBe(darkBg);
  });
});
