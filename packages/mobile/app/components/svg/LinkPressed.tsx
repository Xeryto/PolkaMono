import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLinkPressedSvg from '../../assets/LinkPressed.svg';
import LinkPressedDarkSvg from '../../assets/LinkPressedDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const LinkPressed: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <LinkPressedDarkSvg {...props} /> : <OriginalLinkPressedSvg {...props} />;
};

export default LinkPressed;
