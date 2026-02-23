import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalHeartFilledSvg from '../../assets/HeartFilled.svg';
import HeartFilledDarkSvg from '../../assets/HeartFilledDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const HeartFilled: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <HeartFilledDarkSvg {...props} /> : <OriginalHeartFilledSvg {...props} />;
};

export default HeartFilled;
