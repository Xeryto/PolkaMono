import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalMeSvg from '../../assets/me.svg';
import MeDarkSvg from '../../assets/MeDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Me: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <MeDarkSvg {...props} /> : <OriginalMeSvg {...props} />;
};

export default Me;
