import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalHeart2Svg from '../../assets/Heart2.svg';
import Heart2DarkSvg from '../../assets/Heart2Dark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Heart2: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <Heart2DarkSvg {...props} /> : <OriginalHeart2Svg {...props} />;
};

export default Heart2;
