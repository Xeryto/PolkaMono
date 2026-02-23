import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLogoSvg from '../../assets/Logo.svg';
import LogoAltSvg from '../../assets/LogoAlt.svg';
import { useTheme } from '../../lib/ThemeContext';

const Logo: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <LogoAltSvg {...props} /> : <OriginalLogoSvg {...props} />;
};

export default Logo;