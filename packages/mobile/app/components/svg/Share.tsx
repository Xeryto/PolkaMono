import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalShareSvg from '../../assets/Share.svg';
import ShareDarkSvg from '../../assets/ShareDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Share: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <ShareDarkSvg {...props} /> : <OriginalShareSvg {...props} />;
};

export default Share;
