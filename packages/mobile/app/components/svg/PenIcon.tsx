import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalPenSvg from '../../assets/pen.svg';
import PenDarkSvg from '../../assets/PenDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const PenIcon: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <PenDarkSvg {...props} /> : <OriginalPenSvg {...props} />;
};

export default PenIcon;
