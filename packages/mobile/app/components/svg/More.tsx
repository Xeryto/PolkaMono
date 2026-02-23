import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalMoreSvg from '../../assets/More.svg';
import MoreDarkSvg from '../../assets/MoreDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const More: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <MoreDarkSvg {...props} /> : <OriginalMoreSvg {...props} />;
};

export default More;
