import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalBackIcon from '../../assets/Back.svg';
import BackDarkSvg from '../../assets/BackDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const BackIcon: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <BackDarkSvg {...props} /> : <OriginalBackIcon {...props} />;
};

export default BackIcon;
