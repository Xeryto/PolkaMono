import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLinkSvg from '../../assets/Link.svg';
import LinkDarkSvg from '../../assets/LinkDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Link: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <LinkDarkSvg {...props} /> : <OriginalLinkSvg {...props} />;
};

export default Link;
