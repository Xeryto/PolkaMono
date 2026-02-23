import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalHeartSvg from '../../assets/Heart.svg';
import HeartDarkSvg from '../../assets/HeartDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Heart: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <HeartDarkSvg {...props} /> : <OriginalHeartSvg {...props} />;
};

export default Heart;
